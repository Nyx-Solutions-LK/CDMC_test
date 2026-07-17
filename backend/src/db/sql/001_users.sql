CREATE TABLE users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        VARCHAR(64)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    course_id       VARCHAR(128),
    phone_number    VARCHAR(32),
    role            VARCHAR(16)  NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    password_hash   TEXT         NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    is_disabled     INTEGER      NOT NULL DEFAULT 0,
    created_at      TEXT         NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT         NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_role ON users (role);
