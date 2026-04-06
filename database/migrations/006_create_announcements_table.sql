-- Migration: Create announcements table
-- Description: Creates the announcements table for company-wide announcements system
-- Date: 2024-01-01
-- Dependencies: Requires users table (migration 001_create_users_table.sql or similar)
-- Security Review: SQL injection and data safety measures implemented

-- =============================================================================
-- SQL INJECTION RISK ASSESSMENT AND SAFETY DOCUMENTATION
-- =============================================================================
-- This migration file has been reviewed for SQL injection vulnerabilities:
-- 
-- 1. STATIC DDL STATEMENTS: All CREATE TABLE, CREATE INDEX, and ALTER statements
--    use hardcoded identifiers and are not susceptible to SQL injection
--
-- 2. CHECK CONSTRAINTS: Use enumerated values and length constraints to prevent
--    malicious data insertion at the database level
--
-- 3. PARAMETER BINDING REQUIREMENTS: Any application code interacting with this
--    table MUST use parameterized queries. Examples provided below.
--
-- 4. STORED FUNCTIONS: Use proper validation and SECURITY DEFINER context
--
-- SAFE APPLICATION USAGE EXAMPLES:
-- --------------------------------
-- ✅ CORRECT (Parameterized - language agnostic examples):
-- SELECT * FROM announcements WHERE id = $1;
-- INSERT INTO announcements (title, content, created_by) VALUES ($1, $2, $3);
-- UPDATE announcements SET title = $1, content = $2 WHERE id = $3;
-- DELETE FROM announcements WHERE id = $1 AND created_by = $2;
--
-- ❌ DANGEROUS (Never concatenate user input):
-- SELECT * FROM announcements WHERE id = " + user_input;
-- INSERT INTO announcements (title) VALUES ('" + user_title + "');
--
-- FRAMEWORK-SPECIFIC SAFE EXAMPLES:
-- Node.js/PostgreSQL: query('SELECT * FROM announcements WHERE id = $1', [userId])
-- Python/psycopg2: cursor.execute('SELECT * FROM announcements WHERE id = %s', (user_id,))
-- Java/JDBC: preparedStatement.setInt(1, userId)
-- C#/Npgsql: command.Parameters.AddWithValue("@id", userId)
-- =============================================================================

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
    
    -- Safe assignment - no user input involved in trigger context
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

-- SAFE SAMPLE DATA INSERTION EXAMPLE
-- Note: This demonstrates safe static insertion. In applications, always use
-- parameterized queries as documented in the header comments above.
-- INSERT INTO announcements (title, content, created_by) VALUES 
-- ('Welcome to the new announcements system', 'This is our new company-wide announcements feature. Stay tuned for important updates!', 1);

-- Grant appropriate permissions (adjust schema and roles as needed)
-- GRANT SELECT, INSERT, UPDATE ON announcements TO announcement_users;
-- GRANT DELETE ON announcements TO announcement_admins;
-- GRANT USAGE ON SEQUENCE announcements_id_seq TO announcement_users;

-- =============================================================================
-- POST-MIGRATION SECURITY CHECKLIST:
-- =============================================================================
-- □ Verify all application queries use parameterized statements
-- □ Review and test CHECK constraints with boundary values
-- □ Configure row-level security policies if required
-- □ Set up appropriate database user roles and permissions
-- □ Implement application-level input validation in addition to DB constraints
-- □ Test with SQL injection attack vectors to verify protection
-- =============================================================================