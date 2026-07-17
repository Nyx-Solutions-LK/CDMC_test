const session = require('express-session');
const config = require('../config/env');
const { SqliteSessionStore } = require('./sqliteSessionStore');

// Users stay logged in on their device indefinitely — until they explicitly
// sign out — rather than being timed out after a fixed window. Two things
// make that work together:
//   1. `store`: a persistent (SQLite-backed) session store, so restarting
//      the server doesn't silently sign everyone out (MemoryStore would).
//   2. `rolling: true` + a long `maxAge`: every request that touches the
//      session pushes its expiry another `maxAge` into the future, so an
//      active device's session effectively never expires. A device that's
//      never opened again just ages out after the long stretch below.
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
