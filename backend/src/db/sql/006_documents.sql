CREATE TABLE documents (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type     VARCHAR(100) NOT NULL,
    description  TEXT,
    filename     VARCHAR(255) NOT NULL,
    mime_type    VARCHAR(127) NOT NULL,
    file_data    BLOB NOT NULL,
    file_size    INTEGER NOT NULL,
    uploaded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_documents_client_id ON documents (client_id);
