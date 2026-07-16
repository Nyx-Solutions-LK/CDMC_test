const session = require('express-session');
const { pool } = require('../db/pool');

// Minimal express-session Store backed by the same SQLite DB as the rest of
// the app. Keeps logged-in users signed in on their device across server
// restarts (unlike the default MemoryStore, which forgets every session the
// moment the process stops) — the only thing that ends a session is it
// expiring (see cookie maxAge in session.js) or the user explicitly signing
// out (which calls destroy()).
class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    // Best-effort periodic sweep of rows past their expiry so the table
    // doesn't grow forever. Not load-bearing for correctness — expired
    // sessions are also rejected on read in get().
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpired().catch(() => {});
    }, 1000 * 60 * 60 * 24);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  async _cleanupExpired() {
    await pool.query(`DELETE FROM sessions WHERE expires_at < datetime('now')`);
  }

  get(sid, callback) {
    pool
      .query(`SELECT sess, expires_at FROM sessions WHERE sid = $1`, [sid])
      .then(({ rows }) => {
        const row = rows[0];
        if (!row) return callback(null, null);
        if (new Date(row.expires_at).getTime() < Date.now()) {
          return this.destroy(sid, () => callback(null, null));
        }
        callback(null, JSON.parse(row.sess));
      })
      .catch((err) => callback(err));
  }

  set(sid, sessionData, callback) {
    const expiresAt = sessionData.cookie && sessionData.cookie.expires
      ? new Date(sessionData.cookie.expires).toISOString()
      : new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    const sess = JSON.stringify(sessionData);
    pool
      .query(
        `INSERT INTO sessions (sid, sess, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT (sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at`,
        [sid, sess, expiresAt]
      )
      .then(() => callback && callback(null))
      .catch((err) => callback && callback(err));
  }

  destroy(sid, callback) {
    pool
      .query(`DELETE FROM sessions WHERE sid = $1`, [sid])
      .then(() => callback && callback(null))
      .catch((err) => callback && callback(err));
  }

  touch(sid, sessionData, callback) {
    // Rolling sessions call touch() on every request to push the expiry
    // forward, which is how a device stays logged in indefinitely as long
    // as it keeps being used.
    this.set(sid, sessionData, callback);
  }
}

module.exports = { SqliteSessionStore };
