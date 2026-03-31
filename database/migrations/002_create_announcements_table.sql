-- Create announcements table
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(500),
    created_by INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    visibility_scope VARCHAR(50) DEFAULT 'all' NOT NULL CHECK (visibility_scope IN ('all', 'students', 'instructors', 'admins')),
    priority INTEGER DEFAULT 0 NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on created_at for efficient ordering
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);

-- Create index on created_by for efficient filtering
CREATE INDEX idx_announcements_created_by ON announcements(created_by);

-- Create index on is_active and visibility_scope for dashboard queries
CREATE INDEX idx_announcements_active_visibility ON announcements(is_active, visibility_scope);

-- Create index on priority for ordering
CREATE INDEX idx_announcements_priority ON announcements(priority DESC);

-- Create index on expires_at for filtering expired announcements
CREATE INDEX idx_announcements_expires_at ON announcements(expires_at);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_announcements_updated_at 
    BEFORE UPDATE ON announcements 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for active announcements visible on dashboards
CREATE VIEW active_announcements AS
SELECT 
    id,
    title,
    content,
    image_url,
    created_by,
    visibility_scope,
    priority,
    expires_at,
    created_at,
    updated_at
FROM announcements 
WHERE is_active = true 
AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
ORDER BY priority DESC, created_at DESC;