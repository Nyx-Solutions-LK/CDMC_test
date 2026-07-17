const session = require('express-session');
const config = require('../config/env');
const { SqliteSessionStore } = require('./sqliteSessionStore');

// Persistent (SQLite-backed) store + rolling cookie: a logged-in device
// stays logged in indefinitely as long as it's used, and survives server
// restarts. Only signing out (or the cookie aging out after a long stretch
// of inactivity) ends the session.
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

function buildSessionMiddleware() {
  return session({
    secret: config.sessionSecret,
    store: new SqliteSessionStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: ONE_YEAR_MS,
    },
  });
}

module.exports = { buildSessionMiddleware };
