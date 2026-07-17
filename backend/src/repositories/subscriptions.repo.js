const { pool } = require('../db/pool');

async function listForClient(clientId) {
  const { rows } = await pool.query(
    `SELECT * FROM subscriptions WHERE client_id = $1 ORDER BY next_renewal_date IS NULL, next_renewal_date, name`,
    [clientId]
  );
  return rows;
}

async function listAll() {
  const { rows } = await pool.query(
    `SELECT * FROM subscriptions ORDER BY next_renewal_date IS NULL, next_renewal_date, name`
  );
  return rows;
}

async function getById(id) {
  const { rows } = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ clientId, name, description, cost, currency, nextRenewalDate }) {
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (client_id, name, description, cost, currency, next_renewal_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [clientId, name, description || null, cost === '' || cost === undefined ? null : cost, currency || 'USD', nextRenewalDate || null]
  );
  return rows[0];
}

async function update(id, { name, description, cost, currency, nextRenewalDate, status }) {
  const sets = [];
  const values = [];
  let i = 1;
  const push = (col, val) => { sets.push(`${col} = $${i++}`); values.push(val); };
  if (name !== undefined) push('name', name);
  if (description !== undefined) push('description', description);
  if (cost !== undefined) push('cost', cost === '' ? null : cost);
  if (currency !== undefined) push('currency', currency);
  if (nextRenewalDate !== undefined) push('next_renewal_date', nextRenewalDate || null);
  if (status !== undefined) push('status', status);
  if (sets.length === 0) return getById(id);
  sets.push("updated_at = datetime('now')");
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE subscriptions SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function remove(id) {
  await pool.query('DELETE FROM subscriptions WHERE id = $1', [id]);
}

module.exports = { listForClient, listAll, getById, create, update, remove };
