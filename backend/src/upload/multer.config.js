const multer = require('multer');

// Client documents: contracts, reports, misc files — generous size cap
// (20MB) and a broad-but-not-wide-open type allowlist.
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/zip',
]);

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error(`Unsupported file type: ${file.mimetype}`);
      err.status = 400;
      err.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

module.exports = { documentUpload };
