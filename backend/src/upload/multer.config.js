const multer = require('multer');
const config = require('../config/env');

const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxAudioUploadBytes },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error(`Unsupported audio file type: ${file.mimetype}`);
      err.status = 400;
      err.code = 'UNSUPPORTED_AUDIO_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

const SLOT_FILE_FIELDS = [
  { name: 'slot0AudioFile', maxCount: 1 },
  { name: 'slot1AudioFile', maxCount: 1 },
  { name: 'slot2AudioFile', maxCount: 1 },
];

// Bulk user import: small plain-text CSV files, so a generous but bounded
// size cap (2MB — plenty for thousands of rows) and a much simpler filter
// than the audio upload above.
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const okMime = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'].includes(
      file.mimetype
    );
    const okExt = /\.csv$/i.test(file.originalname || '');
    if (!okMime && !okExt) {
      const err = new Error('Please upload a .csv file');
      err.status = 400;
      err.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

module.exports = { upload, csvUpload, SLOT_FILE_FIELDS, ALLOWED_MIME_TYPES };
