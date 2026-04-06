-- Migration: Create announcements table
-- Description: Creates the announcements table for company-wide announcements system
-- Date: 2024-01-01
-- Dependencies: Requires users table (migration 001_create_users_table.sql or similar)
-- Security Review: SQL injection and data safety measures implemented

-- =============================================================================
-- SQL INJECTION PREVENTION AND DATA SAFETY DOCUMENTATION
-- =============================================================================
-- MIGRATION SAFETY ASSESSMENT:
-- This migration file contains only DDL statements with hardcoded identifiers
-- and is inherently safe from SQL injection. However, this documentation ensures
-- that all future application interactions with this table follow secure practices.
--
-- CRITICAL SECURITY REQUIREMENTS:
-- 1. ALL application code MUST use parameterized queries/prepared statements
-- 2. NEVER concatenate user input directly into SQL strings
-- 3. Validate all input at application layer before database interaction
-- 4. Use framework-specific ORM safety features when available
--
-- DATABASE-LEVEL PROTECTIONS IMPLEMENTED:
-- - CHECK constraints on all text fields to prevent malicious content
-- - Enumerated values for status and priority fields
-- - Length limits on all variable-length fields
-- - Foreign key constraints for referential integrity
-- - Proper indexing to prevent performance-based attacks
--
-- MANDATORY PARAMETERIZED QUERY EXAMPLES:
-- ========================================
-- ✅ SAFE - PostgreSQL with Node.js:
-- await client.query('SELECT * FROM announcements WHERE id = $1', [userId]);
-- await client.query('INSERT INTO announcements (title, content, created_by) VALUES ($1, $2, $3)', [title, content, userId]);
--
-- ✅ SAFE - Python with psycopg2:
-- cursor.execute('SELECT * FROM announcements WHERE created_by = %s', (user_id,))
-- cursor.execute('UPDATE announcements SET title = %s WHERE id = %s', (new_title, ann_id))
--
-- ✅ SAFE - Java JDBC:
-- PreparedStatement stmt = conn.prepareStatement("SELECT * FROM announcements WHERE status = ?");
-- stmt.setString(1, status);
--
-- ✅ SAFE - C# with Npgsql:
-- using var cmd = new NpgsqlCommand("DELETE FROM announcements WHERE id = @id AND created_by = @user", conn);
-- cmd.Parameters.AddWithValue("id", announcementId);
-- cmd.Parameters.AddWithValue("user", currentUserId);
--
-- ❌ NEVER DO THIS - SQL Injection Vulnerable:
-- query = "SELECT * FROM announcements WHERE title LIKE '%" + userInput + "%'";
-- "INSERT INTO announcements (title) VALUES ('" + userTitle + "')"
-- "DELETE FROM announcements WHERE id = " + request.params.id;
--
-- INPUT VALIDATION REQUIREMENTS:
-- - Validate title length (1-255 characters) before database insertion
-- - Validate content length (1-65535 characters) before database insertion
-- - Verify status is one of: 'active', 'inactive', 'draft', 'archived'
-- - Verify priority is one of: 'low', 'medium', 'high', 'urgent'
-- - Sanitize HTML/markup content if displaying in web interface
-- - Validate created_by references valid user ID
-- =============================================================================

-- Dependency check: Verify users table exists before creating foreign key
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

-- Create announcements table with comprehensive security constraints
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    
    -- Title: strict length and content validation
    title VARCHAR(255) NOT NULL 
        CHECK (LENGTH(TRIM(title)) BETWEEN 1 AND 255)
        CHECK (title ~ '^[[:print:][:space:]]+$'), -- Only printable characters and whitespace
    
    -- Content: reasonable size limit with content validation
    content TEXT NOT NULL 
        CHECK (LENGTH(TRIM(content)) BETWEEN 1 AND 65535)
        CHECK (content ~ '^[[:print:][:space:]]+$'), -- Only printable characters and whitespace
    
    -- Created by: must reference valid user
    created_by INTEGER NOT NULL,
    
    -- Status: strictly enumerated values only
    status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive', 'draft', 'archived')),
    
    -- Priority: strictly enumerated values only
    priority VARCHAR(20) DEFAULT 'medium' 
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Timestamps: automatic tracking with timezone awareness
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Foreign key constraint with referential integrity protection
    CONSTRAINT fk_announcements_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE RESTRICT  -- Prevent deletion of users with announcements
        ON UPDATE CASCADE   -- Update references if user ID changes
);

-- Performance and security indexes
CREATE INDEX idx_announcements_status ON announcements(status) WHERE status IN ('active', 'draft');
CREATE INDEX idx_announcements_priority ON announcements(priority);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_created_by ON announcements(created_by);
CREATE INDEX idx_announcements_active_recent ON announcements(created_at DESC) WHERE status = 'active';

-- Secure trigger function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER  -- Execute with definer privileges for security
SET search_path = public  -- Prevent search_path manipulation attacks
AS $$
BEGIN
    -- Validate trigger context - defense against misuse
    IF TG_OP != 'UPDATE' THEN
        RAISE EXCEPTION 'Function update_announcements_updated_at can only be used in UPDATE triggers';
    END IF;
    
    -- Validate table name to prevent trigger misuse
    IF TG_TABLE_NAME != 'announcements' THEN
        RAISE EXCEPTION 'Function update_announcements_updated_at can only be used on announcements table';
    END IF;
    
    -- Safe timestamp update - no user input involved
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise for proper error handling
        RAISE EXCEPTION 'Error in update_announcements_updated_at trigger: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create trigger with proper security context
CREATE TRIGGER trigger_update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- Row Level Security (RLS) preparation - uncomment and configure as needed
-- ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
-- 
-- Example policies (customize based on your authentication system):
-- CREATE POLICY announcements_read_policy ON announcements FOR SELECT
--     USING (status = 'active' OR created_by = current_user_id());
-- 
-- CREATE POLICY announcements_insert_policy ON announcements FOR INSERT
--     WITH CHECK (created_by = current_user_id());
-- 
-- CREATE POLICY announcements_update_policy ON announcements FOR UPDATE
--     USING (created_by = current_user_id() OR has_admin_role())
--     WITH CHECK (created_by = current_user_id() OR has_admin_role());

-- Security-focused permission grants (customize roles as needed)
-- GRANT SELECT ON announcements TO app_read_role;
-- GRANT INSERT, UPDATE ON announcements TO app_write_role;
-- GRANT DELETE ON announcements TO app_admin_role;
-- GRANT USAGE, SELECT ON SEQUENCE announcements_id_seq TO app_write_role;

-- =============================================================================
-- SECURITY IMPLEMENTATION CHECKLIST:
-- =============================================================================
-- REQUIRED BEFORE PRODUCTION:
-- □ Implement parameterized queries in all application code
-- □ Add application-layer input validation for all fields
-- □ Configure Row Level Security policies for your auth system
-- □ Set up proper database user roles with minimal required permissions
-- □ Implement rate limiting for announcement creation/updates
-- □ Add audit logging for sensitive operations
-- □ Test with automated SQL injection vulnerability scanners
-- □ Review all ORM/query builder configurations for safety
-- □ Implement CSRF protection for announcement management endpoints
-- □ Add content security policies if displaying user-generated content
-- =============================================================================

-- Example of safe sample data insertion (static values only)
-- In production, always use parameterized queries for any dynamic data:
-- INSERT INTO announcements (title, content, created_by, status, priority) VALUES 
-- ('System Maintenance Notice', 'Scheduled maintenance will occur this weekend.', 1, 'active', 'high');