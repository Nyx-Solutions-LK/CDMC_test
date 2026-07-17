const { pool } = require('../db/pool');

async function findByUsername(username) {
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listClients() {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE role = 'client' ORDER BY company_name COLLATE NOCASE, username`
  );
  return rows;
}

async function createUser({ username, email, companyName, role, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO users (username, email, company_name, role, password_hash)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [username, email, companyName || null, role, passwordHash]
  );
  return rows[0];
}

async function updateUser(id, fields) {
  const sets = [];
  const values = [];
  let i = 1;
  if (fields.companyName !== undefined) {
    sets.push(`company_name = $${i++}`);
    values.push(fields.companyName);
  }
  if (fields.email !== undefined) {
    sets.push(`email = $${i++}`);
    values.push(fields.email);
  }
  if (fields.isDisabled !== undefined) {
    sets.push(`is_disabled = $${i++}`);
    values.push(fields.isDisabled);
  }
  if (sets.length === 0) return findById(id);
  sets.push("updated_at = datetime('now')");
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function setPasswordHash(id, passwordHash, mustChangePassword) {
  const { rows } = await pool.query(
    `UPDATE users SET password_hash = $1, must_change_password = $2, updated_at = datetime('now')
     WHERE id = $3 RETURNING *`,
    [passwordHash, mustChangePassword, id]
  );
  return rows[0] || null;
}

module.exports = {
  findByUsername,
  findById,
  listClients,
  createUser,
  updateUser,
  setPasswordHash,
};
