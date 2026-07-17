-- Stores each user's password encrypted (reversible), alongside the
-- existing one-way bcrypt hash used for actual login checks. This exists
-- only so admin CSV exports can include a user's real current password
-- without resetting it. See src/auth/passwords.js for the trade-off this
-- represents and why it was added.
ALTER TABLE users ADD COLUMN password_encrypted TEXT;
