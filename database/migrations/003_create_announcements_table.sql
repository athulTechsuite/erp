-- Migration: Create announcements table
-- Description: Creates the announcements table for company-wide announcements system

CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    email_error TEXT,
    CONSTRAINT fk_announcements_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_announcements_created_by ON announcements(created_by);
CREATE INDEX idx_announcements_is_active ON announcements(is_active);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);

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

-- Add comments for documentation
COMMENT ON TABLE announcements IS 'Stores company-wide announcements that are displayed on dashboards and sent via email';
COMMENT ON COLUMN announcements.id IS 'Primary key for announcement';
COMMENT ON COLUMN announcements.title IS 'Title of the announcement';
COMMENT ON COLUMN announcements.content IS 'Plain text content of the announcement';
COMMENT ON COLUMN announcements.created_by IS 'Foreign key reference to admin user who created the announcement';
COMMENT ON COLUMN announcements.created_at IS 'Timestamp when announcement was created';
COMMENT ON COLUMN announcements.updated_at IS 'Timestamp when announcement was last updated';
COMMENT ON COLUMN announcements.is_active IS 'Flag to indicate if announcement is active and should be displayed';
COMMENT ON COLUMN announcements.email_sent IS 'Flag to track if email notifications have been sent';
COMMENT ON COLUMN announcements.email_sent_at IS 'Timestamp when email notifications were sent';
COMMENT ON COLUMN announcements.email_error IS 'Error message if email sending failed';