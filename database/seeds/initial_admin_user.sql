-- Initial admin user seed data for ERP system
-- This creates a default admin user for system initialization
-- Password: admin123 (should be changed on first login)

INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    is_active,
    created_at,
    updated_at,
    must_change_password
) VALUES (
    1,
    'admin@company.com',
    '$2b$12$LQv3c1yqBwEHxE03uSesLOktET/Q9TDE9GdkAiOvHuOdHlBvKw4vK', -- admin123
    'System',
    'Administrator',
    'admin',
    true,
    NOW(),
    NOW(),
    true
);

-- Create corresponding employee record for the admin user
INSERT INTO employees (
    id,
    user_id,
    employee_id,
    department,
    position,
    hire_date,
    employment_status,
    manager_id,
    annual_leave_entitlement,
    sick_leave_entitlement,
    created_at,
    updated_at
) VALUES (
    1,
    1,
    'EMP001',
    'Administration',
    'System Administrator',
    CURRENT_DATE,
    'active',
    NULL,
    25.0,
    10.0,
    NOW(),
    NOW()
);

-- Initialize leave balances for admin user
INSERT INTO leave_balances (
    employee_id,
    leave_type,
    total_entitlement,
    used_days,
    remaining_days,
    year,
    created_at,
    updated_at
) VALUES 
(1, 'annual', 25.0, 0.0, 25.0, EXTRACT(YEAR FROM CURRENT_DATE), NOW(), NOW()),
(1, 'sick', 10.0, 0.0, 10.0, EXTRACT(YEAR FROM CURRENT_DATE), NOW(), NOW()),
(1, 'personal', 5.0, 0.0, 5.0, EXTRACT(YEAR FROM CURRENT_DATE), NOW(), NOW());

-- Create initial company settings
INSERT INTO company_settings (
    setting_key,
    setting_value,
    description,
    created_at,
    updated_at
) VALUES 
('company_name', 'Your Company Name', 'Company name displayed in the system', NOW(), NOW()),
('default_annual_leave', '25', 'Default annual leave entitlement in days', NOW(), NOW()),
('default_sick_leave', '10', 'Default sick leave entitlement in days', NOW(), NOW()),
('default_personal_leave', '5', 'Default personal leave entitlement in days', NOW(), NOW()),
('working_days_per_week', '5', 'Standard working days per week', NOW(), NOW()),
('leave_approval_required', 'true', 'Whether leave requests require approval', NOW(), NOW()),
('auto_approve_threshold', '0', 'Auto-approve leave requests under this many days', NOW(), NOW());

-- Insert audit log for admin user creation
INSERT INTO audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    changes,
    created_at
) VALUES (
    1,
    'CREATE',
    'users',
    1,
    '{"action": "Initial admin user created during system setup"}',
    NOW()
);