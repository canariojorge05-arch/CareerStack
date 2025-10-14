-- Update admin user approval status and required fields
UPDATE users 
SET 
    email_verified = true,
    is_approved = true,
    approved_at = NOW(),
    role = 'admin',
    email_verification_token = NULL,
    email_verification_expires = NULL,
    last_login_at = NOW()
WHERE email = '12shivamtiwari219@gmail.com';

-- Log the update
DO $$
BEGIN
    RAISE NOTICE 'Admin user approval completed:';
    RAISE NOTICE '  - User verified and approved';
    RAISE NOTICE '  - Admin role assigned';
    RAISE NOTICE '  - Email verified';
END $$;