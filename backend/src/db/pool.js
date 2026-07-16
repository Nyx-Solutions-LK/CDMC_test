const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');

const dbPath = path.resolve(__dirname, '../..', config.sqlitePath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

// Thin shim so repositories can keep using a pg-style `pool.query(text, params)`
// API (Postgres $1-style placeholders, `{ rows }` results) while actually running
// against node:sqlite. This is the one place that needs to change if/when this
// is exported to a real Postgres host later.
function toSqliteSql(text) {
  return text.replace(/\$\d+/g, '?');
}

function normalizeParams(params) {
  // node:sqlite only binds null/number/string/bigint/Buffer — booleans and
  // `undefined` must be coerced before they reach the prepared statement.
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

async function query(text, params = []) {
  const sql = toSqliteSql(text);
  const args = normalizeParams(params);
  const stmt = db.prepare(sql);
  const isSelectLike = /^\s*(SELECT|PRAGMA)/i.test(text) || /RETURNING/i.test(text);
  if (isSelectLike) {
    const rows = stmt.all(...args);
    return { rows, rowCount: rows.length };
  }
  const info = stmt.run(...args);
  return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
}

async function connect() {
  return {
    query,
    release() {},
  };
}

async function end() {
  db.close();
}

const pool = { query, connect, end };

module.exports = { pool, db };
