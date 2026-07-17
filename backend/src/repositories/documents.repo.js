const { pool } = require('../db/pool');

const LIST_COLUMNS = 'id, client_id, doc_type, description, filename, mime_type, file_size, uploaded_by, created_at';

async function listForClient(clientId) {
  const { rows } = await pool.query(
    `SELECT ${LIST_COLUMNS} FROM documents WHERE client_id = $1 ORDER BY created_at DESC`,
    [clientId]
  );
  return rows;
}

async function listAll() {
  const { rows } = await pool.query(`SELECT ${LIST_COLUMNS} FROM documents ORDER BY created_at DESC`);
  return rows;
}

async function getWithFile(id) {
  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ clientId, docType, description, filename, mimeType, fileData, fileSize, uploadedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO documents (client_id, doc_type, description, filename, mime_type, file_data, file_size, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${LIST_COLUMNS}`,
    [clientId, docType, description || null, filename, mimeType, fileData, fileSize, uploadedBy]
  );
  return rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM documents WHERE id = $1', [id]);
}

module.exports = { listForClient, listAll, getWithFile, create, remove };
