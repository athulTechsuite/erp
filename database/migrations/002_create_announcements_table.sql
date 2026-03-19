-- Migration: Create announcements table
-- Description: Creates the announcements table to support company-wide announcements system
-- with automatic archiving functionality based on expiration dates

CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1 CHECK (priority IN (1, 2, 3)), -- 1=low, 2=medium, 3=high
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_announcements_active ON announcements(is_active, is_archived);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_expires_at ON announcements(expires_at);
CREATE INDEX idx_announcements_created_by ON announcements(created_by);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- Create a function to automatically archive expired announcements
CREATE OR REPLACE FUNCTION archive_expired_announcements()
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    UPDATE announcements 
    SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP
    WHERE expires_at IS NOT NULL 
    AND expires_at < CURRENT_TIMESTAMP 
    AND is_archived = FALSE;
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ language 'plpgsql';

-- Note: Initial test announcement removed to avoid hard-coded user ID dependency
-- Add test data through application seeding or after confirming admin user exists

-- Add comment to table for documentation
COMMENT ON TABLE announcements IS 'Stores company-wide announcements with automatic archiving functionality';
COMMENT ON COLUMN announcements.priority IS '1=low, 2=medium, 3=high priority level (validated by CHECK constraint)';
COMMENT ON COLUMN announcements.expires_at IS 'Null means announcement never expires';
COMMENT ON COLUMN announcements.is_archived IS 'Automatically set to true when expires_at is reached';
COMMENT ON COLUMN announcements.is_active IS 'Manual toggle for admin to activate/deactivate announcements';