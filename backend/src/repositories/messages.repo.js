const { pool } = require('../db/pool');

const MAX_SLOTS = 3;

async function attachSlots(messages) {
  if (messages.length === 0) return messages;
  const ids = messages.map((m) => m.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const { rows: slots } = await pool.query(
    `SELECT id, message_id, language_label, slot_title, slot_body, source_type,
            audio_mime_type, audio_filename, external_url, sort_order
     FROM message_audio_slots WHERE message_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`,
    ids
  );
  const byMessage = new Map();
  for (const slot of slots) {
    if (!byMessage.has(slot.message_id)) byMessage.set(slot.message_id, []);
    byMessage.get(slot.message_id).push(slot);
  }
  return messages.map((m) => ({ ...m, slots: byMessage.get(m.id) || [] }));
}

async function listMessagesPage({ limit, offset, includeScheduled }) {
  const visibilityClause = includeScheduled
    ? ''
    : `WHERE scheduled_at IS NULL OR strftime('%s', scheduled_at) <= strftime('%s', 'now')`;
  const { rows } = await pool.query(
    `SELECT * FROM messages ${visibilityClause}
     ORDER BY strftime('%s', COALESCE(scheduled_at, created_at)) DESC, id DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS count FROM messages ${visibilityClause}`
  );
  const items = await attachSlots(rows);
  return { items, totalItems: parseInt(countRows[0].count, 10) };
}

async function getMessage(id) {
  const { rows } = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const [withSlots] = await attachSlots([rows[0]]);
  return withSlots;
}

// slots: array of exactly MAX_SLOTS entries, each
// { languageLabel, title, body, audio: undefined | { sourceType, audioData?, audioMimeType?, audioFilename?, externalUrl? } }
// scheduledAt: null (publish immediately) | UTC ISO string (hidden from non-admins until then)
async function createMessage({ createdBy, slots, scheduledAt }) {
  if (slots.length !== MAX_SLOTS) {
    throw new Error(`A message must have exactly ${MAX_SLOTS} language slots`);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO messages (created_by, scheduled_at) VALUES ($1, $2) RETURNING *`,
      [createdBy, scheduledAt || null]
    );
    const message = rows[0];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const audio = slot.audio;
      await client.query(
        `INSERT INTO message_audio_slots
          (message_id, language_label, slot_title, slot_body, source_type, audio_data, audio_mime_type, audio_filename, external_url, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          message.id,
          slot.languageLabel,
          slot.title,
          slot.body,
          audio ? audio.sourceType : null,
          audio && audio.sourceType === 'upload' ? audio.audioData : null,
          audio && audio.sourceType === 'upload' ? audio.audioMimeType : null,
          audio && audio.sourceType === 'upload' ? audio.audioFilename : null,
          audio && audio.sourceType === 'url' ? audio.externalUrl : null,
          i,
        ]
      );
    }
    await client.query('COMMIT');
    return getMessage(message.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// slots: array of { sortOrder, languageLabel, title, body, audioUpdate }
// audioUpdate: undefined (leave audio as-is) | 'remove' | { sourceType, audioData?, audioMimeType?, audioFilename?, externalUrl? }
// scheduledAt: undefined (leave unchanged) | null (publish now / clear schedule) | UTC ISO string
async function updateMessage(id, { slots, scheduledAt }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const slot of slots) {
      const sets = ['language_label = $1', 'slot_title = $2', 'slot_body = $3', "updated_at = datetime('now')"];
      const values = [slot.languageLabel, slot.title, slot.body];
      let i = 4;
      if (slot.audioUpdate === 'remove') {
        sets.push('source_type = NULL', 'audio_data = NULL', 'audio_mime_type = NULL', 'audio_filename = NULL', 'external_url = NULL');
      } else if (slot.audioUpdate) {
        const a = slot.audioUpdate;
        sets.push(`source_type = $${i++}`);
        values.push(a.sourceType);
        sets.push(`audio_data = $${i++}`);
        values.push(a.sourceType === 'upload' ? a.audioData : null);
        sets.push(`audio_mime_type = $${i++}`);
        values.push(a.sourceType === 'upload' ? a.audioMimeType : null);
        sets.push(`audio_filename = $${i++}`);
        values.push(a.sourceType === 'upload' ? a.audioFilename : null);
        sets.push(`external_url = $${i++}`);
        values.push(a.sourceType === 'url' ? a.externalUrl : null);
      }
      values.push(id, slot.sortOrder);
      await client.query(
        `UPDATE message_audio_slots SET ${sets.join(', ')} WHERE message_id = $${i++} AND sort_order = $${i}`,
        values
      );
    }
    if (scheduledAt !== undefined) {
      await client.query(`UPDATE messages SET scheduled_at = $1, updated_at = datetime('now') WHERE id = $2`, [
        scheduledAt,
        id,
      ]);
    } else {
      await client.query("UPDATE messages SET updated_at = datetime('now') WHERE id = $1", [id]);
    }
    await client.query('COMMIT');
    return getMessage(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteMessage(id) {
  await pool.query('DELETE FROM messages WHERE id = $1', [id]);
}

async function getSlotAudio(messageId, slotId) {
  const { rows } = await pool.query(
    `SELECT audio_data, audio_mime_type, audio_filename, source_type
     FROM message_audio_slots WHERE id = $1 AND message_id = $2`,
    [slotId, messageId]
  );
  return rows[0] || null;
}

async function markMessageRead(messageId, userId) {
  // INSERT ... ON CONFLICT DO NOTHING: marking read is idempotent — a
  // second click (or a duplicate request) shouldn't move the timestamp or
  // error.
  await pool.query(
    `INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2)
     ON CONFLICT (message_id, user_id) DO NOTHING`,
    [messageId, userId]
  );
  const { rows } = await pool.query(
    `SELECT read_at FROM message_reads WHERE message_id = $1 AND user_id = $2`,
    [messageId, userId]
  );
  return rows[0] ? rows[0].read_at : null;
}

// Returns a Map<messageId, readAtIso> for every message in `messageIds` that
// `userId` has read — used to flag "already read" on the messages list.
async function getReadMapForUser(userId, messageIds) {
  const map = new Map();
  if (messageIds.length === 0) return map;
  const placeholders = messageIds.map((_, i) => `$${i + 2}`).join(', ');
  const { rows } = await pool.query(
    `SELECT message_id, read_at FROM message_reads
     WHERE user_id = $1 AND message_id IN (${placeholders})`,
    [userId, ...messageIds]
  );
  for (const row of rows) map.set(row.message_id, row.read_at);
  return map;
}

// Everyone (any role) who has read this message, most-recent first — used by
// the admin "analytics" button.
async function getReadersForMessage(messageId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.email, u.role, mr.read_at
     FROM message_reads mr
     JOIN users u ON u.id = mr.user_id
     WHERE mr.message_id = $1
     ORDER BY mr.read_at DESC`,
    [messageId]
  );
  return rows;
}

module.exports = {
  MAX_SLOTS,
  listMessagesPage,
  getMessage,
  createMessage,
  updateMessage,
  deleteMessage,
  getSlotAudio,
  markMessageRead,
  getReadMapForUser,
  getReadersForMessage,
};
