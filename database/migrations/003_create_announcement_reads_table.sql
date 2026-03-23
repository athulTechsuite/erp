-- Create announcement_reads table for tracking read/unread status
CREATE TABLE announcement_reads (
    id BIGSERIAL PRIMARY KEY,
    announcement_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_announcement_reads_announcement 
        FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    CONSTRAINT fk_announcement_reads_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate read records
    CONSTRAINT uk_announcement_reads_announcement_user 
        UNIQUE (announcement_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_announcement_reads_announcement_id ON announcement_reads(announcement_id);
CREATE INDEX idx_announcement_reads_user_id ON announcement_reads(user_id);
CREATE INDEX idx_announcement_reads_read_at ON announcement_reads(read_at);

-- Create composite index for common queries
CREATE INDEX idx_announcement_reads_announcement_user ON announcement_reads(announcement_id, user_id);

-- Add trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcement_reads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_announcement_reads_updated_at
    BEFORE UPDATE ON announcement_reads
    FOR EACH ROW
    EXECUTE FUNCTION update_announcement_reads_updated_at();

-- Add comments for documentation
COMMENT ON TABLE announcement_reads IS 'Tracks which announcements have been read by which users';
COMMENT ON COLUMN announcement_reads.announcement_id IS 'Reference to the announcement that was read';
COMMENT ON COLUMN announcement_reads.user_id IS 'Reference to the user who read the announcement';
COMMENT ON COLUMN announcement_reads.read_at IS 'Timestamp when the announcement was marked as read';