const { pool } = require('../db/pool');

async function listNoticesPage({ limit, offset }) {
  const { rows } = await pool.query(
    `SELECT * FROM notices ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await pool.query('SELECT COUNT(*) AS count FROM notices');
  return { items: rows, totalItems: parseInt(countRows[0].count, 10) };
}

async function getNotice(id) {
  const { rows } = await pool.query('SELECT * FROM notices WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createNotice({ title, body, linkUrl, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO notices (title, body, link_url, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
    [title, body, linkUrl || null, createdBy]
  );
  return rows[0];
}

async function updateNotice(id, { title, body, linkUrl }) {
  const sets = [];
  const values = [];
  let i = 1;
  if (title !== undefined) {
    sets.push(`title = $${i++}`);
    values.push(title);
  }
  if (body !== undefined) {
    sets.push(`body = $${i++}`);
    values.push(body);
  }
  if (linkUrl !== undefined) {
    sets.push(`link_url = $${i++}`);
    values.push(linkUrl || null);
  }
  if (sets.length === 0) return getNotice(id);
  sets.push("updated_at = datetime('now')");
  values.push(id);
  const { rows } = await pool.query(
    `UPDATE notices SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function deleteNotice(id) {
  await pool.query('DELETE FROM notices WHERE id = $1', [id]);
}

module.exports = { listNoticesPage, getNotice, createNotice, updateNotice, deleteNotice };
