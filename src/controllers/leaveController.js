const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const { validationResult } = require('express-validator');

// Get all leave requests (admin/manager view)
const getAllLeaveRequests = async (req, res) => {
  try {
    const { status, employee, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (employee) filter.employee = employee;
    
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    const leaves = await Leave.find(filter)
      .populate('employee', 'firstName lastName email department')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Leave.countDocuments(filter);

    res.json({
      success: true,
      data: leaves,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get all leave requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave requests'
    });
  }
};

// Get leave requests for current user
const getMyLeaveRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const leaves = await Leave.find({ employee: req.user.id })
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Leave.countDocuments({ employee: req.user.id });

    res.json({
      success: true,
      data: leaves,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get my leave requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your leave requests'
    });
  }
};

// Get single leave request
const getLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const leave = await Leave.findById(id)
      .populate('employee', 'firstName lastName email department')
      .populate('approvedBy', 'firstName lastName');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check if user can view this leave request
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && leave.employee._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: leave
    });
  } catch (error) {
    console.error('Get leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave request'
    });
  }
};

// Create leave request
const createLeaveRequest = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { leaveType, startDate, endDate, reason, halfDay } = req.body;
    
    // Calculate days requested
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    let daysRequested = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    
    if (halfDay) {
      daysRequested = 0.5;
    }

    // Get employee to check leave balance
    const employee = await Employee.findById(req.user.id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if employee has sufficient balance
    const currentBalance = employee.leaveBalance[leaveType] || 0;
    if (currentBalance < daysRequested) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${leaveType} balance. Available: ${currentBalance} days, Requested: ${daysRequested} days`
      });
    }

    // Check for overlapping leave requests
    const overlappingLeave = await Leave.findOne({
      employee: req.user.id,
      status: { $in: ['pending', 'approved'] },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (overlappingLeave) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave request for this period'
      });
    }

    // Create leave request
    const leave = new Leave({
      employee: req.user.id,
      leaveType,
      startDate: start,
      endDate: end,
      daysRequested,
      reason,
      halfDay: halfDay || false,
      status: 'pending'
    });

    await leave.save();

    // Populate employee data for response
    await leave.populate('employee', 'firstName lastName email department');

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: leave
    });
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create leave request'
    });
  }
};

// Update leave request (employee can only update pending requests)
const updateLeaveRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { leaveType, startDate, endDate, reason, halfDay } = req.body;

    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check if user can update this leave request
    if (leave.employee.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow updates to pending requests
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only update pending leave requests'
      });
    }

    // Calculate new days requested
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    let daysRequested = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    
    if (halfDay) {
      daysRequested = 0.5;
    }

    // Get employee to check leave balance
    const employee = await Employee.findById(req.user.id);
    const currentBalance = employee.leaveBalance[leaveType] || 0;
    if (currentBalance < daysRequested) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${leaveType} balance. Available: ${currentBalance} days, Requested: ${daysRequested} days`
      });
    }

    // Check for overlapping leave requests (excluding current request)
    const overlappingLeave = await Leave.findOne({
      _id: { $ne: id },
      employee: req.user.id,
      status: { $in: ['pending', 'approved'] },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (overlappingLeave) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave request for this period'
      });
    }

    // Update leave request
    leave.leaveType = leaveType;
    leave.startDate = start;
    leave.endDate = end;
    leave.daysRequested = daysRequested;
    leave.reason = reason;
    leave.halfDay = halfDay || false;
    leave.updatedAt = new Date();

    await leave.save();
    await leave.populate('employee', 'firstName lastName email department');

    res.json({
      success: true,
      message: 'Leave request updated successfully',
      data: leave
    });
  } catch (error) {
    console.error('Update leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update leave request'
    });
  }
};

// Delete leave request (employee can only delete pending requests)
const deleteLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check if user can delete this leave request
    if (leave.employee.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow deletion of pending requests
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete pending leave requests'
      });
    }

    await Leave.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Leave request deleted successfully'
    });
  } catch (error) {
    console.error('Delete leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete leave request'
    });
  }
};

// Approve/reject leave request (admin/manager only)
const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved or rejected'
      });
    }

    const leave = await Leave.findById(id).populate('employee');
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave request has already been processed'
      });
    }

    // Update leave request status
    leave.status = status;
    leave.approvedBy = req.user.id;
    leave.approvedAt = new Date();
    
    if (status === 'rejected' && rejectionReason) {
      leave.rejectionReason = rejectionReason;
    }

    // If approved, deduct from employee leave balance
    if (status === 'approved') {
      const employee = leave.employee;
      if (!employee.leaveBalance[leave.leaveType]) {
        employee.leaveBalance[leave.leaveType] = 0;
      }
      employee.leaveBalance[leave.leaveType] -= leave.daysRequested;
      await employee.save();
    }

    await leave.save();
    await leave.populate('approvedBy', 'firstName lastName');

    res.json({
      success: true,
      message: `Leave request ${status} successfully`,
      data: leave
    });
  } catch (error) {
    console.error('Update leave status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update leave request status'
    });
  }
};

// Get leave statistics
const getLeaveStats = async (req, res) => {
  try {
    const { employeeId, year = new Date().getFullYear() } = req.query;
    
    // Build match criteria
    const matchCriteria = {
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`)
      }
    };

    // If not admin/manager, only show own stats
    if (req.user.role === 'employee') {
      matchCriteria.employee = req.user.id;
    } else if (employeeId) {
      matchCriteria.employee = employeeId;
    }

    const stats = await Leave.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            status: '$status',
            leaveType: '$leaveType'
          },
          count: { $sum: 1 },
          totalDays: { $sum: '$daysRequested' }
        }
      },
      {
        $group: {
          _id: '$_id.status',
          leaveTypes: {
            $push: {
              type: '$_id.leaveType',
              count: '$count',
              totalDays: '$totalDays'
            }
          },
          totalRequests: { $sum: '$count' },
          totalDays: { $sum: '$totalDays' }
        }
      }
    ]);

    // Get pending requests count
    const pendingCount = await Leave.countDocuments({
      ...matchCriteria,
      status: 'pending'
    });

    res.json({
      success: true,
      data: {
        stats,
        pendingCount,
        year: parseInt(year)
      }
    });
  } catch (error) {
    console.error('Get leave stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave statistics'
    });
  }
};

// Get leave balance for employee
const getLeaveBalance = async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req.user.id;
    
    // Check if user can view this balance
    if (req.user.role === 'employee' && employeeId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const employee = await Employee.findById(employeeId).select('firstName lastName leaveBalance');
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get used leave for current year
    const currentYear = new Date().getFullYear();
    const usedLeave = await Leave.aggregate([
      {
        $match: {
          employee: employee._id,
          status: 'approved',
          createdAt: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: '$leaveType',
          totalUsed: { $sum: '$daysRequested' }
        }
      }
    ]);

    // Format response
    const balanceData = {
      employee: {
        id: employee._id,
        name: `${employee.firstName} ${employee.lastName}`,
      },
      balances: employee.leaveBalance,
      used: {},
      year: currentYear
    };

    usedLeave.forEach(leave => {
      balanceData.used[leave._id] = leave.totalUsed;
    });

    res.json({
      success: true,
      data: balanceData
    });
  } catch (error) {
    console.error('Get leave balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave balance'
    });
  }
};

module.exports = {
  getAllLeaveRequests,
  getMyLeaveRequests,
  getLeaveRequest,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  updateLeaveStatus,
  getLeaveStats,
  getLeaveBalance
};