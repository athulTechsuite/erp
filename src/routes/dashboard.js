const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const Employee = require('../models/Employee');
const Leave = require('../models/Leave');
const Asset = require('../models/Asset');
const Announcement = require('../models/Announcement');

// Dashboard overview - accessible to all authenticated users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let dashboardData = {};
    
    if (userRole === 'admin' || userRole === 'manager') {
      // Admin/Manager dashboard - company overview
      const totalEmployees = await Employee.countDocuments({ isActive: true });
      const pendingLeaves = await Leave.countDocuments({ status: 'pending' });
      const approvedLeavesToday = await Leave.countDocuments({
        status: 'approved',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      });
      
      const recentLeaveRequests = await Leave.find({ status: 'pending' })
        .populate('employeeId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(5);
      
      const totalAssets = await Asset.countDocuments({ isActive: true });
      const assetsNeedingMaintenance = await Asset.countDocuments({
        maintenanceStatus: 'due',
        isActive: true
      });
      
      dashboardData = {
        overview: {
          totalEmployees,
          pendingLeaves,
          approvedLeavesToday,
          totalAssets,
          assetsNeedingMaintenance
        },
        recentLeaveRequests,
        userInfo: {
          name: `${req.user.firstName} ${req.user.lastName}`,
          role: userRole,
          email: req.user.email
        }
      };
    } else {
      // Employee dashboard - personal overview
      const employee = await Employee.findById(userId);
      const myLeaves = await Leave.find({ employeeId: userId })
        .sort({ createdAt: -1 })
        .limit(5);
      
      const pendingLeaves = await Leave.countDocuments({
        employeeId: userId,
        status: 'pending'
      });
      
      const approvedLeaves = await Leave.countDocuments({
        employeeId: userId,
        status: 'approved'
      });
      
      dashboardData = {
        personalOverview: {
          leaveBalance: employee ? employee.leaveBalance : 0,
          pendingRequests: pendingLeaves,
          approvedRequests: approvedLeaves,
          totalRequests: myLeaves.length
        },
        myRecentLeaves: myLeaves,
        userInfo: {
          name: `${req.user.firstName} ${req.user.lastName}`,
          role: userRole,
          email: req.user.email,
          employeeId: req.user.employeeId || userId
        }
      };
    }
    
    res.json({
      success: true,
      data: dashboardData
    });
    
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading dashboard data',
      error: error.message
    });
  }
});

// Company announcements - accessible to all authenticated users
router.get('/announcements', authenticateToken, async (req, res) => {
  try {
    const announcements = await Announcement.find({ 
      isPublished: true 
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('title content createdAt');
    
    res.json({
      success: true,
      data: announcements
    });
    
  } catch (error) {
    console.error('Announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading announcements',
      error: error.message
    });
  }
});

// Manage announcements - admin only
router.get('/announcements/manage', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const announcements = await Announcement.find({})
      .sort({ createdAt: -1 })
      .populate('createdBy', 'firstName lastName email');
    
    res.json({
      success: true,
      data: announcements
    });
    
  } catch (error) {
    console.error('Manage announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading announcements for management',
      error: error.message
    });
  }
});

// Create announcement - admin only
router.post('/announcements', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { title, content, isPublished = false } = req.body;
    
    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
        field: 'title'
      });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Content is required',
        field: 'content'
      });
    }
    
    const announcement = new Announcement({
      title: title.trim(),
      content: content.trim(),
      isPublished,
      createdBy: req.user.id
    });
    
    await announcement.save();
    await announcement.populate('createdBy', 'firstName lastName email');
    
    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
    
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating announcement',
      error: error.message
    });
  }
});

// Update announcement - admin only
router.put('/announcements/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, isPublished } = req.body;
    
    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
        field: 'title'
      });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Content is required',
        field: 'content'
      });
    }
    
    const announcement = await Announcement.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        content: content.trim(),
        isPublished: Boolean(isPublished),
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');
    
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
      message: 'Error updating announcement',
      error: error.message
    });
  }
});

// Delete announcement - admin only
router.delete('/announcements/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findByIdAndDelete(id);
    
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
      message: 'Error deleting announcement',
      error: error.message
    });
  }
});

