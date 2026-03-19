-- Migration: Create employees table
-- Description: Employee management with profile data, HR information, and leave tracking
-- Created: 2024-01-15

-- First create configuration table for leave entitlements
CREATE TABLE employee_leave_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(50) UNIQUE NOT NULL,
    config_value DECIMAL(5,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default leave entitlement configurations
INSERT INTO employee_leave_config (config_key, config_value, description) VALUES
('default_annual_leave_entitlement', 160.00, 'Default annual leave entitlement in hours (20 days * 8 hours)'),
('default_sick_leave_entitlement', 80.00, 'Default sick leave entitlement in hours (10 days * 8 hours)'),
('default_personal_leave_entitlement', 40.00, 'Default personal leave entitlement in hours (5 days * 8 hours)');

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
    
    -- Leave entitlements (annual allocation in hours) - defaults from config table
    annual_leave_entitlement DECIMAL(5,2) DEFAULT (SELECT config_value FROM employee_leave_config WHERE config_key = 'default_annual_leave_entitlement'),
    sick_leave_entitlement DECIMAL(5,2) DEFAULT (SELECT config_value FROM employee_leave_config WHERE config_key = 'default_sick_leave_entitlement'),
    personal_leave_entitlement DECIMAL(5,2) DEFAULT (SELECT config_value FROM employee_leave_config WHERE config_key = 'default_personal_leave_entitlement'),
    
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

-- Indexes for configuration table
CREATE INDEX idx_employee_leave_config_key ON employee_leave_config(config_key);

-- Trigger to update updated_at timestamp for employees
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

-- Trigger to update updated_at timestamp for config table
CREATE OR REPLACE FUNCTION update_employee_leave_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_employee_leave_config_updated_at
    BEFORE UPDATE ON employee_leave_config
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_leave_config_updated_at();

-- Comments for documentation
COMMENT ON TABLE employee_leave_config IS 'Configuration table for employee leave entitlement defaults';
COMMENT ON TABLE employees IS 'Employee profiles with HR data and leave tracking';
COMMENT ON COLUMN employees.employee_id IS 'Unique employee identifier (e.g., EMP001)';
COMMENT ON COLUMN employees.manager_id IS 'Self-referencing foreign key to employees table';
COMMENT ON COLUMN employees.annual_leave_balance IS 'Current available annual leave hours';
COMMENT ON COLUMN employees.sick_leave_balance IS 'Current available sick leave hours';
COMMENT ON COLUMN employees.personal_leave_balance IS 'Current available personal leave hours';
COMMENT ON COLUMN employees.annual_leave_entitlement IS 'Annual allocation of leave hours';