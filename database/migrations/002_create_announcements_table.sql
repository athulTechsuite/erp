-- Migration: Create announcements table
-- Description: Creates the announcements table with support for rich content, scheduling, priorities, and read tracking

-- Create announcements table
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    -- Priority enum values: 'normal', 'important', 'urgent'
    -- To extend priority values in the future:
    -- 1. Add new constraint: ALTER TABLE announcements DROP CONSTRAINT announcements_priority_check;
    -- 2. Add new values: ALTER TABLE announcements ADD CONSTRAINT announcements_priority_check CHECK (priority IN ('normal', 'important', 'urgent', 'new_value'));
    -- 3. Update application logic to handle new priority levels
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

-- Create function to automatically archive old announcements using system settings
CREATE OR REPLACE FUNCTION archive_old_announcements()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
    cutoff_date TIMESTAMP WITH TIME ZONE;
    archive_interval_months INTEGER;
BEGIN
    -- Get archive interval from system settings, fallback to 6 months default
    SELECT COALESCE(
        (SELECT value::INTEGER FROM system_settings WHERE key = 'announcement_archive_interval_months'),
        6
    ) INTO archive_interval_months;
    
    -- Validate archive interval
    IF archive_interval_months IS NULL OR archive_interval_months <= 0 OR archive_interval_months > 60 THEN
        RAISE EXCEPTION 'Invalid archive interval from system settings: % months. Must be between 1 and 60.', archive_interval_months;
    END IF;
    
    -- Calculate cutoff date using system-configured interval
    cutoff_date := CURRENT_TIMESTAMP - (archive_interval_months || ' months')::INTERVAL;
    
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
    
    -- Perform the archive operation with parameterized query
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
        'Archived ' || archived_count || ' announcements older than ' || cutoff_date::date || ' (using ' || archive_interval_months || ' months interval from system settings)',
        CURRENT_TIMESTAMP
    );
    
    RETURN archived_count;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise
        INSERT INTO system_logs (action, details, created_at) 
        VALUES (
            'auto_archive_announcements_error', 
            'Error archiving announcements: ' || SQLERRM,
            CURRENT_TIMESTAMP
        );
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- Insert default system setting for announcement archiving interval
INSERT INTO system_settings (key, value, description, created_at) 
VALUES (
    'announcement_archive_interval_months', 
    '6', 
    'Number of months after publication before announcements are automatically archived',
    CURRENT_TIMESTAMP
) ON CONFLICT (key) DO NOTHING;

-- Log scheduler setup instructions (extension checks moved to separate validation)
-- Note: pg_cron extension validation should be performed via separate validation script
INSERT INTO system_logs (action, details, created_at) 
VALUES (
    'scheduler_setup_instructions', 
    'To enable automated archiving: 1) Run extension validation script 2) If pg_cron available, execute: SELECT cron.schedule(''archive-old-announcements'', ''0 2 * * *'', ''SELECT archive_old_announcements();''); 3) Otherwise setup system cron job',
    CURRENT_TIMESTAMP
);

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
COMMENT ON FUNCTION archive_old_announcements() IS 'Archives announcements based on configurable interval from system_settings table (announcement_archive_interval_months)';