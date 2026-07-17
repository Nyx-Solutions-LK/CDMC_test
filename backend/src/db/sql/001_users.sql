CREATE TABLE users (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    username              VARCHAR(64)  NOT NULL UNIQUE,
    email                 VARCHAR(255) NOT NULL UNIQUE,
    company_name          VARCHAR(255),
    role                  VARCHAR(16)  NOT NULL DEFAULT 'client' CHECK (role IN ('client','admin')),
    password_hash         TEXT         NOT NULL,
    must_change_password  INTEGER      NOT NULL DEFAULT 1,
    is_disabled           INTEGER      NOT NULL DEFAULT 0,
    created_at            TEXT         NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT         NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_role ON users (role);

CREATE TABLE sessions (
    sid        TEXT PRIMARY KEY,
    sess       TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
