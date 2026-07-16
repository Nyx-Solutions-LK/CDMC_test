const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/errors');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const { parsePagination, buildPageResult } = require('../utils/pagination');
const { upload, SLOT_FILE_FIELDS } = require('../upload/multer.config');
const { validateHttpUrl } = require('../utils/validateUrl');
const messagesRepo = require('../repositories/messages.repo');

const publicRouter = express.Router();
const adminRouter = express.Router();

const SLOT_COUNT = messagesRepo.MAX_SLOTS; // always exactly 3

const SRI_LANKA_OFFSET = '+05:30'; // Asia/Colombo, fixed offset (no DST)

// Converts a <input type="datetime-local"> value like "2026-07-20T14:30"
// (a naive Sri Lanka wall-clock time, no offset) into the same UTC
// "YYYY-MM-DD HH:MM:SS" text format SQLite's own datetime('now') produces.
// This MUST match that format exactly — comparing an ISO string (with "T"
// and "Z") against datetime('now') as text is a silent no-op: "T" sorts
// after every digit, so `scheduled_at <= datetime('now')` was always false,
// which is why scheduled messages never actually became visible.
function parseScheduledAt(raw) {
  if (!raw) return null;
  const withSeconds = /T\d{2}:\d{2}$/.test(raw) ? `${raw}:00` : raw;
  const d = new Date(`${withSeconds}${SRI_LANKA_OFFSET}`);
  if (Number.isNaN(d.getTime())) {
    throw new HttpError(400, 'scheduledAt must be a valid date/time', 'BAD_REQUEST');
  }
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// The inverse direction: turns the "YYYY-MM-DD HH:MM:SS" text stored in
// SQLite back into a real ISO-with-Z string so `new Date(...)` parses it as
// UTC instead of (incorrectly) as the server's local timezone.
function sqliteDatetimeToIso(value) {
  if (!value) return null;
  return value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
}

function slotPlaybackUrl(messageId, slot) {
  if (!slot.source_type) return null;
  if (slot.source_type === 'url') return slot.external_url;
  return `/api/messages/${messageId}/slots/${slot.id}/audio`;
}

function serializeMessage(message, readAt) {
  const scheduledAt = sqliteDatetimeToIso(message.scheduled_at);
  const isScheduled = Boolean(scheduledAt) && new Date(scheduledAt).getTime() > Date.now();
  return {
    id: message.id,
    createdAt: message.created_at,
    updatedAt: message.updated_at,
    // publishAt is what members should treat as "the date this went up" —
    // scheduled messages effectively become dated the moment they go live.
    publishAt: scheduledAt || message.created_at,
    scheduledAt,
    isScheduled,
    readByMe: readAt !== undefined && readAt !== null,
    readAt: readAt || null,
    slots: (message.slots || []).map((slot) => ({
      id: slot.id,
      languageLabel: slot.language_label,
      title: slot.slot_title,
      body: slot.slot_body,
      sourceType: slot.source_type || null,
      sortOrder: slot.sort_order,
      playbackUrl: slotPlaybackUrl(message.id, slot),
    })),
  };
}

// Parses slot0../slot1../slot2.. fields into a normalized array. All 3 slots
// always exist (English/Sinhala/Tamil by default, or whatever the admin
// relabels them to), but content in a given language is entirely optional —
// title, body, and audio can all be left blank for a slot that isn't used.
function parseSlotsForCreate(req) {
  const slots = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const languageLabel = req.body[`slot${i}LanguageLabel`] || `Language ${i + 1}`;
    const title = req.body[`slot${i}Title`] || '';
    const body = req.body[`slot${i}Body`] || '';
    const sourceType = req.body[`slot${i}SourceType`];
    let audio;
    if (sourceType && sourceType !== 'none') {
      audio = parseAudioFromRequest(req, i, sourceType);
    }
    slots.push({ languageLabel, title, body, audio });
  }
  return slots;
}

function parseAudioFromRequest(req, i, sourceType) {
  if (sourceType === 'upload') {
    const fileArr = (req.files && req.files[`slot${i}AudioFile`]) || [];
    const file = fileArr[0];
    if (!file) {
      throw new HttpError(400, `slot${i}AudioFile is required when slot${i}SourceType is "upload"`, 'BAD_REQUEST');
    }
    return {
      sourceType: 'upload',
      audioData: file.buffer,
      audioMimeType: file.mimetype,
      audioFilename: file.originalname,
    };
  }
  if (sourceType === 'url') {
    const externalUrl = req.body[`slot${i}ExternalUrl`];
    if (!externalUrl) {
      throw new HttpError(400, `slot${i}ExternalUrl is required when slot${i}SourceType is "url"`, 'BAD_REQUEST');
    }
    // Reject javascript:/data: and similar schemes — this gets rendered
    // straight into an href/src on the Messages page.
    validateHttpUrl(externalUrl, `slot${i}ExternalUrl`);
    return { sourceType: 'url', externalUrl };
  }
  throw new HttpError(400, `slot${i}SourceType must be "upload", "url", or "none"`, 'BAD_REQUEST');
}

