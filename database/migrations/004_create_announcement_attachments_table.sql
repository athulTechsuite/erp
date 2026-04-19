-- Migration: Create announcement_attachments table
-- Description: Table to store file attachments for announcements
-- Author: System
-- Date: 2024-01-15

CREATE TABLE announcement_attachments (
    id SERIAL PRIMARY KEY,
    announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_announcement_attachments_announcement_id ON announcement_attachments(announcement_id);
CREATE INDEX idx_announcement_attachments_uploaded_by ON announcement_attachments(uploaded_by);
CREATE INDEX idx_announcement_attachments_created_at ON announcement_attachments(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcement_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_announcement_attachments_updated_at
    BEFORE UPDATE ON announcement_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_announcement_attachments_updated_at();

-- Add constraints
ALTER TABLE announcement_attachments 
ADD CONSTRAINT chk_file_size_positive CHECK (file_size > 0);

ALTER TABLE announcement_attachments 
ADD CONSTRAINT chk_filename_not_empty CHECK (LENGTH(TRIM(filename)) > 0);

ALTER TABLE announcement_attachments 
ADD CONSTRAINT chk_original_filename_not_empty CHECK (LENGTH(TRIM(original_filename)) > 0);

-- Add comment for documentation
COMMENT ON TABLE announcement_attachments IS 'Stores file attachments for company announcements';
COMMENT ON COLUMN announcement_attachments.filename IS 'System-generated unique filename for storage';
COMMENT ON COLUMN announcement_attachments.original_filename IS 'Original filename as uploaded by user';
COMMENT ON COLUMN announcement_attachments.file_path IS 'Full path to the stored file';
COMMENT ON COLUMN announcement_attachments.file_size IS 'File size in bytes';
COMMENT ON COLUMN announcement_attachments.mime_type IS 'MIME type of the uploaded file';