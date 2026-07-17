const { pool } = require('../db/pool');

async function listAll() {
  const { rows } = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
  return rows;
}

async function create({ clientId, name, email, message }) {
  const { rows } = await pool.query(
    `INSERT INTO contact_messages (client_id, name, email, message) VALUES ($1, $2, $3, $4) RETURNING *`,
    [clientId || null, name, email, message]
  );
  return rows[0];
}

async function markRead(id) {
  const { rows } = await pool.query(
    `UPDATE contact_messages SET status = 'read' WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { listAll, create, markRead };
