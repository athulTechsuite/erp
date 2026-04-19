const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const InventoryItem = require('../models/InventoryItem');
const Announcement = require('../models/Announcement');

class DashboardController {
  // Get main dashboard data for admin/manager view
  async getAdminDashboard(req, res) {
    try {
      const { companyId } = req.user;

      // Get employee count and basic stats
      const totalEmployees = await Employee.countDocuments({ 
        companyId, 
        status: 'active' 
      });

      // Get leave requests statistics
      const pendingLeaves = await LeaveRequest.countDocuments({
        companyId,
        status: 'pending'
      });

      const thisMonthLeaves = await LeaveRequest.countDocuments({
        companyId,
        startDate: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      });

      // Get recent leave requests for admin review
      const recentLeaveRequests = await LeaveRequest.find({
        companyId,
        status: { $in: ['pending', 'approved', 'rejected'] }
      })
      .populate('employeeId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(5);

      // Get employees with low leave balance (less than 5 days)
      const lowLeaveBalanceEmployees = await Employee.find({
        companyId,
        status: 'active',
        'leaveBalance.annual': { $lt: 5 }
      }).select('firstName lastName email leaveBalance');

      // Get recent announcements for dashboard widget
      const recentAnnouncements = await Announcement.find({
        companyId,
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gte: new Date() } }
        ]
      })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(3);

      // Get inventory items count (if inventory module is used)
      let inventoryStats = null;
      try {
        const totalInventoryItems = await InventoryItem.countDocuments({ companyId });
        const lowStockItems = await InventoryItem.countDocuments({
          companyId,
          $expr: { $lte: ['$currentStock', '$minimumStock'] }
        });
        
        inventoryStats = {
          totalItems: totalInventoryItems,
          lowStockItems
        };
      } catch (error) {
        // Inventory module might not be implemented yet
        inventoryStats = { totalItems: 0, lowStockItems: 0 };
      }

      // Calculate leave utilization rate
      const allEmployees = await Employee.find({ 
        companyId, 
        status: 'active' 
      }).select('leaveBalance');
      
      let totalAllocated = 0;
      let totalUsed = 0;
      allEmployees.forEach(emp => {
        if (emp.leaveBalance) {
          totalAllocated += (emp.leaveBalance.annual || 0) + (emp.leaveBalance.used || 0);
          totalUsed += emp.leaveBalance.used || 0;
        }
      });

      const leaveUtilizationRate = totalAllocated > 0 ? 
        Math.round((totalUsed / totalAllocated) * 100) : 0;

      const dashboardData = {
        overview: {
          totalEmployees,
          pendingLeaves,
          thisMonthLeaves,
          leaveUtilizationRate
        },
        recentLeaveRequests,
        lowLeaveBalanceEmployees,
        recentAnnouncements,
        inventory: inventoryStats,
        lastUpdated: new Date()
      };

