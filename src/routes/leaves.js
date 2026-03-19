const express = require('express');
const router = express.Router();
const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get all leaves (admin only) or employee's own leaves
router.get('/', auth, async (req, res) => {
  try {
    let leaves;
    if (req.user.role === 'admin') {
      leaves = await Leave.find()
        .populate('employee', 'firstName lastName email department')
        .sort({ createdAt: -1 });
    } else {
      leaves = await Leave.find({ employee: req.user.id })
        .populate('employee', 'firstName lastName email')
        .sort({ createdAt: -1 });
    }
    res.json(leaves);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// Get pending leave requests (admin only)
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const pendingLeaves = await Leave.find({ status: 'pending' })
      .populate('employee', 'firstName lastName email department')
      .sort({ createdAt: -1 });

    res.json(pendingLeaves);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// Get leave balance for current user
router.get('/balance', auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.user.id);
    if (!employee) {
      return res.status(404).json({ msg: 'Employee not found' });
    }

    // Calculate used leaves for current year
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    const approvedLeaves = await Leave.find({
      employee: req.user.id,
      status: 'approved',
      startDate: { $gte: startOfYear },
      endDate: { $lte: endOfYear }
    });

    const usedDays = approvedLeaves.reduce((total, leave) => {
      return total + leave.totalDays;
    }, 0);

    const balance = {
      totalAllowed: employee.annualLeaveBalance || 20,
      used: usedDays,
      remaining: (employee.annualLeaveBalance || 20) - usedDays,
      year: currentYear
    };

    res.json(balance);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// Submit leave request
router.post('/', [
  auth,
  [
    body('type', 'Leave type is required').not().isEmpty(),
    body('startDate', 'Start date is required').isISO8601(),
    body('endDate', 'End date is required').isISO8601(),
    body('reason', 'Reason is required').not().isEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { type, startDate, endDate, reason } = req.body;

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      return res.status(400).json({ msg: 'Start date must be before end date' });
    }

    if (start < new Date()) {
      return res.status(400).json({ msg: 'Cannot apply for past dates' });
    }

    // Calculate total days (excluding weekends)
    let totalDays = 0;
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        totalDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Check if employee has sufficient balance
    const employee = await Employee.findById(req.user.id);
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    const approvedLeaves = await Leave.find({
      employee: req.user.id,
      status: 'approved',
      startDate: { $gte: startOfYear },
      endDate: { $lte: endOfYear }
    });

    const usedDays = approvedLeaves.reduce((total, leave) => {
      return total + leave.totalDays;
    }, 0);

    const remainingBalance = (employee.annualLeaveBalance || 20) - usedDays;

    if (type === 'annual' && totalDays > remainingBalance) {
      return res.status(400).json({ 
        msg: `Insufficient leave balance. You have ${remainingBalance} days remaining.` 
      });
    }

    // Check for overlapping leave requests
    const overlappingLeaves = await Leave.find({
      employee: req.user.id,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    if (overlappingLeaves.length > 0) {
      return res.status(400).json({ 
        msg: 'You have overlapping leave requests for the selected dates' 
      });
    }

    const leave = new Leave({
      employee: req.user.id,
      type,
      startDate: start,
      endDate: end,
      totalDays,
      reason,
      status: 'pending'
    });

    await leave.save();
    await leave.populate('employee', 'firstName lastName email');

    res.json(leave);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// Update leave status (admin only)
router.put('/:id/status', [
  auth,
  [
    body('status', 'Status is required').isIn(['approved', 'rejected']),
    body('adminComments', 'Admin comments are required for rejection').if(body('status').equals('rejected')).not().isEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { status, adminComments } = req.body;
    
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ msg: 'Leave request not found' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({ msg: 'Only pending leave requests can be updated' });
    }

    leave.status = status;
    leave.adminComments = adminComments;
    leave.reviewedBy = req.user.id;
    leave.reviewedAt = new Date();

    await leave.save();
    await leave.populate('employee', 'firstName lastName email');

    res.json(leave);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// Cancel leave request (employee can cancel their own pending requests)
router.delete('/:id', auth, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    
    if (!leave) {
      return res.status(404).json({ msg: 'Leave request not found' });
    }

    // Check if user owns the leave request or is admin
    if (leave.employee.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    if (leave.status === 'approved') {
      return res.status(400).json({ msg: 'Cannot cancel approved leave requests' });
    }

    await Leave.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Leave request cancelled successfully' });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// Get leave statistics (admin only)
router.get('/statistics', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    const totalRequests = await Leave.countDocuments({
      createdAt: { $gte: startOfYear, $lte: endOfYear }
    });

    const pendingRequests = await Leave.countDocuments({
      status: 'pending',
      createdAt: { $gte: startOfYear, $lte: endOfYear }
    });

    const approvedRequests = await Leave.countDocuments({
      status: 'approved',
      createdAt: { $gte: startOfYear, $lte: endOfYear }
    });

    const rejectedRequests = await Leave.countDocuments({
      status: 'rejected',
      createdAt: { $gte: startOfYear, $lte: endOfYear }
    });

    // Get leave types breakdown
    const leaveTypeBreakdown = await Leave.aggregate([
      { 
        $match: { 
          status: 'approved',
          startDate: { $gte: startOfYear },
          endDate: { $lte: endOfYear }
        } 
      },
      { 
        $group: { 
          _id: '$type', 
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' }
        } 
      }
    ]);

    const statistics = {
      year: currentYear,
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      leaveTypeBreakdown
    };

    res.json(statistics);
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;