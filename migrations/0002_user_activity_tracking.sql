CREATE TABLE user_activities (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES users(id),
    activity_type TEXT NOT NULL,
    status TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    geolocation JSONB,
    device_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add indices for better query performance
CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_activity_type ON user_activities(activity_type);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at);

-- Update users table to add additional tracking fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login_city TEXT,
ADD COLUMN IF NOT EXISTS last_login_country TEXT,
ADD COLUMN IF NOT EXISTS last_login_browser TEXT,
ADD COLUMN IF NOT EXISTS last_login_os TEXT,
ADD COLUMN IF NOT EXISTS last_login_device TEXT;