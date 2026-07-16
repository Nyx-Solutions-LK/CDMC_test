const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/errors');
const { requireAuth, serializeUser } = require('../auth/middleware');
const { hashPassword, verifyPassword, verifyPasswordTimingSafe, encryptPasswordForExport } = require('../auth/passwords');
const usersRepo = require('../repositories/users.repo');

const router = express.Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      throw new HttpError(400, 'username and password are required', 'BAD_REQUEST');
    }
    const user = await usersRepo.findByUsername(username);
    // Always run a bcrypt compare, even when the user doesn't exist (against a
    // fixed dummy hash), so response time doesn't reveal whether the username
    // is valid — without this, real users take ~bcrypt-cost-10 longer than
    // unknown ones despite the identical error message below.
    const ok = await verifyPasswordTimingSafe(password, user && user.password_hash);
    if (!user || user.is_disabled || !ok) {
      throw new HttpError(401, 'Invalid username or password', 'INVALID_CREDENTIALS');
    }
    // Regenerate the session ID on privilege change so a session ID an attacker
    // set before login (session fixation) doesn't become an authenticated one.
    // Promisified so a regenerate/save error flows through asyncHandler's
    // .catch(next) instead of throwing inside a bare callback (which asyncHandler
    // can't see, since it only wraps the outer async function's own promise).
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        req.session.userId = user.id;
        req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
      });
    });
    res.json({ user: serializeUser(user) });
  })
);

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

router.get('/me', (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      throw new HttpError(400, 'currentPassword and newPassword are required', 'BAD_REQUEST');
    }
    if (newPassword.length < 8) {
      throw new HttpError(400, 'newPassword must be at least 8 characters', 'WEAK_PASSWORD');
    }
    const ok = await verifyPassword(currentPassword, req.user.password_hash);
    if (!ok) {
      throw new HttpError(400, 'Current password is incorrect', 'BAD_CURRENT_PASSWORD');
    }
    const newHash = await hashPassword(newPassword);
    await usersRepo.setPasswordHash(req.user.id, newHash, false, encryptPasswordForExport(newPassword));
    res.status(204).end();
  })
);

module.exports = router;
