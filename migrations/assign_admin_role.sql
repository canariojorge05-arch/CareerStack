-- Assign admin role to specific email
UPDATE users 
SET role = 'admin' 
WHERE email = '12shivamtiwari219@gmail.com';

-- Create index on role for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO current_user;