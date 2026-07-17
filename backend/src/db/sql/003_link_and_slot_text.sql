ALTER TABLE notices ADD COLUMN link_url TEXT;
ALTER TABLE messages ADD COLUMN link_url TEXT;
ALTER TABLE message_audio_slots ADD COLUMN slot_title VARCHAR(255);
ALTER TABLE message_audio_slots ADD COLUMN slot_body TEXT;
