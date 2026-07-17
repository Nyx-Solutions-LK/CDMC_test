const { pool } = require('../db/pool');

async function attachItems(invoices) {
  if (invoices.length === 0) return [];
  const ids = invoices.map((i) => i.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const { rows: items } = await pool.query(
    `SELECT * FROM invoice_items WHERE invoice_id IN (${placeholders}) ORDER BY sort_order, id`,
    ids
  );
  const byInvoice = new Map();
  for (const item of items) {
    if (!byInvoice.has(item.invoice_id)) byInvoice.set(item.invoice_id, []);
    byInvoice.get(item.invoice_id).push(item);
  }
  return invoices.map((inv) => ({ ...inv, items: byInvoice.get(inv.id) || [] }));
}

async function listForClient(clientId) {
  const { rows } = await pool.query(
    `SELECT * FROM invoices WHERE client_id = $1 AND status != 'draft' ORDER BY created_at DESC`,
    [clientId]
  );
  return attachItems(rows);
}

async function listAll() {
  const { rows } = await pool.query(`SELECT * FROM invoices ORDER BY created_at DESC`);
  return attachItems(rows);
}

async function getById(id) {
  const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const [full] = await attachItems(rows);
  return full;
}

async function create({ clientId, periodStart, periodEnd, dueDate, currency, notes, items, createdBy }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO invoices (client_id, period_start, period_end, due_date, currency, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [clientId, periodStart, periodEnd, dueDate, currency || 'USD', notes || null, createdBy]
    );
    const invoice = rows[0];
    let sortOrder = 0;
    for (const item of items || []) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, description, amount, source_type, source_id, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [invoice.id, item.description, item.amount, item.sourceType || 'custom', item.sourceId || null, sortOrder++]
      );
    }
    await client.query('COMMIT');
    return getById(invoice.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function update(id, { periodStart, periodEnd, dueDate, currency, notes, items }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sets = [];
    const values = [];
    let i = 1;
    const push = (col, val) => { sets.push(`${col} = $${i++}`); values.push(val); };
    if (periodStart !== undefined) push('period_start', periodStart);
    if (periodEnd !== undefined) push('period_end', periodEnd);
    if (dueDate !== undefined) push('due_date', dueDate);
    if (currency !== undefined) push('currency', currency);
    if (notes !== undefined) push('notes', notes);
    if (sets.length > 0) {
      values.push(id);
      await client.query(`UPDATE invoices SET ${sets.join(', ')} WHERE id = $${i}`, values);
    }
    if (items !== undefined) {
      await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);
      let sortOrder = 0;
      for (const item of items) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, amount, source_type, source_id, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, item.description, item.amount, item.sourceType || 'custom', item.sourceId || null, sortOrder++]
        );
      }
    }
    await client.query('COMMIT');
    return getById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function setStatus(id, status, extraField) {
  const extra = extraField ? `, ${extraField} = datetime('now')` : '';
  const { rows } = await pool.query(
    `UPDATE invoices SET status = $1${extra} WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0] || null;
}

async function markViewed(id) {
  await pool.query(
    `UPDATE invoices SET viewed_at = datetime('now') WHERE id = $1 AND viewed_at IS NULL`,
    [id]
  );
}

async function remove(id) {
  await pool.query('DELETE FROM invoices WHERE id = $1', [id]);
}

module.exports = { listForClient, listAll, getById, create, update, setStatus, markViewed, remove };
