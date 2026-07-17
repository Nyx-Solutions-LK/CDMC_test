-- One quota row per client. quota_total is in "hours" (or any consistent
-- unit the admin decides on) — the requests table below tracks how much of
-- it each request consumed.
CREATE TABLE maintenance_quotas (
    client_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    quota_total NUMERIC NOT NULL DEFAULT 0,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE maintenance_requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject       VARCHAR(255) NOT NULL,
    description   TEXT,
    hours_used    NUMERIC NOT NULL DEFAULT 0,
    status        VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
    created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at   TEXT
);

CREATE INDEX idx_maintenance_requests_client_id ON maintenance_requests (client_id);
