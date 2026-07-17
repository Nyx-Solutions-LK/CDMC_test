const { pool } = require('../db/pool');

async function listForClient(clientId) {
  const { rows } = await pool.query(
    `SELECT * FROM announcements WHERE audience_type = 'all' OR client_id = $1
     ORDER BY created_at DESC`,
    [clientId]
  );
  return rows;
}

async function listAll() {
  const { rows } = await pool.query(`SELECT * FROM announcements ORDER BY created_at DESC`);
  return rows;
}

async function create({ title, body, audienceType, clientId, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO announcements (title, body, audience_type, client_id, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title, body, audienceType, audienceType === 'single' ? clientId : null, createdBy]
  );
  return rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
}

module.exports = { listForClient, listAll, create, remove };
