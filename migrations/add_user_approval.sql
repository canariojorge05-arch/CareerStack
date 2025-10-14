-- Add approval status columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status varchar DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by varchar;

-- Update the admin user
UPDATE users 
SET 
    email_verified = true,
    approval_status = 'approved',
    approved_at = NOW(),
    approved_by = id, -- Self-approved as first admin
    role = 'admin'
WHERE email = '12shivamtiwari219@gmail.com';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'User approval system migration completed:';
    RAISE NOTICE '  - Added approval status columns';
    RAISE NOTICE '  - Updated admin user';
    RAISE NOTICE '  - Created approval status index';
END $$;