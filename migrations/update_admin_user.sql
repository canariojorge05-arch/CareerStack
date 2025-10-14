-- Update admin user with correct column names
UPDATE users 
SET 
    email_verified = true,
    role = 'admin',
    email_verification_token = NULL,
    email_verification_expires = NULL,
    updated_at = NOW(),
    last_login_at = NOW()
WHERE email = '12shivamtiwari219@gmail.com';

-- Log the update
DO $$
BEGIN
    RAISE NOTICE 'Admin user update completed';
END $$;