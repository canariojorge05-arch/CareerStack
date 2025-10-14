-- Approve and verify the admin user
UPDATE users 
SET 
    is_verified = true,
    is_approved = true,
    role = 'admin',
    email_verified_at = NOW(),
    approved_at = NOW(),
    updated_at = NOW()
WHERE email = '12shivamtiwari219@gmail.com';

-- Log the update
DO $$
BEGIN
    RAISE NOTICE 'Admin user approval completed:';
    RAISE NOTICE '  - User verified and approved';
    RAISE NOTICE '  - Admin role assigned';
    RAISE NOTICE '  - Email verified';
END $$;