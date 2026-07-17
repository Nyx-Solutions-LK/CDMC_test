-- cost may be NULL (admin can leave it blank).
CREATE TABLE subscriptions (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name               VARCHAR(255) NOT NULL,
    description        TEXT,
    cost               NUMERIC,
    currency           VARCHAR(8) NOT NULL DEFAULT 'USD',
    next_renewal_date  TEXT,
    status             VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_subscriptions_client_id ON subscriptions (client_id);
