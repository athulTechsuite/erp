-- Migration: Create leave_requests table
-- This table handles employee leave requests with approval workflow and tracking

CREATE TABLE leave_requests (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL,
    leave_type VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4,2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by BIGINT NULL,
    approved_at TIMESTAMP NULL,
    rejection_reason TEXT NULL,
    emergency_contact VARCHAR(255) NULL,
    is_half_day BOOLEAN DEFAULT FALSE,
    half_day_period VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_leave_requests_employee_id 
        FOREIGN KEY (employee_id) REFERENCES employees(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    CONSTRAINT fk_leave_requests_approved_by 
        FOREIGN KEY (approved_by) REFERENCES employees(id) 
        ON DELETE SET NULL ON UPDATE CASCADE,
    
    -- Check constraints for leave_type validation
    CONSTRAINT chk_leave_requests_leave_type 
        CHECK (leave_type IN ('annual', 'sick', 'personal', 'maternity', 'paternity', 'emergency', 'unpaid', 'bereavement', 'study', 'sabbatical', 'jury_duty', 'military')),
    
    -- Check constraints for status validation
    CONSTRAINT chk_leave_requests_status 
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    
    -- Check constraints for half_day_period validation
    CONSTRAINT chk_leave_requests_half_day_period_values 
        CHECK (half_day_period IN ('morning', 'afternoon') OR half_day_period IS NULL),
    
    -- Check constraints for dates
    CONSTRAINT chk_leave_requests_dates 
        CHECK (end_date >= start_date),
    
    CONSTRAINT chk_leave_requests_total_days 
        CHECK (total_days > 0 AND total_days <= 365),
    
    CONSTRAINT chk_leave_requests_half_day_period 
        CHECK (
            (is_half_day = TRUE AND half_day_period IS NOT NULL) OR 
            (is_half_day = FALSE AND half_day_period IS NULL)
        )
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_leave_requests_updated_at 
    BEFORE UPDATE ON leave_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for better query performance
CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_leave_requests_leave_type ON leave_requests(leave_type);
CREATE INDEX idx_leave_requests_approved_by ON leave_requests(approved_by);

-- Composite indexes for common query patterns
CREATE INDEX idx_leave_requests_employee_status ON leave_requests(employee_id, status);
CREATE INDEX idx_leave_requests_status_dates ON leave_requests(status, start_date, end_date);

-- Add comments for documentation
COMMENT ON TABLE leave_requests IS 'Stores employee leave requests with approval workflow and tracking information';
COMMENT ON COLUMN leave_requests.leave_type IS 'Type of leave: annual, sick, personal, maternity, paternity, emergency, unpaid, bereavement, study, sabbatical, jury_duty, military';
COMMENT ON COLUMN leave_requests.status IS 'Request status: pending, approved, rejected, cancelled';
COMMENT ON COLUMN leave_requests.half_day_period IS 'For half-day leaves: morning or afternoon';

-- Sample data for testing (optional - can be removed in production)
INSERT INTO leave_requests (
    employee_id, 
    leave_type, 
    start_date, 
    end_date, 
    total_days, 
    reason, 
    status
) VALUES 
(1, 'annual', '2024-02-15', '2024-02-19', 5.00, 'Family vacation', 'approved'),
(2, 'sick', '2024-02-10', '2024-02-10', 1.00, 'Doctor appointment', 'pending'),
(3, 'personal', '2024-02-20', '2024-02-20', 0.50, 'Personal errands', 'pending');

-- Update approved sample request
UPDATE leave_requests 
SET approved_by = 1, approved_at = CURRENT_TIMESTAMP 
WHERE id = 1;