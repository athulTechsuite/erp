-- Migration: Create announcements table
-- Description: Creates the announcements table for company-wide announcements system
-- Date: 2024-01-01

-- UP MIGRATION
-- Verify users table exists before creating announcements table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Users table does not exist. Please run users migration first.';
    END IF;
END $$;

CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL CHECK (char_length(title) <= 200),
    content TEXT NOT NULL CHECK (char_length(content) <= 10000),
    created_by INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint to users table - properly implemented for referential integrity
    -- This constraint ensures data consistency by preventing orphaned records
    -- ON DELETE RESTRICT prevents deletion of users who have created announcements
    -- NOTE: Backend code MUST use parameterized queries when inserting/updating created_by
    -- to prevent SQL injection and ensure data integrity with this constraint
    CONSTRAINT fk_announcements_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE RESTRICT
);

-- Create indexes for better query performance
CREATE INDEX idx_announcements_is_active ON announcements(is_active);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_created_by ON announcements(created_by);

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

-- DOWN MIGRATION (ROLLBACK)
-- Uncomment the following section to rollback this migration:

/*
-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_update_announcements_updated_at ON announcements;
DROP FUNCTION IF EXISTS update_announcements_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_announcements_created_by;
DROP INDEX IF EXISTS idx_announcements_created_at;
DROP INDEX IF EXISTS idx_announcements_is_active;

-- Drop table
DROP TABLE IF EXISTS announcements;
*/