-- Migration: Create announcements table
-- Description: Creates the announcements table for company-wide announcements system
-- Date: 2024-01-01
-- Dependencies: Requires users table (migration 001_create_users_table.sql or similar)

-- Check if users table exists before creating foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) THEN
        RAISE EXCEPTION 'Users table does not exist. Please run the users table migration first.';
    END IF;
END $$;

CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint to users table
    CONSTRAINT fk_announcements_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE RESTRICT,
    
    -- Check constraint for status field
    CONSTRAINT chk_announcements_status 
        CHECK (status IN ('active', 'inactive', 'archived', 'draft')),
    
    -- Check constraint for title length
    CONSTRAINT chk_announcements_title_length 
        CHECK (LENGTH(TRIM(title)) > 0),
    
    -- Check constraint for content length
    CONSTRAINT chk_announcements_content_length 
        CHECK (LENGTH(TRIM(content)) > 0)
);

-- Create indexes for better query performance
CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_created_by ON announcements(created_by);
CREATE INDEX idx_announcements_title ON announcements(title);
CREATE INDEX idx_announcements_status_created_at ON announcements(status, created_at DESC);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- Insert sample data for testing (optional)
-- INSERT INTO announcements (title, content, created_by) VALUES 
-- ('Welcome to the new announcements system', 'This is our new company-wide announcements feature. Stay tuned for important updates!', 1);