-- Marks the very first (seeded) admin account so it can never be disabled
-- or demoted/deleted from the admin panel, even once other admins exist.
ALTER TABLE users ADD COLUMN is_primary_admin INTEGER NOT NULL DEFAULT 0;
