const fs = require('fs');
const path = require('path');
const { db, pool } = require('./pool');

const SQL_DIR = path.join(__dirname, 'sql');

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    VARCHAR(255) PRIMARY KEY,
        applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

async function migrate() {
  ensureMigrationsTable();
  // Table-rebuild migrations (create-new/copy/drop-old/rename) need FK checks
  // off — SQLite refuses structural changes to a table other tables
  // reference via FK while enforcement is on. Off for the whole migration
  // run is safe since this script never runs concurrently with the server.
  db.exec('PRAGMA foreign_keys = OFF;');

  const rows = db.prepare('SELECT filename FROM schema_migrations').all();
  const applied = new Set(rows.map((r) => r.filename));

  const files = fs
    .readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip (already applied): ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(SQL_DIR, file), 'utf8');
    console.log(`applying: ${file}`);
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  console.log('migrations complete');
  db.exec('PRAGMA foreign_keys = ON;');
}

migrate()
  .catch((err) => {
    console.error('migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
