-- Migration: Create leave_requests table
-- This table handles employee leave requests with approval workflow and tracking

-- Create ENUM types for PostgreSQL compatibility
CREATE TYPE leave_type_enum AS ENUM (
    'annual', 
    'sick', 
    'personal', 
    'maternity', 
    'paternity', 
    'emergency', 
    'unpaid', 
    'bereavement', 
    'study', 
    'sabbatical', 
    'jury_duty', 
    'military',
    'compassionate',
    'public_holiday',
    'religious'
);

CREATE TYPE leave_status_enum AS ENUM (
    'pending', 
    'approved', 
    'rejected', 
    'cancelled'
);

CREATE TYPE half_day_period_enum AS ENUM (
    'morning', 
    'afternoon'
);

CREATE TABLE leave_requests (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL,
    leave_type leave_type_enum NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4,2) NOT NULL,
    reason TEXT,
    status leave_status_enum NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by BIGINT NULL,
    approved_at TIMESTAMP NULL,
    rejection_reason TEXT NULL,
    emergency_contact VARCHAR(255) NULL,
    is_half_day BOOLEAN DEFAULT FALSE,
    half_day_period half_day_period_enum NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_leave_requests_employee_id 
        FOREIGN KEY (employee_id) REFERENCES employees(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    CONSTRAINT fk_leave_requests_approved_by 
        FOREIGN KEY (approved_by) REFERENCES employees(id) 
        ON DELETE SET NULL ON UPDATE CASCADE,
    
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
COMMENT ON COLUMN leave_requests.leave_type IS 'Type of leave: annual, sick, personal, maternity, paternity, emergency, unpaid, bereavement, study, sabbatical, jury_duty, military, compassionate, public_holiday, religious';
COMMENT ON COLUMN leave_requests.status IS 'Request status: pending, approved, rejected, cancelled';
COMMENT ON COLUMN leave_requests.half_day_period IS 'For half-day leaves: morning or afternoon';

-- Database-level tests for constraint validation
-- These tests verify that the check constraints work as expected

-- Test 1: Valid date range (should pass)
DO $$ 
BEGIN
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days) 
    VALUES (1, 'annual', '2024-02-15', '2024-02-19', 5.00);
    DELETE FROM leave_requests WHERE employee_id = 1 AND start_date = '2024-02-15';
    RAISE NOTICE 'TEST PASS: Valid date range constraint';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST FAIL: Valid date range should have passed: %', SQLERRM;
END $$;

-- Test 2: Invalid date range - end before start (should fail)
DO $$ 
BEGIN
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days) 
    VALUES (1, 'annual', '2024-02-19', '2024-02-15', 5.00);
    RAISE NOTICE 'TEST FAIL: Invalid date range should have been rejected';
    DELETE FROM leave_requests WHERE employee_id = 1 AND start_date = '2024-02-19';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST PASS: Invalid date range constraint properly rejected';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST FAIL: Unexpected error for date range test: %', SQLERRM;
END $$;

-- Test 3: Valid total days within range (should pass)
DO $$ 
BEGIN
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days) 
    VALUES (1, 'annual', '2024-02-15', '2024-02-15', 1.00);
    DELETE FROM leave_requests WHERE employee_id = 1 AND total_days = 1.00;
    RAISE NOTICE 'TEST PASS: Valid total_days constraint';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST FAIL: Valid total_days should have passed: %', SQLERRM;
END $$;

-- Test 4: Invalid total days - zero (should fail)
DO $$ 
BEGIN
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days) 
    VALUES (1, 'annual', '2024-02-15', '2024-02-15', 0.00);
    RAISE NOTICE 'TEST FAIL: Zero total_days should have been rejected';
    DELETE FROM leave_requests WHERE employee_id = 1 AND total_days = 0.00;
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST PASS: Zero total_days constraint properly rejected';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST FAIL: Unexpected error for zero total_days test: %', SQLERRM;
END $$;

-- Test 5: Invalid total days - exceeds maximum (should fail)
DO $$ 
BEGIN
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days) 
    VALUES (1, 'annual', '2024-02-15', '2024-02-15', 366.00);
    RAISE NOTICE 'TEST FAIL: Excessive total_days should have been rejected';
    DELETE FROM leave_requests WHERE employee_id = 1 AND total_days = 366.00;
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST PASS: Excessive total_days constraint properly rejected';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST FAIL: Unexpected error for excessive total_days test: %', SQLERRM;
END $$;

-- Test 6: Valid half-day configuration - true with period (should pass)
DO $$ 
BEGIN
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days, is_half_day, half_day_period) 
    VALUES (1, 'personal', '2024-02-15', '2024-02-15', 0.50, TRUE, 'morning');
    DELETE FROM leave_requests WHERE employee_id = 1 AND is_half_day = TRUE;
    RAISE NOTICE 'TEST PASS: Valid half-day configuration constraint';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST FAIL: Valid half-day configuration should have passed: %', SQLERRM;
END $$;

-- Test 7: Valid half-day configuration - false with null period (should pass)
DO $$ 
BEGIN
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days, is_half_day, half_day_period) 
    VALUES (1, 'annual', '2024-02-15', '2024-02-15', 1.00, FALSE, NULL);
    DELETE FROM leave_requests WHERE employee_id = 1 AND is_half_day = FALSE;
    RAISE NOTICE 'TEST PASS: Valid full-day configuration constraint';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST FAIL: Valid full-day configuration should have passed: %', SQLERRM;
END $$;

-- Test 8: Invalid half-day configuration - true without period (should fail)
DO $$ 
BEGIN
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days, is_half_day, half_day_period) 
    VALUES (1, 'personal', '2024-02-15', '2024-02-15', 0.50, TRUE, NULL);
    RAISE NOTICE 'TEST FAIL: Half-day without period should have been rejected';
    DELETE FROM leave_requests WHERE employee_id = 1 AND is_half_day = TRUE AND half_day_period IS NULL;
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST PASS: Half-day without period constraint properly rejected';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST FAIL: Unexpected error for half-day without period test: %', SQLERRM;
END $$;

-- Test 9: Invalid half-day configuration - false with period (should fail)
DO $$ 
BEGIN
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days, is_half_day, half_day_period) 
    VALUES (1, 'annual', '2024-02-15', '2024-02-15', 1.00, FALSE, 'afternoon');
    RAISE NOTICE 'TEST FAIL: Full-day with period should have been rejected';
    DELETE FROM leave_requests WHERE employee_id = 1 AND is_half_day = FALSE AND half_day_period IS NOT NULL;
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST PASS: Full-day with period constraint properly rejected';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST FAIL: Unexpected error for full-day with period test: %', SQLERRM;
END $$;

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