const { pool } = require('../db/pool');

async function findByUsername(username) {
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function countAdmins() {
  const { rows } = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
  return parseInt(rows[0].count, 10);
}

async function countActiveAdmins() {
  const { rows } = await pool.query(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_disabled = 0"
  );
  return parseInt(rows[0].count, 10);
}

async function createUser({ username, email, courseId, phoneNumber, role, passwordHash, passwordEncrypted }) {
  const { rows } = await pool.query(
    `INSERT INTO users (username, email, course_id, phone_number, role, password_hash, password_encrypted)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [username, email, courseId || null, phoneNumber || null, role, passwordHash, passwordEncrypted || null]
  );
  return rows[0];
}

async function markAsPrimaryAdmin(id) {
  const { rows } = await pool.query(
    `UPDATE users SET is_primary_admin = 1, updated_at = datetime('now') WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function listUsers({ limit, offset }) {
  const { rows } = await pool.query(
    `SELECT * FROM users ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await pool.query('SELECT COUNT(*) AS count FROM users');
  return { items: rows, totalItems: parseInt(countRows[0].count, 10) };
}

async function listAllNonAdminUsers() {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE role = 'user' ORDER BY created_at DESC, id DESC`
  );
  return rows;
}

async function updateUser(id, fields) {
  const sets = [];
  const values = [];
  let i = 1;

  if (fields.email !== undefined) {
    sets.push(`email = $${i++}`);
    values.push(fields.email);
  }
  if (fields.courseId !== undefined) {
    sets.push(`course_id = $${i++}`);
    values.push(fields.courseId);
  }
  if (fields.phoneNumber !== undefined) {
    sets.push(`phone_number = $${i++}`);
    values.push(fields.phoneNumber);
  }
  if (fields.role !== undefined) {
    sets.push(`role = $${i++}`);
    values.push(fields.role);
  }
  if (fields.isDisabled !== undefined) {
    sets.push(`is_disabled = $${i++}`);
    values.push(fields.isDisabled);
  }
  if (sets.length === 0) {
    return findById(id);
  }
  sets.push("updated_at = datetime('now')");
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function setPasswordHash(id, passwordHash, mustChangePassword, passwordEncrypted) {
  const { rows } = await pool.query(
    `UPDATE users SET password_hash = $1, must_change_password = $2, password_encrypted = $3, updated_at = datetime('now')
     WHERE id = $4 RETURNING *`,
    [passwordHash, mustChangePassword, passwordEncrypted || null, id]
  );
  return rows[0] || null;
}

module.exports = {
  findByUsername,
  findById,
  countAdmins,
  countActiveAdmins,
  createUser,
  markAsPrimaryAdmin,
  listUsers,
  listAllNonAdminUsers,
  updateUser,
  setPasswordHash,
};
