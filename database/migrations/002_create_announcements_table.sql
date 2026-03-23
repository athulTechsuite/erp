-- Migration: Create announcements table
-- Description: Creates the announcements table with support for rich content, scheduling, priorities, and read tracking

-- Create announcements table
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    is_published BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create announcement_attachments table for file uploads
CREATE TABLE announcement_attachments (
    id SERIAL PRIMARY KEY,
    announcement_id INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
);

-- Create announcement_reads table for tracking read status
CREATE TABLE announcement_reads (
    id SERIAL PRIMARY KEY,
    announcement_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(announcement_id, user_id),
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_announcements_created_by ON announcements(created_by);
CREATE INDEX idx_announcements_published_at ON announcements(published_at);
CREATE INDEX idx_announcements_scheduled_for ON announcements(scheduled_for);
CREATE INDEX idx_announcements_priority ON announcements(priority);
CREATE INDEX idx_announcements_is_published ON announcements(is_published);
CREATE INDEX idx_announcements_is_archived ON announcements(is_archived);
CREATE INDEX idx_announcement_attachments_announcement_id ON announcement_attachments(announcement_id);
CREATE INDEX idx_announcement_reads_announcement_id ON announcement_reads(announcement_id);
CREATE INDEX idx_announcement_reads_user_id ON announcement_reads(user_id);

-- Create trigger to automatically update updated_at timestamp
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

-- Create function to automatically archive old announcements with safety checks
CREATE OR REPLACE FUNCTION archive_old_announcements()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate cutoff date (6 months ago)
    cutoff_date := CURRENT_TIMESTAMP - INTERVAL '6 months';
    
    -- Safety check: ensure cutoff date is reasonable (not in the future or too far in the past)
    IF cutoff_date > CURRENT_TIMESTAMP OR cutoff_date < CURRENT_TIMESTAMP - INTERVAL '5 years' THEN
        RAISE EXCEPTION 'Invalid cutoff date calculated: %', cutoff_date;
    END IF;
    
    -- Additional safety check: verify we have valid records to update
    IF NOT EXISTS (
        SELECT 1 FROM announcements 
        WHERE published_at < cutoff_date
        AND is_published = TRUE
        AND is_archived = FALSE
        AND published_at IS NOT NULL
    ) THEN
        RETURN 0;
    END IF;
    
    -- Perform the archive operation with strict WHERE clause validation
    UPDATE announcements 
    SET is_archived = TRUE, 
        archived_at = CURRENT_TIMESTAMP
    WHERE published_at IS NOT NULL
    AND published_at < cutoff_date
    AND is_published = TRUE
    AND is_archived = FALSE
    AND id IS NOT NULL;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- Log the operation
    INSERT INTO system_logs (action, details, created_at) 
    VALUES (
        'auto_archive_announcements', 
        format('Archived %s announcements older than %s', archived_count, cutoff_date::date),
        CURRENT_TIMESTAMP
    );
    
    RETURN archived_count;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise
        INSERT INTO system_logs (action, details, created_at) 
        VALUES (
            'auto_archive_announcements_error', 
            format('Error archiving announcements: %s', SQLERRM),
            CURRENT_TIMESTAMP
        );
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- Create automated job scheduler for archiving old announcements
-- This uses PostgreSQL's pg_cron extension for scheduling
-- Note: pg_cron extension must be installed and configured

-- Schedule the archive job to run daily at 2 AM
-- This requires pg_cron extension: CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
    -- Check if pg_cron is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Schedule daily archiving job at 2:00 AM
        PERFORM cron.schedule('archive-old-announcements', '0 2 * * *', 'SELECT archive_old_announcements();');
        
        -- Log the scheduler setup
        INSERT INTO system_logs (action, details, created_at) 
        VALUES (
            'setup_archive_scheduler', 
            'Automated archiving job scheduled for daily execution at 2:00 AM',
            CURRENT_TIMESTAMP
        );
    ELSE
        -- Log warning if pg_cron is not available
        INSERT INTO system_logs (action, details, created_at) 
        VALUES (
            'setup_archive_scheduler_warning', 
            'pg_cron extension not available. Manual scheduling required for announcement archiving.',
            CURRENT_TIMESTAMP
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback: create a note for manual setup if automated scheduling fails
        INSERT INTO system_logs (action, details, created_at) 
        VALUES (
            'setup_archive_scheduler_fallback', 
            'Automated scheduler setup failed. Please configure cron job manually: 0 2 * * * psql -d database -c "SELECT archive_old_announcements();"',
            CURRENT_TIMESTAMP
        );
END $$;

-- Create view for announcement statistics
CREATE VIEW announcement_stats AS
SELECT 
    a.id,
    a.title,
    a.priority,
    a.published_at,
    COUNT(ar.user_id) as total_reads,
    (SELECT COUNT(*) FROM users WHERE role != 'admin') as total_employees,
    ROUND(
        (COUNT(ar.user_id)::DECIMAL / NULLIF((SELECT COUNT(*) FROM users WHERE role != 'admin'), 0)) * 100, 
        2
    ) as read_percentage
FROM announcements a
LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id
WHERE a.is_published = TRUE AND a.is_archived = FALSE
GROUP BY a.id, a.title, a.priority, a.published_at;

COMMENT ON TABLE announcements IS 'Stores company-wide announcements with scheduling and priority support';
COMMENT ON TABLE announcement_attachments IS 'Stores file attachments associated with announcements';
COMMENT ON TABLE announcement_reads IS 'Tracks which users have read which announcements';
COMMENT ON VIEW announcement_stats IS 'Provides read statistics for published announcements';
COMMENT ON FUNCTION archive_old_announcements() IS 'Archives announcements older than 6 months with safety checks and logging';