// Company metrics - admin only
router.get('/metrics', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Employee metrics
    const newEmployees = await Employee.countDocuments({
      createdAt: { $gte: startDate },
      isActive: true
    });
    
    const totalEmployees = await Employee.countDocuments({ isActive: true });
    
    // Leave metrics
    const totalLeaveRequests = await Leave.countDocuments({
      createdAt: { $gte: startDate }
    });
    
    const approvedLeaves = await Leave.countDocuments({
      createdAt: { $gte: startDate },
      status: 'approved'
    });
    
    const rejectedLeaves = await Leave.countDocuments({
      createdAt: { $gte: startDate },
      status: 'rejected'
    });
    
    const pendingLeaves = await Leave.countDocuments({
      status: 'pending'
    });
    
    // Leave types breakdown
    const leaveTypeBreakdown = await Leave.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'approved'
        }
      },
      {
        $group: {
          _id: '$leaveType',
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' }
        }
      }
    ]);
    
    // Asset metrics
    const totalAssets = await Asset.countDocuments({ isActive: true });
    const assetsNeedingMaintenance = await Asset.countDocuments({
      maintenanceStatus: 'due',
      isActive: true
    });
    
    // Monthly trend data
    const monthlyLeaves = await Leave.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);
    
    const metrics = {
      period: `${days} days`,
      employees: {
        total: totalEmployees,
        new: newEmployees
      },
      leaves: {
        total: totalLeaveRequests,
        approved: approvedLeaves,
        rejected: rejectedLeaves,
        pending: pendingLeaves,
        approvalRate: totalLeaveRequests > 0 ? ((approvedLeaves / totalLeaveRequests) * 100).toFixed(1) : 0
      },
      leaveTypes: leaveTypeBreakdown,
      assets: {
        total: totalAssets,
        needingMaintenance: assetsNeedingMaintenance
      },
      trends: {
        monthlyLeaves
      }
    };
    
    res.json({
      success: true,
      data: metrics
    });
    
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading metrics',
      error: error.message
    });
  }
});

// Quick actions - role-based
router.get('/quick-actions', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    let actions = [];
    
    if (userRole === 'admin') {
      actions = [
        { id: 'add-employee', label: 'Add New Employee', icon: 'user-plus', url: '/employees/new' },
        { id: 'review-leaves', label: 'Review Leave Requests', icon: 'clock', url: '/leaves/pending' },
        { id: 'view-reports', label: 'Generate Reports', icon: 'chart-bar', url: '/reports' },
        { id: 'manage-assets', label: 'Manage Assets', icon: 'box', url: '/assets' },
        { id: 'manage-announcements', label: 'Manage Announcements', icon: 'bullhorn', url: '/dashboard/announcements/manage' },
        { id: 'system-settings', label: 'System Settings', icon: 'cog', url: '/settings' }
      ];
    } else if (userRole === 'manager') {
      actions = [
        { id: 'review-leaves', label: 'Review Leave Requests', icon: 'clock', url: '/leaves/pending' },
        { id: 'team-overview', label: 'Team Overview', icon: 'users', url: '/team' },
        { id: 'view-reports', label: 'Team Reports', icon: 'chart-bar', url: '/reports' }
      ];
    } else {
      actions = [
        { id: 'request-leave', label: 'Request Leave', icon: 'calendar-plus', url: '/leaves/new' },
        { id: 'my-leaves', label: 'My Leave History', icon: 'history', url: '/leaves/my-requests' },
        { id: 'my-profile', label: 'Update Profile', icon: 'user', url: '/profile' }
      ];
    }
    
    res.json({
      success: true,
      data: { actions }
    });
    
  } catch (error) {
    console.error('Quick actions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading quick actions',
      error: error.message
    });
  }
});

// Notifications - all authenticated users
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    let notifications = [];
    
    if (userRole === 'admin' || userRole === 'manager') {
      // Get pending leave requests as notifications
      const pendingLeaves = await Leave.find({ status: 'pending' })
        .populate('employeeId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10);
      
      notifications = pendingLeaves.map(leave => ({
        id: leave._id,
        type: 'leave_request',
        title: 'New Leave Request',
        message: `${leave.employeeId.firstName} ${leave.employeeId.lastName} requested ${leave.leaveType} leave`,
        timestamp: leave.createdAt,
        actionUrl: `/leaves/${leave._id}`,
        priority: 'medium'
      }));
      
      // Check for assets needing maintenance
      const assetsNeedingMaintenance = await Asset.find({
        maintenanceStatus: 'due',
        isActive: true
      }).limit(5);
      
      const assetNotifications = assetsNeedingMaintenance.map(asset => ({
        id: `asset_${asset._id}`,
        type: 'maintenance_due',
        title: 'Maintenance Due',
        message: `${asset.name} requires maintenance`,
        timestamp: asset.nextMaintenanceDate,
        actionUrl: `/assets/${asset._id}`,
        priority: 'high'
      }));
      
      notifications = [...notifications, ...assetNotifications];
    } else {
      // Employee notifications - their leave request updates
      const myLeaves = await Leave.find({
        employeeId: userId,
        status: { $in: ['approved', 'rejected'] },
        updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      }).sort({ updatedAt: -1 }).limit(10);
      
      notifications = myLeaves.map(leave => ({
        id: leave._id,
        type: `leave_${leave.status}`,
        title: `Leave Request ${leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}`,
        message: `Your ${leave.leaveType} leave request has been ${leave.status}`,
        timestamp: leave.updatedAt,
        actionUrl: `/leaves/${leave._id}`,
        priority: leave.status === 'approved' ? 'low' : 'medium'
      }));
    }
    
    // Sort by timestamp (newest first)
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      data: {
        notifications,
        unreadCount: notifications.length
      }
    });
    
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading notifications',
      error: error.message
    });
  }
});

module.exports = router;