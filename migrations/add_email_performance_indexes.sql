-- Add historyId column for Gmail incremental sync
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS history_id VARCHAR(255);

-- Update default sync_frequency to 15 seconds
ALTER TABLE email_accounts ALTER COLUMN sync_frequency SET DEFAULT 15;

-- Performance indexes for email operations
CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON email_messages(email_account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_external_id ON email_messages(external_message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_read_status ON email_messages(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_email_messages_starred ON email_messages(is_starred) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_email_messages_account_thread ON email_messages(email_account_id, thread_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_threads_user_archive ON email_threads(created_by, is_archived);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message ON email_threads(created_by, last_message_at DESC);

-- Index for email accounts sync operations
CREATE INDEX IF NOT EXISTS idx_email_accounts_sync ON email_accounts(user_id, is_active, sync_enabled) WHERE is_active = true AND sync_enabled = true;
CREATE INDEX IF NOT EXISTS idx_email_accounts_history ON email_accounts(history_id) WHERE history_id IS NOT NULL;

-- Index for faster message counting
CREATE INDEX IF NOT EXISTS idx_email_messages_count ON email_messages(thread_id, created_at);

-- Optimize email attachments lookup
CREATE INDEX IF NOT EXISTS idx_email_attachments_size ON email_attachments(message_id, file_size);

-- Comment on optimizations
COMMENT ON INDEX idx_email_messages_account_id IS 'Fast lookup of messages by account for sync operations';
COMMENT ON INDEX idx_email_messages_external_id IS 'Prevent duplicate messages during sync';
COMMENT ON INDEX idx_email_messages_read_status IS 'Quick filtering of unread messages';
COMMENT ON INDEX idx_email_threads_last_message IS 'Efficient sorting of inbox by recency';
COMMENT ON INDEX idx_email_accounts_sync IS 'Ultra-fast lookup of accounts that need syncing';
