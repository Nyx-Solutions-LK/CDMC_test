CREATE TABLE invoices (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start   TEXT NOT NULL,
    period_end     TEXT NOT NULL,
    due_date       TEXT NOT NULL,
    currency       VARCHAR(8) NOT NULL DEFAULT 'USD',
    notes          TEXT,
    status         VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paid')),
    created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    published_at   TEXT,
    paid_at        TEXT,
    viewed_at      TEXT
);

CREATE TABLE invoice_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id    INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description   VARCHAR(255) NOT NULL,
    amount        NUMERIC NOT NULL,
    source_type   VARCHAR(16) NOT NULL DEFAULT 'custom' CHECK (source_type IN ('subscription','maintenance','custom')),
    source_id     INTEGER,
    sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_invoices_client_id ON invoices (client_id);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items (invoice_id);
