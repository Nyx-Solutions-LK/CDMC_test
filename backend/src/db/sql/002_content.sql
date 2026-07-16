CREATE TABLE notices (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       VARCHAR(255) NOT NULL,
    body        TEXT         NOT NULL,
    created_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT         NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT         NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notices_created_at ON notices (created_at DESC);

CREATE TABLE messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       VARCHAR(255) NOT NULL,
    body        TEXT,
    created_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT         NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT         NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_messages_created_at ON messages (created_at DESC);

CREATE TABLE message_audio_slots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id      INTEGER      NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    language_label  VARCHAR(64)  NOT NULL,
    source_type     VARCHAR(16)  NOT NULL CHECK (source_type IN ('upload', 'url')),
    audio_data      BLOB,
    audio_mime_type VARCHAR(100),
    audio_filename  VARCHAR(255),
    external_url    TEXT,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    created_at      TEXT         NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT         NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT chk_slot_source CHECK (
        (source_type = 'upload' AND audio_data IS NOT NULL AND external_url IS NULL)
        OR
        (source_type = 'url' AND external_url IS NOT NULL AND audio_data IS NULL)
    )
);

CREATE INDEX idx_message_audio_slots_message_id ON message_audio_slots (message_id);
