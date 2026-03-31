-- Migration: Create announcements table
-- Created: 2024-01-01
-- Description: Creates the announcements table for the Company Announcements system

CREATE TABLE announcements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Foreign key constraint
    CONSTRAINT fk_announcements_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Indexes for better performance
    INDEX idx_announcements_created_at (created_at),
    INDEX idx_announcements_is_active (is_active),
    INDEX idx_announcements_created_by (created_by)
);

-- Create announcement_reads table to track which users have read which announcements
CREATE TABLE announcement_reads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    announcement_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_announcement_reads_announcement_id 
        FOREIGN KEY (announcement_id) REFERENCES announcements(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_announcement_reads_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Ensure one read record per user per announcement
    UNIQUE KEY unique_user_announcement (user_id, announcement_id),
    
    -- Indexes for better performance
    INDEX idx_announcement_reads_announcement_id (announcement_id),
    INDEX idx_announcement_reads_user_id (user_id)
);

-- Insert sample data for testing (optional)
INSERT INTO announcements (title, content, created_by, is_active) VALUES 
('Welcome to the New ERP System', 'We are excited to announce the launch of our new ERP system. Please take some time to explore the new features and functionalities.', 1, TRUE),
('Office Holiday Schedule', 'Please note that the office will be closed on the following dates for the upcoming holidays. Plan your work accordingly.', 1, TRUE);