const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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

module.exports = {
  generateRandomPassword,
  hashPassword,
  verifyPassword,
  verifyPasswordTimingSafe,
};
