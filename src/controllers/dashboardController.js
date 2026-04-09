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

      // Get company announcements
      let announcements = [];
      try {
        announcements = await Announcement.find({
          companyId,
          isPublished: true
        })
        .select('title content createdAt')
        .sort({ createdAt: -1 })
        .limit(5);
      } catch (error) {
        console.warn('Failed to fetch announcements:', error.message);
        announcements = [];
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
        inventory: inventoryStats,
        announcements,
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

      // Get company announcements
      let announcements = [];
      try {
        announcements = await Announcement.find({
          companyId,
          isPublished: true
        })
        .select('title content createdAt')
        .sort({ createdAt: -1 })
        .limit(5);
      } catch (error) {
        console.warn('Failed to fetch announcements:', error.message);
        announcements = [];
      }

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

  // Get company announcements for dashboard widget
  async getAnnouncements(req, res) {
    try {
      const { companyId } = req.user;

      const announcements = await Announcement.find({
        companyId,
        isPublished: true
      })
      .select('title content createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

      res.json({
        success: true,
        data: announcements
      });

    } catch (error) {
      console.error('Announcements fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch announcements',
        error: error.message
      });
    }
  }

  // Create new announcement (admin only)
  async createAnnouncement(req, res) {
    try {
      const { companyId, role } = req.user;
      const { title, content, isPublished = true } = req.body;

      // Check if user is admin
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      // Validate required fields
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: 'Title and content are required fields',
          errors: {
            title: !title ? 'Title is required' : null,
            content: !content ? 'Content is required' : null
          }
        });
      }

      const announcement = new Announcement({
        companyId,
        title: title.trim(),
        content: content.trim(),
        isPublished: Boolean(isPublished)
      });

      await announcement.save();

      res.status(201).json({
        success: true,
        message: 'Announcement created successfully',
        data: announcement
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

  // Update announcement (admin only)
  async updateAnnouncement(req, res) {
    try {
      const { companyId, role } = req.user;
      const { id } = req.params;
      const { title, content, isPublished } = req.body;

      // Check if user is admin
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      // Validate required fields
      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: 'Title and content are required fields',
          errors: {
            title: !title ? 'Title is required' : null,
            content: !content ? 'Content is required' : null
          }
        });
      }

      const announcement = await Announcement.findOneAndUpdate(
        { _id: id, companyId },
        {
          title: title.trim(),
          content: content.trim(),
          isPublished: Boolean(isPublished)
        },
        { new: true, runValidators: true }
      );

      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      res.json({
        success: true,
        message: 'Announcement updated successfully',
        data: announcement
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

      // Check if user is admin
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const announcement = await Announcement.findOneAndDelete({
        _id: id,
        companyId
      });

      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

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

  // Get all announcements for admin management (admin only)
  async getAnnouncementsForAdmin(req, res) {
    try {
      const { companyId, role } = req.user;

      // Check if user is admin
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const announcements = await Announcement.find({ companyId })
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: announcements
      });

    } catch (error) {
      console.error('Get admin announcements error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch announcements',
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

      const quickStats = {
        employeesOnLeaveToday,
        newRequestsThisMonth,
        activeEmployees,
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