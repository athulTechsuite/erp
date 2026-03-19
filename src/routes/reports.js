const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');

// Get HR reports (admin only)
router.get('/hr', auth, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Build department filter
    const deptFilter = {};
    if (department) {
      deptFilter.department = department;
    }

    // Employee statistics
    const totalEmployees = await Employee.countDocuments({ isActive: true });
    const employeesByDept = await Employee.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    // Leave statistics
    const leaveStats = await LeaveRequest.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDays: { $sum: '$days' }
        }
      }
    ]);

    // Leave by type
    const leaveByType = await LeaveRequest.aggregate([
      { $match: { ...dateFilter, status: 'approved' } },
      {
        $group: {
          _id: '$leaveType',
          count: { $sum: 1 },
          totalDays: { $sum: '$days' }
        }
      }
    ]);

    // Monthly leave trends
    const monthlyTrends = await LeaveRequest.aggregate([
      { $match: { ...dateFilter, status: 'approved' } },
      {
        $group: {
          _id: {
            year: { $year: '$startDate' },
            month: { $month: '$startDate' }
          },
          count: { $sum: 1 },
          totalDays: { $sum: '$days' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Top leave requesters
    const topRequesters = await LeaveRequest.aggregate([
      { $match: { ...dateFilter, status: 'approved' } },
      {
        $group: {
          _id: '$employee',
          totalRequests: { $sum: 1 },
          totalDays: { $sum: '$days' }
        }
      },
      { $sort: { totalDays: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employeeInfo'
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalEmployees,
          totalPendingRequests: leaveStats.find(s => s._id === 'pending')?.count || 0,
          totalApprovedRequests: leaveStats.find(s => s._id === 'approved')?.count || 0,
          totalRejectedRequests: leaveStats.find(s => s._id === 'rejected')?.count || 0
        },
        employeesByDept,
        leaveStats,
        leaveByType,
        monthlyTrends,
        topRequesters
      }
    });
  } catch (error) {
    console.error('HR reports error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get business metrics (admin only)
router.get('/business', auth, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Employee growth over time
    const employeeGrowth = await Employee.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          newHires: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Department distribution
    const deptDistribution = await Employee.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          avgSalary: { $avg: '$salary' }
        }
      }
    ]);

    // Leave utilization rates
    const leaveUtilization = await Employee.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'leaverequests',
          localField: '_id',
          foreignField: 'employee',
          as: 'leaveRequests'
        }
      },
      {
        $project: {
          name: 1,
          department: 1,
          annualLeaveBalance: 1,
          usedLeave: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$leaveRequests',
                    cond: { $eq: ['$$this.status', 'approved'] }
                  }
                },
                as: 'req',
                in: '$$req.days'
              }
            }
          }
        }
      },
      {
        $addFields: {
          utilizationRate: {
            $multiply: [
              { $divide: ['$usedLeave', '$annualLeaveBalance'] },
              100
            ]
          }
        }
      }
    ]);

    // Productivity metrics (basic)
    const productivityMetrics = {
      avgLeavePerEmployee: await LeaveRequest.aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id: null,
            avgDaysPerRequest: { $avg: '$days' }
          }
        }
      ]),
      absenteeismRate: await calculateAbsenteeismRate(dateFilter)
    };

    res.json({
      success: true,
      data: {
        employeeGrowth,
        deptDistribution,
        leaveUtilization,
        productivityMetrics
      }
    });
  } catch (error) {
    console.error('Business reports error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get employee report (employees can view their own, admins can view any)
router.get('/employee/:employeeId?', auth, async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req.user.id;
    
    // Check permission: employees can only view their own reports
    if (req.user.role !== 'admin' && employeeId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();

    // Get employee details
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    // Get leave requests for the year
    const leaveRequests = await LeaveRequest.find({
      employee: employeeId,
      $expr: {
        $eq: [{ $year: '$startDate' }, parseInt(currentYear)]
      }
    }).sort({ startDate: -1 });

    // Calculate leave summary
    const leaveSummary = {
      total: employee.annualLeaveBalance,
      used: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    };

    const leaveByType = {};

    leaveRequests.forEach(request => {
      leaveSummary[request.status] += request.days;
      
      if (request.status === 'approved') {
        leaveSummary.used += request.days;
      }

      if (!leaveByType[request.leaveType]) {
        leaveByType[request.leaveType] = {
          approved: 0,
          pending: 0,
          rejected: 0,
          total: 0
        };
      }
      
      leaveByType[request.leaveType][request.status] += request.days;
      leaveByType[request.leaveType].total += request.days;
    });

    leaveSummary.remaining = leaveSummary.total - leaveSummary.used;

    res.json({
      success: true,
      data: {
        employee: {
          name: employee.name,
          email: employee.email,
          department: employee.department,
          position: employee.position
        },
        year: currentYear,
        leaveSummary,
        leaveByType,
        leaveRequests,
        utilizationRate: ((leaveSummary.used / leaveSummary.total) * 100).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Employee report error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Export reports data
router.get('/export/:type', auth, isAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'json', startDate, endDate } = req.query;

    let data;
    let filename;

    switch (type) {
      case 'employees':
        data = await Employee.find({ isActive: true })
          .select('name email department position salary createdAt')
          .sort('name');
        filename = `employees_${Date.now()}`;
        break;

      case 'leave-requests':
        const filter = {};
        if (startDate && endDate) {
          filter.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          };
        }
        
        data = await LeaveRequest.find(filter)
          .populate('employee', 'name email department')
          .sort('-createdAt');
        filename = `leave_requests_${Date.now()}`;
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid report type' 
        });
    }

    if (format === 'csv') {
      // Simple CSV conversion
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.json`);
      res.json({ success: true, data });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// Helper function to calculate absenteeism rate
async function calculateAbsenteeismRate(dateFilter) {
  try {
    const totalWorkingDays = getWorkingDaysInPeriod(dateFilter);
    const totalAbsentDays = await LeaveRequest.aggregate([
      { 
        $match: { 
          ...dateFilter, 
          status: 'approved',
          leaveType: { $in: ['sick', 'personal'] }
        } 
      },
      { $group: { _id: null, total: { $sum: '$days' } } }
    ]);

    const absentDays = totalAbsentDays[0]?.total || 0;
    const totalEmployees = await Employee.countDocuments({ isActive: true });
    const totalPossibleWorkingDays = totalWorkingDays * totalEmployees;

    return totalPossibleWorkingDays > 0 
      ? ((absentDays / totalPossibleWorkingDays) * 100).toFixed(2)
      : 0;
  } catch (error) {
    console.error('Absenteeism calculation error:', error);
    return 0;
  }
}

// Helper function to get working days in period
function getWorkingDaysInPeriod(dateFilter) {
  if (!dateFilter.createdAt) return 30; // Default to 30 days
  
  const start = new Date(dateFilter.createdAt.$gte);
  const end = new Date(dateFilter.createdAt.$lte);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Approximate working days (excluding weekends)
  return Math.floor(diffDays * 5/7);
}

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0].toObject ? data[0].toObject() : data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(item => {
    const obj = item.toObject ? item.toObject() : item;
    return headers.map(header => {
      const value = obj[header];
      return typeof value === 'string' ? `"${value}"` : value;
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
}

module.exports = router;