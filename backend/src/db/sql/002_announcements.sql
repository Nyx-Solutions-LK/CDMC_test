-- audience_type='all' -> client_id is NULL and every client sees it.
-- audience_type='single' -> client_id names exactly which client sees it.
CREATE TABLE announcements (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          VARCHAR(255) NOT NULL,
    body           TEXT         NOT NULL,
    audience_type  VARCHAR(16)  NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all','single')),
    client_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_announcements_client_id ON announcements (client_id);
