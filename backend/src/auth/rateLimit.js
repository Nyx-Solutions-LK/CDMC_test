const rateLimit = require('express-rate-limit');

// Keyed by IP. Strict limits on credential-related endpoints (brute force /
// credential stuffing target), a looser baseline on the rest of the API as
// defense in depth against scripted abuse.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts, please try again later', code: 'RATE_LIMITED' } },
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts, please try again later', code: 'RATE_LIMITED' } },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later', code: 'RATE_LIMITED' } },
});

module.exports = { loginLimiter, changePasswordLimiter, apiLimiter };
