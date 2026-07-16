const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config/env');

const SALT_ROUNDS = 10;
// Avoid visually ambiguous characters (0/O, 1/l/I) for passwords admins will read aloud/retype.
const PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

// A fixed, valid bcrypt hash with no corresponding real account, used purely to
// burn the same compute time as a real password check when a username isn't
// found — otherwise login responses for unknown users return near-instantly
// while real users take ~bcrypt-cost-10 time, letting an attacker enumerate
// valid usernames by timing alone even though the response bodies are identical.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', SALT_ROUNDS);

function generateRandomPassword(length = 10) {
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  }
  return result;
}

function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

function verifyPasswordTimingSafe(plaintext, hash) {
  return bcrypt.compare(plaintext, hash || DUMMY_HASH);
}

// Reversible storage of the plaintext password, ON TOP OF the bcrypt hash
// above (which remains what login actually checks against). This exists
// solely so admin CSV exports can include each user's real, current
// password without resetting it — at the deliberate cost of the usual
// guarantee that nobody, including the app/DB owner, can read passwords
// back. That trade-off was an explicit, informed choice for this app, not
// the default for new projects.
//
// Key: derived deterministically from SESSION_SECRET so no separate secret
// needs to be provisioned, and so it stays stable across restarts (a
// randomly-generated key would make every previously-encrypted password
// permanently undecryptable the moment the process restarted).
const ENCRYPTION_KEY = crypto.scryptSync(config.sessionSecret, 'cdmc-password-export-v1', 32);
const ENCRYPTION_ALGO = 'aes-256-gcm';

function encryptPasswordForExport(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv (12B) + authTag (16B) + ciphertext, base64-encoded for TEXT storage.
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

function decryptPasswordForExport(blob) {
  if (!blob) return null;
  try {
    const raw = Buffer.from(blob, 'base64');
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (err) {
    // Most likely SESSION_SECRET changed since this row was written, so the
    // derived key no longer matches. Surface as "unavailable" rather than
    // crashing the whole export.
    return null;
  }
}

module.exports = {
  generateRandomPassword,
  hashPassword,
  verifyPassword,
  verifyPasswordTimingSafe,
  encryptPasswordForExport,
  decryptPasswordForExport,
};
