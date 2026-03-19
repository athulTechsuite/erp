-- Migration: Create employees table
-- Description: Employee management with profile data, HR information, and leave tracking
-- Created: 2024-01-15

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    hire_date DATE NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),
    manager_id INTEGER REFERENCES employees(id),
    employment_status VARCHAR(20) DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'terminated')),
    employment_type VARCHAR(20) DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),
    
    -- Address information
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'United States',
    
    -- Emergency contact
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(100),
    
    -- Leave balances (in hours)
    annual_leave_balance DECIMAL(5,2) DEFAULT 0.00,
    sick_leave_balance DECIMAL(5,2) DEFAULT 0.00,
    personal_leave_balance DECIMAL(5,2) DEFAULT 0.00,
    
    -- Leave entitlements (annual allocation in hours)
    annual_leave_entitlement DECIMAL(5,2) DEFAULT 160.00, -- 20 days * 8 hours
    sick_leave_entitlement DECIMAL(5,2) DEFAULT 80.00,    -- 10 days * 8 hours
    personal_leave_entitlement DECIMAL(5,2) DEFAULT 40.00, -- 5 days * 8 hours
    
    -- Profile and notes
    profile_picture_url VARCHAR(500),
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_manager_id ON employees(manager_id);
CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_employees_employment_status ON employees(employment_status);
CREATE INDEX idx_employees_hire_date ON employees(hire_date);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_employees_updated_at();

-- Comments for documentation
COMMENT ON TABLE employees IS 'Employee profiles with HR data and leave tracking';
COMMENT ON COLUMN employees.employee_id IS 'Unique employee identifier (e.g., EMP001)';
COMMENT ON COLUMN employees.manager_id IS 'Self-referencing foreign key to employees table';
COMMENT ON COLUMN employees.annual_leave_balance IS 'Current available annual leave hours';
COMMENT ON COLUMN employees.sick_leave_balance IS 'Current available sick leave hours';
COMMENT ON COLUMN employees.personal_leave_balance IS 'Current available personal leave hours';
COMMENT ON COLUMN employees.annual_leave_entitlement IS 'Annual allocation of leave hours';