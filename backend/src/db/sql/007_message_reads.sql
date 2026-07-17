-- Tracks which users have marked a message as read ("tick" button on the
-- Messages page) so admins can see read receipts via the analytics button.
CREATE TABLE message_reads (
    message_id  INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX idx_message_reads_message_id ON message_reads (message_id);
CREATE INDEX idx_message_reads_user_id ON message_reads (user_id);
