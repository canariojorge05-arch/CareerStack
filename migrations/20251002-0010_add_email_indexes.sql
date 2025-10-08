-- Migration: add indexes to improve unread-count queries and email lookups
-- Date: 2025-10-02

-- Index on email_messages.is_read to speed up unread message scans
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages (is_read);

-- Index on email_messages.email_account_id for per-account aggregations
CREATE INDEX IF NOT EXISTS idx_email_messages_email_account_id ON email_messages (email_account_id);

-- Composite index on email_threads (created_by, is_archived) to speed up thread filters
CREATE INDEX IF NOT EXISTS idx_email_threads_created_by_archived ON email_threads (created_by, is_archived);

-- Optional: index on email_messages.thread_id already exists, but ensure it's present
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages (thread_id);

-- Consider adding partial index for unread messages only (Postgres): uncomment if desired
-- CREATE INDEX IF NOT EXISTS idx_email_messages_unread_only ON email_messages (thread_id) WHERE is_read = FALSE;
