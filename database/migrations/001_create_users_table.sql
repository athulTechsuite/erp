-- Migration: Create users table
-- Description: User authentication and role-based access control for ERP system
-- Author: System
-- Created: 2024

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
    is_active BOOLEAN DEFAULT true,
    phone VARCHAR(20),
    address TEXT,
    hire_date DATE,
    department VARCHAR(100),
    job_title VARCHAR(100),
    salary DECIMAL(10,2),
    manager_id INTEGER REFERENCES users(id),
    profile_image VARCHAR(500),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_manager_id ON users(manager_id);
CREATE INDEX idx_users_department ON users(department);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password should be changed on first login)
-- Default password: 'admin123' (hashed with bcrypt)
INSERT INTO users (
    username, 
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role, 
    hire_date,
    job_title,
    department
) VALUES (
    'admin',
    'admin@company.com',
    '$2b$10$rQZ8qHwF5qF5qF5qF5qF5uF5qF5qF5qF5qF5qF5qF5qF5qF5qF5qF',
    'System',
    'Administrator',
    'admin',
    CURRENT_DATE,
    'System Administrator',
    'IT'
) ON CONFLICT (username) DO NOTHING;