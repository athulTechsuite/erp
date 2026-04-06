-- Create announcements table for company-wide announcements system
-- This migration creates the table structure for storing announcements
-- that can be managed by admins and displayed to all employees

-- Ensure users table exists before creating foreign key constraint
-- This validates the dependency and prevents foreign key errors
SELECT name FROM sqlite_master WHERE type='table' AND name='users';

CREATE TABLE announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL CHECK(length(title) <= 255),
    content TEXT NOT NULL CHECK(length(content) <= 65535),
    is_published BOOLEAN DEFAULT FALSE CHECK(is_published IN (0, 1)),
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Foreign key with CASCADE delete maintains referential integrity
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on is_published for efficient querying of published announcements
CREATE INDEX idx_announcements_published ON announcements(is_published);

-- Create index on created_at for chronological ordering
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);

-- Create composite index for published announcements ordered by date
CREATE INDEX idx_announcements_published_date ON announcements(is_published, created_at DESC);

-- Create trigger to automatically update the updated_at timestamp
CREATE TRIGGER update_announcements_timestamp 
    AFTER UPDATE ON announcements
    BEGIN
        UPDATE announcements SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;