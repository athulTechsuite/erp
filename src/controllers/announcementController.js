const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const notificationService = require('../services/notificationService');

// Get all announcements for dashboard widget
exports.getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .limit(10);

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: error.message
    });
  }
};

// Get announcements for admin management (with pagination)
exports.getAnnouncementsForAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .skip(skip)
      .limit(limit);

    const total = await Announcement.countDocuments();

    res.json({
      success: true,
      data: {
        announcements,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalAnnouncements: total,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching announcements for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: error.message
    });
  }
};

// Create new announcement
exports.createAnnouncement = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, content, priority = 'normal' } = req.body;

    // Create new announcement
    const announcement = new Announcement({
      title: title.trim(),
      content: content.trim(),
      priority,
      createdBy: req.user.id,
      isActive: true
    });

    await announcement.save();

    // Populate createdBy field for response
    await announcement.populate('createdBy', 'name email');

    // Send notifications to all active users
    try {
      const activeUsers = await User.find({ 
        isActive: true, 
        _id: { $ne: req.user.id } // Exclude the creator
      }).select('_id');
      
      const userIds = activeUsers.map(user => user._id);
      
      await notificationService.createBulkNotifications({
        userIds,
        type: 'announcement',
        title: 'New Company Announcement',
        message: `New announcement: ${title}`,
        data: {
          announcementId: announcement._id,
          announcementTitle: title,
          priority: priority
        }
      });
    } catch (notificationError) {
      console.error('Error sending notifications:', notificationError);
      // Don't fail the announcement creation if notifications fail
    }

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });

  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating announcement',
      error: error.message
    });
  }
};

// Get single announcement by ID
exports.getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id)
      .populate('createdBy', 'name email');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check if user is admin or if announcement is active
    if (req.user.role !== 'admin' && !announcement.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    res.json({
      success: true,
      data: announcement
    });

  } catch (error) {
    console.error('Error fetching announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement',
      error: error.message
    });
  }
};

// Update announcement (admin only)
exports.updateAnnouncement = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { title, content, priority, isActive } = req.body;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Update fields
    if (title !== undefined) announcement.title = title.trim();
    if (content !== undefined) announcement.content = content.trim();
    if (priority !== undefined) announcement.priority = priority;
    if (isActive !== undefined) announcement.isActive = isActive;
    
    announcement.updatedAt = new Date();

    await announcement.save();
    await announcement.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });

  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: error.message
    });
  }
};

// Delete announcement (admin only)
exports.deleteAnnouncement = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }

    const { id } = req.params;

    const announcement = await Announcement.findById(id);
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
    console.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: error.message
    });
  }
};

// Get recent announcements for dashboard widget
exports.getRecentAnnouncements = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('createdBy', 'name')
      .select('title content priority createdAt createdBy');

    res.json({
      success: true,
      data: announcements
    });

  } catch (error) {
    console.error('Error fetching recent announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent announcements',
      error: error.message
    });
  }
};

// Mark announcement as read by user
exports.markAnnouncementAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check if announcement is active
    if (!announcement.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Add user to readBy array if not already present
    if (!announcement.readBy.includes(userId)) {
      announcement.readBy.push(userId);
      await announcement.save();
    }

    res.json({
      success: true,
      message: 'Announcement marked as read'
    });

  } catch (error) {
    console.error('Error marking announcement as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking announcement as read',
      error: error.message
    });
  }
};

// Get announcement statistics (admin only)
exports.getAnnouncementStats = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.'
      });
    }

    const totalAnnouncements = await Announcement.countDocuments();
    const activeAnnouncements = await Announcement.countDocuments({ isActive: true });
    const inactiveAnnouncements = await Announcement.countDocuments({ isActive: false });
    
    const priorityStats = await Announcement.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    const recentAnnouncements = await Announcement.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    res.json({
      success: true,
      data: {
        total: totalAnnouncements,
        active: activeAnnouncements,
        inactive: inactiveAnnouncements,
        recentWeek: recentAnnouncements,
        priorityBreakdown: priorityStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Error fetching announcement statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement statistics',
      error: error.message
    });
  }
};