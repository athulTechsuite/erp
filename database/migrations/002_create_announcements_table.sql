-- Migration: Create announcements table
-- Description: Creates the announcements table to support company-wide announcements system
-- Author: System
-- Date: 2024-01-15

CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    author_id INTEGER NOT NULL,
    priority_level VARCHAR(20) DEFAULT 'normal' CHECK (priority_level IN ('normal', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    send_email_notification BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    view_count INTEGER DEFAULT 0,
    
    -- Foreign key constraints
    CONSTRAINT fk_announcements_author 
        FOREIGN KEY (author_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    -- Check constraints
    CONSTRAINT chk_published_at_valid 
        CHECK (published_at IS NULL OR published_at >= created_at),
    CONSTRAINT chk_expires_at_valid 
        CHECK (expires_at IS NULL OR expires_at > published_at OR expires_at > created_at),
    CONSTRAINT chk_email_sent_timing 
        CHECK (email_sent_at IS NULL OR email_sent_at >= published_at OR email_sent_at >= created_at)
);

-- Create announcement_reads table to track which users have read which announcements
CREATE TABLE IF NOT EXISTS announcement_reads (
    id SERIAL PRIMARY KEY,
    announcement_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_announcement_reads_announcement 
        FOREIGN KEY (announcement_id) 
        REFERENCES announcements(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_announcement_reads_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate reads
    CONSTRAINT uk_announcement_reads_announcement_user 
        UNIQUE (announcement_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_published_at ON announcements(published_at);
CREATE INDEX idx_announcements_expires_at ON announcements(expires_at);
CREATE INDEX idx_announcements_priority_level ON announcements(priority_level);
CREATE INDEX idx_announcements_author_id ON announcements(author_id);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX idx_announcements_status_published ON announcements(status, published_at);
CREATE INDEX idx_announcements_active ON announcements(status, published_at, expires_at) 
    WHERE status = 'published';

-- Indexes for announcement_reads table
CREATE INDEX idx_announcement_reads_announcement_id ON announcement_reads(announcement_id);
CREATE INDEX idx_announcement_reads_user_id ON announcement_reads(user_id);
CREATE INDEX idx_announcement_reads_read_at ON announcement_reads(read_at DESC);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on announcements table
CREATE TRIGGER trigger_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- Create function to automatically archive expired announcements
CREATE OR REPLACE FUNCTION archive_expired_announcements()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE announcements 
    SET status = 'archived', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'published' 
      AND expires_at IS NOT NULL 
      AND expires_at <= CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments to tables and important columns
COMMENT ON TABLE announcements IS 'Stores company-wide announcements with scheduling and priority support';
COMMENT ON COLUMN announcements.priority_level IS 'Priority level: normal, high, urgent - affects display and notifications';
COMMENT ON COLUMN announcements.status IS 'Announcement status: draft, published, archived';
COMMENT ON COLUMN announcements.published_at IS 'When the announcement should become visible to users';
COMMENT ON COLUMN announcements.expires_at IS 'When the announcement should be automatically archived';
COMMENT ON COLUMN announcements.send_email_notification IS 'Whether to send email notifications for this announcement';

COMMENT ON TABLE announcement_reads IS 'Tracks which users have read which announcements';
COMMENT ON COLUMN announcement_reads.read_at IS 'Timestamp when the user marked the announcement as read';