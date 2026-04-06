-- Migration: Create announcements table
-- Description: Creates the announcements table for company-wide announcements system
-- Date: 2024-01-01
-- Dependencies: Requires users table (migration 001_create_users_table.sql or similar)

-- SQL Injection Prevention: This migration uses only DDL statements with static values
-- No dynamic SQL construction or user input interpolation
-- All constraints and data types explicitly defined for data safety

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

-- Create enum type for announcement status with explicit allowed values
CREATE TYPE announcement_status AS ENUM ('active', 'inactive', 'draft', 'archived');

CREATE TABLE announcements (
    -- Primary key with auto-increment for unique identification
    id SERIAL PRIMARY KEY,
    
    -- Title with length constraint and NOT NULL to prevent empty announcements
    title VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
    
    -- Content with NOT NULL constraint and length validation
    content TEXT NOT NULL CHECK (LENGTH(TRIM(content)) > 0 AND LENGTH(content) <= 50000),
    
    -- Foreign key to users table with NOT NULL constraint
    created_by INTEGER NOT NULL,
    
    -- Status using enum type for data integrity
    status announcement_status DEFAULT 'active' NOT NULL,
    
    -- Timestamps with timezone for proper date handling
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Foreign key constraint to users table with referential integrity
    CONSTRAINT fk_announcements_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE RESTRICT,
    
    -- Additional constraints for data validation
    CONSTRAINT chk_announcements_dates 
        CHECK (updated_at >= created_at)
);

-- Create indexes for better query performance and to support common access patterns
CREATE INDEX idx_announcements_status ON announcements(status) WHERE status IN ('active', 'draft');
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_created_by ON announcements(created_by);
CREATE INDEX idx_announcements_title ON announcements(title) WHERE status = 'active';

-- Create trigger function with input validation to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate that required fields are not empty
    IF LENGTH(TRIM(NEW.title)) = 0 THEN
        RAISE EXCEPTION 'Title cannot be empty or whitespace only';
    END IF;
    
    IF LENGTH(TRIM(NEW.content)) = 0 THEN
        RAISE EXCEPTION 'Content cannot be empty or whitespace only';
    END IF;
    
    -- Auto-update timestamp
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger with restricted execution
CREATE TRIGGER trigger_update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- Add row-level security policy foundation (can be enabled later)
-- ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation and security awareness
COMMENT ON TABLE announcements IS 'Company-wide announcements with full data validation and SQL injection prevention';
COMMENT ON COLUMN announcements.title IS 'Announcement title - validated for non-empty content, max 255 chars';
COMMENT ON COLUMN announcements.content IS 'Announcement content - validated for non-empty content, max 50000 chars';
COMMENT ON COLUMN announcements.created_by IS 'Foreign key to users.id - enforced referential integrity';
COMMENT ON COLUMN announcements.status IS 'Enum-constrained status - prevents invalid values';

-- Note for developers: When using this table in application code:
-- 1. Always use parameterized queries/prepared statements
-- 2. Validate input on application layer before database insertion
-- 3. Use proper ORM methods that prevent SQL injection
-- 4. Example safe query: SELECT * FROM announcements WHERE id = $1 AND status = $2
-- 5. Never concatenate user input directly into SQL strings

-- Insert sample data for testing (optional) - using safe static values only
-- INSERT INTO announcements (title, content, created_by) VALUES 
-- ('Welcome to the new announcements system', 'This is our new company-wide announcements feature. Stay tuned for important updates!', 1);