// For PATCH: all 3 slots are always resent by the front end. Content
// (title/body) stays optional per language; audio for a slot is only
// touched if slotNSourceType is explicitly present in the request — "none"
// clears it, "upload"/"url" replaces it, and omitting the field entirely
// leaves whatever audio the slot already had untouched.
function parseSlotsForUpdate(req) {
  const slots = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const languageLabel = req.body[`slot${i}LanguageLabel`] || `Language ${i + 1}`;
    const title = req.body[`slot${i}Title`] || '';
    const body = req.body[`slot${i}Body`] || '';
    const sourceType = req.body[`slot${i}SourceType`];
    let audioUpdate;
    if (sourceType === 'none') {
      audioUpdate = 'remove';
    } else if (sourceType) {
      audioUpdate = parseAudioFromRequest(req, i, sourceType);
    }
    slots.push({ sortOrder: i, languageLabel, title, body, audioUpdate });
  }
  return slots;
}

publicRouter.use(requireAuth);

publicRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset, page, pageSize } = parsePagination(req.query);
    const includeScheduled = req.user.role === 'admin';
    const { items, totalItems } = await messagesRepo.listMessagesPage({ limit, offset, includeScheduled });
    const readMap = await messagesRepo.getReadMapForUser(req.user.id, items.map((m) => m.id));
    res.json(buildPageResult(items.map((m) => serializeMessage(m, readMap.get(m.id))), totalItems, page, pageSize));
  })
);

publicRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const message = await messagesRepo.getMessage(req.params.id);
    if (!message) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    const isFutureScheduled = message.scheduled_at && new Date(sqliteDatetimeToIso(message.scheduled_at)).getTime() > Date.now();
    if (isFutureScheduled && req.user.role !== 'admin') {
      throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    }
    const readMap = await messagesRepo.getReadMapForUser(req.user.id, [message.id]);
    res.json(serializeMessage(message, readMap.get(message.id)));
  })
);

publicRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const message = await messagesRepo.getMessage(req.params.id);
    if (!message) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    const isFutureScheduled = message.scheduled_at && new Date(sqliteDatetimeToIso(message.scheduled_at)).getTime() > Date.now();
    if (isFutureScheduled && req.user.role !== 'admin') {
      throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    }
    const readAt = await messagesRepo.markMessageRead(message.id, req.user.id);
    res.json({ read: true, readAt });
  })
);

publicRouter.get(
  '/:messageId/slots/:slotId/audio',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
      const message = await messagesRepo.getMessage(req.params.messageId);
      const isFutureScheduled = message && message.scheduled_at && new Date(sqliteDatetimeToIso(message.scheduled_at)).getTime() > Date.now();
      if (!message || isFutureScheduled) {
        throw new HttpError(404, 'Audio not found for this slot', 'NOT_FOUND');
      }
    }
    const slot = await messagesRepo.getSlotAudio(req.params.messageId, req.params.slotId);
    if (!slot || slot.source_type !== 'upload' || !slot.audio_data) {
      throw new HttpError(404, 'Audio not found for this slot', 'NOT_FOUND');
    }
    res.set('Content-Type', slot.audio_mime_type || 'application/octet-stream');
    // audio_filename is an attacker/admin-controlled value (the uploaded
    // file's original name) — strip quotes/control characters before putting
    // it in a header value so it can't break out of the filename="..." param.
    const safeFilename = (slot.audio_filename || 'audio').replace(/[\x00-\x1f"\\]/g, '_');
    res.set('Content-Disposition', `inline; filename="${safeFilename}"`);
    // node:sqlite returns BLOB columns as Uint8Array, not Buffer — res.send()
    // only recognizes Buffer as binary, so without this it mangles the bytes
    // and appends a text charset to the Content-Type header.
    res.send(Buffer.from(slot.audio_data));
  })
);

adminRouter.use(requireAdmin);

adminRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset, page, pageSize } = parsePagination(req.query);
    const { items, totalItems } = await messagesRepo.listMessagesPage({ limit, offset, includeScheduled: true });
    res.json(buildPageResult(items.map((m) => serializeMessage(m)), totalItems, page, pageSize));
  })
);

adminRouter.post(
  '/',
  upload.fields(SLOT_FILE_FIELDS),
  asyncHandler(async (req, res) => {
    const slots = parseSlotsForCreate(req);
    if (!slots.some((s) => s.title.trim() || s.body.trim() || s.audio)) {
      throw new HttpError(400, 'Add a title, message, or audio in at least one language', 'BAD_REQUEST');
    }
    const scheduledAt = parseScheduledAt(req.body.scheduledAt);
    const message = await messagesRepo.createMessage({ createdBy: req.user.id, slots, scheduledAt });
    res.status(201).json(serializeMessage(message));
  })
);

adminRouter.patch(
  '/:id',
  upload.fields(SLOT_FILE_FIELDS),
  asyncHandler(async (req, res) => {
    const slots = parseSlotsForUpdate(req);
    // scheduledAt field is only touched if the front end explicitly sent it
    // (it always does, per the form below) — 'publishMode=now' sends an
    // empty value, which clears any existing schedule.
    const scheduledAt = 'scheduledAt' in req.body ? parseScheduledAt(req.body.scheduledAt) : undefined;
    const message = await messagesRepo.updateMessage(req.params.id, { slots, scheduledAt });
    if (!message) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    res.json(serializeMessage(message));
  })
);

adminRouter.get(
  '/:id/reads',
  asyncHandler(async (req, res) => {
    const message = await messagesRepo.getMessage(req.params.id);
    if (!message) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    const readers = await messagesRepo.getReadersForMessage(message.id);
    res.json({
      messageId: message.id,
      totalReads: readers.length,
      readers: readers.map((r) => ({
        id: r.id,
        username: r.username,
        readAt: r.read_at,
      })),
    });
  })
);

adminRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await messagesRepo.deleteMessage(req.params.id);
    res.status(204).end();
  })
);

module.exports = { publicRouter, adminRouter };
