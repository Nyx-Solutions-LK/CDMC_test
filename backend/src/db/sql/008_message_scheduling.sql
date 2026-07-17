-- Optional future publish time for a message. NULL means "visible
-- immediately" (existing behavior). When set, the message stays hidden from
-- non-admins until this UTC instant, letting admins schedule a message for
-- a specific Sri Lanka (Asia/Colombo) date/time in advance.
ALTER TABLE messages ADD COLUMN scheduled_at TEXT;

CREATE INDEX idx_messages_scheduled_at ON messages (scheduled_at);
