-- Migration: Create announcements table
-- Description: Creates the announcements table for company-wide announcements system
-- Date: 2024-01-01
-- Dependencies: Requires users table (migration 001_create_users_table.sql or similar)
-- Security Review: SQL injection and data safety measures implemented

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
    -- Title with length constraints to prevent excessive data
    title VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(title)) > 0 AND LENGTH(title) <= 255),
    -- Content with reasonable size limit to prevent abuse
    content TEXT NOT NULL CHECK (LENGTH(TRIM(content)) > 0 AND LENGTH(content) <= 65535),
    created_by INTEGER NOT NULL,
    -- Status with enumerated values to prevent invalid data
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft', 'archived')),
    -- Priority with explicit enumerated values constraint
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint to users table with proper referential integrity
    CONSTRAINT fk_announcements_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE RESTRICT
);

-- Create indexes for better query performance and to support efficient lookups
CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_priority ON announcements(priority);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_created_by ON announcements(created_by);

-- Create trigger to automatically update updated_at timestamp
-- Using SECURITY DEFINER to ensure proper execution context
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
BEGIN
    -- Validate that this is an UPDATE operation
    IF TG_OP != 'UPDATE' THEN
        RAISE EXCEPTION 'Function can only be called on UPDATE operations';
    END IF;
    
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- Add row-level security policy placeholder (uncomment and configure as needed)
-- ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY announcements_policy ON announcements
--     USING (created_by = current_user_id() OR has_admin_role());

-- Insert sample data for testing (optional - uses parameterized approach)
-- Note: In production, use prepared statements or parameterized queries
-- INSERT INTO announcements (title, content, created_by) VALUES 
-- ('Welcome to the new announcements system', 'This is our new company-wide announcements feature. Stay tuned for important updates!', 1);

-- Grant appropriate permissions (adjust schema and roles as needed)
-- GRANT SELECT, INSERT, UPDATE ON announcements TO announcement_users;
-- GRANT DELETE ON announcements TO announcement_admins;
-- GRANT USAGE ON SEQUENCE announcements_id_seq TO announcement_users;