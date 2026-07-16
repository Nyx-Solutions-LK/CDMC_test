-- Messages no longer carry their own title/body/link — all content lives on
-- the (up to 3) per-language slots instead. Audio within a slot becomes
-- fully optional (a slot can be text-only).

CREATE TABLE messages_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO messages_new (id, created_by, created_at, updated_at)
    SELECT id, created_by, created_at, updated_at FROM messages;

CREATE TABLE message_audio_slots_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id      INTEGER      NOT NULL REFERENCES messages_new(id) ON DELETE CASCADE,
    language_label  VARCHAR(64)  NOT NULL,
    slot_title      VARCHAR(255) NOT NULL DEFAULT '',
    slot_body       TEXT         NOT NULL DEFAULT '',
    source_type     VARCHAR(16)  CHECK (source_type IS NULL OR source_type IN ('upload', 'url')),
    audio_data      BLOB,
    audio_mime_type VARCHAR(100),
    audio_filename  VARCHAR(255),
    external_url    TEXT,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    created_at      TEXT         NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT         NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT chk_slot_source CHECK (
        source_type IS NULL
        OR (source_type = 'upload' AND audio_data IS NOT NULL AND external_url IS NULL)
        OR (source_type = 'url' AND external_url IS NOT NULL AND audio_data IS NULL)
    )
);

INSERT INTO message_audio_slots_new
    (id, message_id, language_label, slot_title, slot_body, source_type,
     audio_data, audio_mime_type, audio_filename, external_url, sort_order,
     created_at, updated_at)
    SELECT id, message_id, language_label,
           COALESCE(slot_title, ''), COALESCE(slot_body, ''), source_type,
           audio_data, audio_mime_type, audio_filename, external_url, sort_order,
           created_at, updated_at
    FROM message_audio_slots;

DROP TABLE message_audio_slots;
DROP TABLE messages;

ALTER TABLE messages_new RENAME TO messages;
ALTER TABLE message_audio_slots_new RENAME TO message_audio_slots;

CREATE INDEX idx_messages_created_at ON messages (created_at DESC);
CREATE INDEX idx_message_audio_slots_message_id ON message_audio_slots (message_id);
