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

-- Create function to automatically archive old announcements
CREATE OR REPLACE FUNCTION archive_old_announcements()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE announcements 
    SET is_archived = TRUE, 
        archived_at = CURRENT_TIMESTAMP
    WHERE published_at < (CURRENT_TIMESTAMP - INTERVAL '6 months')
    AND is_published = TRUE
    AND is_archived = FALSE;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

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

-- Insert sample data for testing (optional - remove in production)
-- INSERT INTO announcements (title, content, priority, created_by, is_published, published_at) VALUES
-- ('Welcome to the Company Portal', 'We are excited to announce the launch of our new company portal. This platform will serve as your central hub for all company communications and updates.', 'important', 1, TRUE, CURRENT_TIMESTAMP),
-- ('Office Holiday Schedule', 'Please note the upcoming holiday schedule for the office. The office will be closed on the following dates...', 'normal', 1, TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day');

COMMENT ON TABLE announcements IS 'Stores company-wide announcements with scheduling and priority support';
COMMENT ON TABLE announcement_attachments IS 'Stores file attachments associated with announcements';
COMMENT ON TABLE announcement_reads IS 'Tracks which users have read which announcements';
COMMENT ON VIEW announcement_stats IS 'Provides read statistics for published announcements';