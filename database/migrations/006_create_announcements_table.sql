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
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Data integrity constraints
    CONSTRAINT chk_announcements_title_length 
        CHECK (LENGTH(TRIM(title)) >= 1 AND LENGTH(TRIM(title)) <= 255),
    CONSTRAINT chk_announcements_content_length 
        CHECK (LENGTH(TRIM(content)) >= 1 AND LENGTH(TRIM(content)) <= 100000),
    CONSTRAINT chk_announcements_created_by_positive 
        CHECK (created_by > 0),
    CONSTRAINT chk_announcements_created_at_valid 
        CHECK (created_at <= CURRENT_TIMESTAMP),
    CONSTRAINT chk_announcements_updated_at_valid 
        CHECK (updated_at >= created_at),
    CONSTRAINT chk_announcements_title_not_empty 
        CHECK (title IS NOT NULL AND title !~ '^[[:space:]]*$'),
    CONSTRAINT chk_announcements_content_not_empty 
        CHECK (content IS NOT NULL AND content !~ '^[[:space:]]*$'),
    
    -- Foreign key constraint to users table with data integrity protection
    CONSTRAINT fk_announcements_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Create indexes for better query performance and data access optimization
CREATE INDEX idx_announcements_is_active ON announcements(is_active);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_created_by ON announcements(created_by);
CREATE INDEX idx_announcements_active_created_at ON announcements(is_active, created_at DESC) WHERE is_active = true;

-- Create trigger to automatically update updated_at timestamp with validation
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate that updated_at is not being set to a past date relative to created_at
    IF NEW.updated_at < OLD.created_at THEN
        RAISE EXCEPTION 'Updated timestamp cannot be earlier than created timestamp';
    END IF;
    
    -- Validate that updated_at is not set to a future date beyond reasonable bounds
    IF NEW.updated_at > CURRENT_TIMESTAMP + INTERVAL '1 hour' THEN
        RAISE EXCEPTION 'Updated timestamp cannot be more than 1 hour in the future';
    END IF;
    
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- Create function to safely insert announcements with input validation
CREATE OR REPLACE FUNCTION safe_insert_announcement(
    p_title VARCHAR(255),
    p_content TEXT,
    p_created_by INTEGER
) RETURNS INTEGER AS $$
DECLARE
    announcement_id INTEGER;
BEGIN
    -- Input validation to prevent SQL injection and ensure data integrity
    IF p_title IS NULL OR LENGTH(TRIM(p_title)) = 0 THEN
        RAISE EXCEPTION 'Title cannot be null or empty';
    END IF;
    
    IF p_content IS NULL OR LENGTH(TRIM(p_content)) = 0 THEN
        RAISE EXCEPTION 'Content cannot be null or empty';
    END IF;
    
    IF p_created_by IS NULL OR p_created_by <= 0 THEN
        RAISE EXCEPTION 'Created by user ID must be a positive integer';
    END IF;
    
    -- Verify user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_created_by) THEN
        RAISE EXCEPTION 'User with ID % does not exist', p_created_by;
    END IF;
    
    -- Insert with sanitized data
    INSERT INTO announcements (title, content, created_by) 
    VALUES (TRIM(p_title), TRIM(p_content), p_created_by)
    RETURNING id INTO announcement_id;
    
    RETURN announcement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant appropriate permissions for security
REVOKE ALL ON announcements FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON announcements TO authenticated_users;
GRANT USAGE ON SEQUENCE announcements_id_seq TO authenticated_users;

-- Insert sample data for testing (optional) using safe insertion method
-- SELECT safe_insert_announcement(
--     'Welcome to the new announcements system', 
--     'This is our new company-wide announcements feature. Stay tuned for important updates!', 
--     1
-- );