      res.json({
        success: true,
        data: dashboardData
      });

    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard data',
        error: error.message
      });
    }
  }

  // Get employee dashboard data
  async getEmployeeDashboard(req, res) {
    try {
      const { userId, companyId } = req.user;

      // Get employee data
      const employee = await Employee.findOne({ userId })
        .select('firstName lastName email leaveBalance department position');

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }

      // Get employee's leave requests
      const myLeaveRequests = await LeaveRequest.find({
        employeeId: employee._id
      })
      .sort({ createdAt: -1 })
      .limit(10);

      // Get upcoming approved leaves
      const upcomingLeaves = await LeaveRequest.find({
        employeeId: employee._id,
        status: 'approved',
        startDate: { $gte: new Date() }
      })
      .sort({ startDate: 1 })
      .limit(5);

      // Get active announcements for employee
      const announcements = await Announcement.find({
        companyId,
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gte: new Date() } }
        ]
      })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

      // Calculate leave statistics
      const thisYearLeaves = await LeaveRequest.find({
        employeeId: employee._id,
        startDate: {
          $gte: new Date(new Date().getFullYear(), 0, 1),
          $lt: new Date(new Date().getFullYear() + 1, 0, 1)
        }
      });

      const approvedThisYear = thisYearLeaves.filter(leave => leave.status === 'approved');
      const totalDaysTaken = approvedThisYear.reduce((sum, leave) => sum + leave.totalDays, 0);

      const dashboardData = {
        profile: {
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          department: employee.department,
          position: employee.position
        },
        leaveBalance: employee.leaveBalance,
        leaveStats: {
          totalDaysTaken,
          totalRequests: thisYearLeaves.length,
          pendingRequests: thisYearLeaves.filter(leave => leave.status === 'pending').length
        },
        recentRequests: myLeaveRequests,
        upcomingLeaves,
        announcements,
        lastUpdated: new Date()
      };

      res.json({
        success: true,
        data: dashboardData
      });

    } catch (error) {
      console.error('Employee dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee dashboard data',
        error: error.message
      });
    }
  }

  // Create new announcement (admin only)
  async createAnnouncement(req, res) {
    try {
      const { companyId, userId, role } = req.user;
      const { title, content, expiresAt } = req.body;

      // Check admin permissions
      if (!['admin', 'hr_admin', 'manager'].includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to create announcements'
        });
      }

      // Validate required fields
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: 'Title and content are required'
        });
      }

      const announcement = new Announcement({
        title: title.trim(),
        content: content.trim(),
        companyId,
        createdBy: userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      });

      await announcement.save();
      await announcement.populate('createdBy', 'firstName lastName');

      res.status(201).json({
        success: true,
        data: announcement,
        message: 'Announcement created successfully'
      });

    } catch (error) {
      console.error('Create announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create announcement',
        error: error.message
      });
    }
  }

  // Get all announcements for company
  async getAnnouncements(req, res) {
    try {
      const { companyId } = req.user;
      const { page = 1, limit = 10, includeExpired = 'false' } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      let filter = { companyId };
      
      // Filter out expired and inactive announcements unless requested
      if (includeExpired !== 'true') {
        filter = {
          ...filter,
          isActive: true,
          $or: [
            { expiresAt: null },
            { expiresAt: { $gte: new Date() } }
          ]
        };
      }

      const [announcements, total] = await Promise.all([
        Announcement.find(filter)
          .populate('createdBy', 'firstName lastName')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Announcement.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: {
          announcements,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get announcements error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch announcements',
        error: error.message
      });
    }
  }

  // Update announcement (admin only)
  async updateAnnouncement(req, res) {
    try {
      const { companyId, role } = req.user;
      const { id } = req.params;
      const { title, content, expiresAt, isActive } = req.body;

      // Check admin permissions
      if (!['admin', 'hr_admin', 'manager'].includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to update announcements'
        });
      }

      const announcement = await Announcement.findOne({ _id: id, companyId });
      
      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      // Update fields if provided
      if (title !== undefined) announcement.title = title.trim();
      if (content !== undefined) announcement.content = content.trim();
      if (expiresAt !== undefined) announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
      if (isActive !== undefined) announcement.isActive = isActive;

      announcement.updatedAt = new Date();
      await announcement.save();
      await announcement.populate('createdBy', 'firstName lastName');

      res.json({
        success: true,
        data: announcement,
        message: 'Announcement updated successfully'
      });

    } catch (error) {
      console.error('Update announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update announcement',
        error: error.message
      });
    }
  }

  // Delete announcement (admin only)
  async deleteAnnouncement(req, res) {
    try {
      const { companyId, role } = req.user;
      const { id } = req.params;

      // Check admin permissions
      if (!['admin', 'hr_admin', 'manager'].includes(role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to delete announcements'
        });
      }

      const announcement = await Announcement.findOne({ _id: id, companyId });
      
      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      await Announcement.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Announcement deleted successfully'
      });

    } catch (error) {
      console.error('Delete announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete announcement',
        error: error.message
      });
    }
  }

  // Get company-wide leave calendar data
  async getLeaveCalendar(req, res) {
    try {
      const { companyId } = req.user;
      const { month, year } = req.query;

      let dateFilter = {};
      if (month && year) {
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0);
        dateFilter = {
          $or: [
            { startDate: { $gte: startDate, $lte: endDate } },
            { endDate: { $gte: startDate, $lte: endDate } },
            { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
          ]
        };
      }

      const leaveCalendar = await LeaveRequest.find({
        companyId,
        status: 'approved',
        ...dateFilter
      })
      .populate('employeeId', 'firstName lastName')
      .select('startDate endDate totalDays leaveType employeeId')
      .sort({ startDate: 1 });

      const calendarData = leaveCalendar.map(leave => ({
        id: leave._id,
        title: `${leave.employeeId.firstName} ${leave.employeeId.lastName} - ${leave.leaveType}`,
        start: leave.startDate,
        end: leave.endDate,
        type: leave.leaveType,
        employee: `${leave.employeeId.firstName} ${leave.employeeId.lastName}`,
        duration: leave.totalDays
      }));

      res.json({
        success: true,
        data: calendarData
      });

    } catch (error) {
      console.error('Leave calendar error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leave calendar data',
        error: error.message
      });
    }
  }

  // Get quick stats for widgets
  async getQuickStats(req, res) {
    try {
      const { companyId } = req.user;
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Employees on leave today
      const employeesOnLeaveToday = await LeaveRequest.countDocuments({
        companyId,
        status: 'approved',
        startDate: { $lte: today },
        endDate: { $gte: today }
      });

      // New leave requests this month
      const newRequestsThisMonth = await LeaveRequest.countDocuments({
        companyId,
        createdAt: { $gte: startOfMonth }
      });

      // Active employees
      const activeEmployees = await Employee.countDocuments({
        companyId,
        status: 'active'
      });

      // Active announcements count
      const activeAnnouncements = await Announcement.countDocuments({
        companyId,
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gte: today } }
        ]
      });

      const quickStats = {
        employeesOnLeaveToday,
        newRequestsThisMonth,
        activeEmployees,
        activeAnnouncements,
        timestamp: new Date()
      };

      res.json({
        success: true,
        data: quickStats
      });

    } catch (error) {
      console.error('Quick stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quick stats',
        error: error.message
      });
    }
  }
}

module.exports = new DashboardController();