const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../config/database');

// Get all employees (Admin only)
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const employees = await db.query(`
      SELECT 
        id, 
        employee_id, 
        first_name, 
        last_name, 
        email, 
        phone, 
        department, 
        position, 
        hire_date, 
        salary, 
        status,
        role,
        created_at,
        updated_at
      FROM employees 
      WHERE deleted_at IS NULL
      ORDER BY last_name, first_name
    `);
    
    res.json({
      success: true,
      data: employees.rows
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employees'
    });
  }
});

// Get employee profile (Self or Admin)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.params.id;
    
    // Check if user is accessing their own profile or is admin
    if (req.user.id !== parseInt(employeeId) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await db.query(`
      SELECT 
        id, 
        employee_id, 
        first_name, 
        last_name, 
        email, 
        phone, 
        department, 
        position, 
        hire_date, 
        salary, 
        status,
        role,
        emergency_contact_name,
        emergency_contact_phone,
        address,
        created_at,
        updated_at
      FROM employees 
      WHERE id = $1 AND deleted_at IS NULL
    `, [employeeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employee'
    });
  }
});

// Create new employee (Admin only)
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const {
      employee_id,
      first_name,
      last_name,
      email,
      password,
      phone,
      department,
      position,
      hire_date,
      salary,
      role = 'employee',
      emergency_contact_name,
      emergency_contact_phone,
      address
    } = req.body;

    // Validate required fields
    if (!employee_id || !first_name || !last_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if employee_id or email already exists
    const existingEmployee = await db.query(
      'SELECT id FROM employees WHERE (employee_id = $1 OR email = $2) AND deleted_at IS NULL',
      [employee_id, email]
    );

    if (existingEmployee.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Employee ID or email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new employee
    const result = await db.query(`
      INSERT INTO employees (
        employee_id, first_name, last_name, email, password_hash, 
        phone, department, position, hire_date, salary, role,
        emergency_contact_name, emergency_contact_phone, address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, employee_id, first_name, last_name, email, 
                phone, department, position, hire_date, salary, role
    `, [
      employee_id, first_name, last_name, email, hashedPassword,
      phone, department, position, hire_date, salary, role,
      emergency_contact_name, emergency_contact_phone, address
    ]);

    // Create initial leave balances
    await db.query(`
      INSERT INTO leave_balances (employee_id, leave_type, total_days, used_days, remaining_days)
      VALUES 
        ($1, 'annual', 20, 0, 20),
        ($1, 'sick', 10, 0, 10),
        ($1, 'personal', 5, 0, 5)
    `, [result.rows[0].id]);

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating employee'
    });
  }
});

// Update employee (Self profile or Admin)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.params.id;
    const {
      first_name,
      last_name,
      email,
      phone,
      department,
      position,
      salary,
      role,
      emergency_contact_name,
      emergency_contact_phone,
      address
    } = req.body;

    // Check permissions
    const isOwnProfile = req.user.id === parseInt(employeeId);
    const isAdmin = req.user.role === 'admin';

    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Build update query dynamically based on user role
    let updateFields = [];
    let values = [];
    let paramCount = 1;

    // Fields that employees can update themselves
    const selfEditableFields = ['first_name', 'last_name', 'phone', 'emergency_contact_name', 'emergency_contact_phone', 'address'];
    
    // Fields that only admins can update
    const adminOnlyFields = ['email', 'department', 'position', 'salary', 'role'];

    const fieldsToUpdate = { first_name, last_name, email, phone, department, position, salary, role, emergency_contact_name, emergency_contact_phone, address };

    for (const [field, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) {
        // Check if user has permission to update this field
        if (!isAdmin && adminOnlyFields.includes(field)) {
          continue; // Skip admin-only fields for non-admin users
        }
        
        updateFields.push(`${field} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Add updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(employeeId);

    const query = `
      UPDATE employees 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING id, employee_id, first_name, last_name, email, 
                phone, department, position, salary, role
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating employee'
    });
  }
});

// Deactivate employee (Soft delete - Admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const employeeId = req.params.id;

    // Cannot delete self
    if (req.user.id === parseInt(employeeId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const result = await db.query(`
      UPDATE employees 
      SET status = 'inactive', deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [employeeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating employee'
    });
  }
});

// Get employee leave balances
router.get('/:id/leave-balances', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.params.id;
    
    // Check permissions
    if (req.user.id !== parseInt(employeeId) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await db.query(`
      SELECT 
        leave_type,
        total_days,
        used_days,
        remaining_days,
        year
      FROM leave_balances 
      WHERE employee_id = $1 AND year = EXTRACT(YEAR FROM CURRENT_DATE)
      ORDER BY leave_type
    `, [employeeId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching leave balances:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leave balances'
    });
  }
});

// Get employee leave history
router.get('/:id/leave-history', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.params.id;
    const { page = 1, limit = 10 } = req.query;
    
    // Check permissions
    if (req.user.id !== parseInt(employeeId) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT 
        lr.id,
        lr.leave_type,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.reason,
        lr.status,
        lr.approved_by,
        lr.approved_at,
        lr.comments,
        lr.created_at,
        approver.first_name || ' ' || approver.last_name as approver_name
      FROM leave_requests lr
      LEFT JOIN employees approver ON lr.approved_by = approver.id
      WHERE lr.employee_id = $1
      ORDER BY lr.created_at DESC
      LIMIT $2 OFFSET $3
    `, [employeeId, limit, offset]);

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM leave_requests WHERE employee_id = $1',
      [employeeId]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching leave history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leave history'
    });
  }
});

module.exports = router;