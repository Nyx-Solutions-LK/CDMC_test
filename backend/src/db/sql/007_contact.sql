CREATE TABLE contact_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    message     TEXT NOT NULL,
    status      VARCHAR(16) NOT NULL DEFAULT 'new' CHECK (status IN ('new','read')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_contact_messages_status ON contact_messages (status);
