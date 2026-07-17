-- Persistent session storage so logged-in users stay signed in on their
-- device across server restarts/deploys, not just across page loads. Without
-- this, sessions live only in server memory (MemoryStore) and vanish the
-- moment the process restarts, silently signing everyone out.
CREATE TABLE sessions (
    sid        TEXT PRIMARY KEY,
    sess       TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
