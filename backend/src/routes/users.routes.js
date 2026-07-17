const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/errors');
const { requireAdmin, serializeUser } = require('../auth/middleware');
const { generateRandomPassword, hashPassword, encryptPasswordForExport, decryptPasswordForExport } = require('../auth/passwords');
const { parsePagination, buildPageResult } = require('../utils/pagination');
const { parseCsv, stringifyCsv } = require('../utils/csv');
const { csvUpload } = require('../upload/multer.config');
const usersRepo = require('../repositories/users.repo');

const router = express.Router();

router.use(requireAdmin);

// Column order the bulk-import CSV must follow. Only username and email are
// required — a row missing either is skipped (not partially created) and
// reported back by name so the admin can fix and re-upload just those rows.
const IMPORT_COLUMNS = ['username', 'email', 'courseId', 'phoneNumber'];
const IMPORT_REQUIRED = ['username', 'email'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset, page, pageSize } = parsePagination(req.query);
    const { items, totalItems } = await usersRepo.listUsers({ limit, offset });
    res.json(buildPageResult(items.map(serializeUser), totalItems, page, pageSize));
  })
);

// Bulk export: CSV of every non-admin (role='user') account currently on
// file, INCLUDING their real, current password. Passwords are stored both
// as a one-way bcrypt hash (what login actually checks) AND a reversibly
// encrypted copy (see src/auth/passwords.js) used only to make this export
// possible — this endpoint decrypts that copy and does not touch or reset
// anyone's password.
router.get(
  '/bulk-export',
  asyncHandler(async (req, res) => {
    const users = await usersRepo.listAllNonAdminUsers();
    const header = ['username', 'email', 'courseId', 'phoneNumber', 'status', 'createdAt', 'password'];
    const rows = users.map((u) => [
      u.username,
      u.email,
      u.course_id || '',
      u.phone_number || '',
      u.is_disabled ? 'disabled' : 'active',
      u.created_at,
      decryptPasswordForExport(u.password_encrypted) || '(unavailable — set before this feature existed)',
    ]);
    const csv = stringifyCsv(header, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cdmc-users-export.csv"');
    res.send(csv);
  })
);

// Separate fallback for any account whose password predates this feature
// (password_encrypted is empty, so bulk-export can't show a real password
// for it): issues a fresh password instead. Kept as its own endpoint/button
// so it only ever runs when deliberately clicked.
router.get(
  '/bulk-export-reset-passwords',
  asyncHandler(async (req, res) => {
    const users = await usersRepo.listAllNonAdminUsers();
    const header = ['username', 'email', 'courseId', 'phoneNumber', 'status', 'createdAt', 'password'];
    const rows = [];
    for (const u of users) {
      const generatedPassword = generateRandomPassword();
      const passwordHash = await hashPassword(generatedPassword);
      await usersRepo.setPasswordHash(u.id, passwordHash, true, encryptPasswordForExport(generatedPassword));
      rows.push([
        u.username,
        u.email,
        u.course_id || '',
        u.phone_number || '',
        u.is_disabled ? 'disabled' : 'active',
        u.created_at,
        generatedPassword,
      ]);
    }
    const csv = stringifyCsv(header, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cdmc-users-export-with-new-passwords.csv"');
    res.send(csv);
  })
);

// Bulk import: CSV columns in order username,email,courseId,phoneNumber.
// Every created row gets a fresh random password (role is always 'user' —
// bulk-creating admin accounts isn't supported here by design). Rows
// missing a required field, or that collide with an existing username/email,
// are skipped and reported back individually rather than failing the whole
// batch.
router.post(
  '/bulk-import',
  csvUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, 'A CSV file is required (field name "file")', 'BAD_REQUEST');
    }
    const text = req.file.buffer.toString('utf8');
    const rows = parseCsv(text);
    if (rows.length === 0) {
      throw new HttpError(400, 'The CSV file is empty', 'EMPTY_FILE');
    }

    // Optional header row: if the first row's cells case-insensitively match
    // our known column names (in any order/subset), treat it as a header and
    // skip it; otherwise treat every row as data using the fixed column order.
    let dataRows = rows;
    const firstRowLower = rows[0].map((c) => c.trim().toLowerCase());
    const looksLikeHeader = firstRowLower.some((c) =>
      IMPORT_COLUMNS.map((h) => h.toLowerCase()).includes(c)
    );
    if (looksLikeHeader) {
      dataRows = rows.slice(1);
    }

    const created = [];
    const skipped = [];

    for (let i = 0; i < dataRows.length; i++) {
      const cells = dataRows[i];
      const rowNumber = i + (looksLikeHeader ? 2 : 1); // 1-based, accounting for header
      const record = {};
      IMPORT_COLUMNS.forEach((col, idx) => {
        record[col] = (cells[idx] || '').trim();
      });

      const displayName = record.username || record.email || `Row ${rowNumber}`;

      const missing = IMPORT_REQUIRED.filter((col) => !record[col]);
      if (missing.length > 0) {
        skipped.push({
          name: displayName,
          row: rowNumber,
          reason: `Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
        });
        continue;
      }

      const generatedPassword = generateRandomPassword();
      const passwordHash = await hashPassword(generatedPassword);
      try {
        const user = await usersRepo.createUser({
          username: record.username,
          email: record.email,
          courseId: record.courseId || null,
          phoneNumber: record.phoneNumber || null,
          role: 'user',
          passwordHash,
          passwordEncrypted: encryptPasswordForExport(generatedPassword),
        });
        created.push({
          id: user.id,
          username: user.username,
          email: user.email,
          courseId: user.course_id,
          phoneNumber: user.phone_number,
          generatedPassword,
        });
      } catch (err) {
        if (typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed')) {
          skipped.push({
            name: displayName,
            row: rowNumber,
            reason: 'Username or email already in use',
          });
        } else {
          skipped.push({ name: displayName, row: rowNumber, reason: 'Unexpected error' });
        }
      }
    }

    res.status(created.length > 0 ? 201 : 200).json({
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    });
  })
);

// Downloadable CSV version of a bulk-import result, generated client-side
// from the JSON above would also work, but this endpoint exists so the
// exact same CSV shape (with passwords) can be produced from either a fresh
// import response or re-requested — see admin.js, which posts the import
// response straight into a client-side CSV download instead of round-
// tripping here, since the plaintext passwords only ever exist in that one
// response and shouldn't be persisted to re-fetch later.

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { username, email, courseId, phoneNumber, role } = req.body || {};
    if (!username || !email || !role) {
      throw new HttpError(400, 'username, email, and role are required', 'BAD_REQUEST');
    }
    if (!['user', 'admin'].includes(role)) {
      throw new HttpError(400, 'role must be "user" or "admin"', 'BAD_REQUEST');
    }
    const generatedPassword = generateRandomPassword();
    const passwordHash = await hashPassword(generatedPassword);
    try {
      const user = await usersRepo.createUser({
        username,
        email,
        courseId,
        phoneNumber,
        role,
        passwordHash,
        passwordEncrypted: encryptPasswordForExport(generatedPassword),
      });
      res.status(201).json({ user: serializeUser(user), generatedPassword });
    } catch (err) {
      if (typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed')) {
        throw new HttpError(409, 'Username or email already in use', 'DUPLICATE');
      }
      throw err;
    }
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { email, courseId, phoneNumber, role, isDisabled } = req.body || {};
    if (role !== undefined && !['user', 'admin'].includes(role)) {
      throw new HttpError(400, 'role must be "user" or "admin"', 'BAD_REQUEST');
    }

    const target = await usersRepo.findById(req.params.id);
    if (!target) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }

    const isTouchingPrimaryAdminProtections =
      target.is_primary_admin &&
      ((role !== undefined && role !== 'admin') || isDisabled === true);
    if (isTouchingPrimaryAdminProtections) {
      throw new HttpError(
        400,
        'The primary admin account cannot be disabled or demoted',
        'PRIMARY_ADMIN'
      );
    }

    const isDemotingOrDisablingAdmin =
      target.role === 'admin' &&
      !target.is_disabled &&
      ((role !== undefined && role !== 'admin') || isDisabled === true);
    if (isDemotingOrDisablingAdmin) {
      const activeAdmins = await usersRepo.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new HttpError(
          400,
          'Cannot remove or disable the last remaining admin',
          'LAST_ADMIN'
        );
      }
    }

    const user = await usersRepo.updateUser(req.params.id, {
      email,
      courseId,
      phoneNumber,
      role,
      isDisabled,
    });
    if (!user) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }
    res.json({ user: serializeUser(user) });
  })
);

router.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const generatedPassword = generateRandomPassword();
    const passwordHash = await hashPassword(generatedPassword);
    const user = await usersRepo.setPasswordHash(
      req.params.id,
      passwordHash,
      true,
      encryptPasswordForExport(generatedPassword)
    );
    if (!user) {
      throw new HttpError(404, 'User not found', 'NOT_FOUND');
    }
    res.json({ generatedPassword });
  })
);

module.exports = router;
