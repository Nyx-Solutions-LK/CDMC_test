const { pool } = require('../db/pool');

async function getQuota(clientId) {
  const { rows } = await pool.query('SELECT * FROM maintenance_quotas WHERE client_id = $1', [clientId]);
  return rows[0] || { client_id: clientId, quota_total: 0 };
}

async function setQuota(clientId, quotaTotal) {
  const { rows } = await pool.query(
    `INSERT INTO maintenance_quotas (client_id, quota_total) VALUES ($1, $2)
     ON CONFLICT (client_id) DO UPDATE SET quota_total = excluded.quota_total, updated_at = datetime('now')
     RETURNING *`,
    [clientId, quotaTotal]
  );
  return rows[0];
}

async function getUsedHours(clientId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(hours_used), 0) AS used FROM maintenance_requests WHERE client_id = $1`,
    [clientId]
  );
  return Number(rows[0].used);
}

async function listForClient(clientId) {
  const { rows } = await pool.query(
    `SELECT * FROM maintenance_requests WHERE client_id = $1 ORDER BY created_at DESC`,
    [clientId]
  );
  return rows;
}

async function listAll() {
  const { rows } = await pool.query(`SELECT * FROM maintenance_requests ORDER BY created_at DESC`);
  return rows;
}

async function getById(id) {
  const { rows } = await pool.query('SELECT * FROM maintenance_requests WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ clientId, subject, description, hoursUsed, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO maintenance_requests (client_id, subject, description, hours_used, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [clientId, subject, description || null, hoursUsed || 0, createdBy]
  );
  return rows[0];
}

async function update(id, { status, hoursUsed }) {
  const sets = [];
  const values = [];
  let i = 1;
  if (hoursUsed !== undefined) {
    sets.push(`hours_used = $${i++}`);
    values.push(hoursUsed);
  }
  if (status !== undefined) {
    sets.push(`status = $${i++}`);
    values.push(status);
    sets.push(`resolved_at = ${status === 'resolved' ? "datetime('now')" : 'NULL'}`);
  }
  if (sets.length === 0) return getById(id);
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE maintenance_requests SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

module.exports = { getQuota, setQuota, getUsedHours, listForClient, listAll, getById, create, update };
