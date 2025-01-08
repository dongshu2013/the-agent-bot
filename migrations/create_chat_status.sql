CREATE TABLE chat_status (
  chat_id BIGINT PRIMARY KEY,
  last_message_at BIGINT NOT NULL,
  pending_message_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying active chats
CREATE INDEX idx_chat_status_pending ON chat_status(pending_message_count) 