const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');

/**
 * Get all announcements with pagination and filtering
 */
const getAnnouncements = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const skip = (page - 1) * limit;
    
    let filter = {};
    const now = new Date();
    
    // Filter based on status
    switch (status) {
      case 'active':
        filter = {
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: now } }
          ]
        };
        break;
      case 'expired':
        filter = { expiresAt: { $lte: now } };
        break;
      case 'archived':
        filter = { archived: true };
        break;
      default:
        // 'all' - no additional filter
        break;
    }
    
    const announcements = await Announcement.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Announcement.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        announcements,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: announcements.length,
          totalCount: total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements',
      error: error.message
    });
  }
};

/**
 * Get active announcements for dashboard widget
 */
const getActiveAnnouncements = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const now = new Date();
    
    const announcements = await Announcement.find({
      archived: false,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching active announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active announcements',
      error: error.message
    });
  }
};

/**
 * Get single announcement by ID
 */
const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');
    
    if (!announcement) {
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
      message: 'Failed to fetch announcement',
      error: error.message
    });
  }
};

/**
 * Create new announcement (Admin only)
 */
const createAnnouncement = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { title, content, type, priority, expiresAt, tags } = req.body;
    
    // Parse expiration date if provided
    let parsedExpiresAt = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (parsedExpiresAt <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Expiration date must be in the future'
        });
      }
    }
    
    const announcement = new Announcement({
      title: title.trim(),
      content: content.trim(),
      type: type || 'general',
      priority: priority || 'normal',
      expiresAt: parsedExpiresAt,
      tags: tags || [],
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    
    await announcement.save();
    
    // Populate creator info for response
    await announcement.populate('createdBy', 'firstName lastName email');
    
    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement',
      error: error.message
    });
  }
};

/**
 * Update announcement (Admin only)
 */
const updateAnnouncement = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { id } = req.params;
    const { title, content, type, priority, expiresAt, tags, archived } = req.body;
    
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    // Parse expiration date if provided
    let parsedExpiresAt = announcement.expiresAt;
    if (expiresAt !== undefined) {
      if (expiresAt === null || expiresAt === '') {
        parsedExpiresAt = null;
      } else {
        parsedExpiresAt = new Date(expiresAt);
        if (parsedExpiresAt <= new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Expiration date must be in the future'
          });
        }
      }
    }
    
    // Update fields
    if (title !== undefined) announcement.title = title.trim();
    if (content !== undefined) announcement.content = content.trim();
    if (type !== undefined) announcement.type = type;
    if (priority !== undefined) announcement.priority = priority;
    if (expiresAt !== undefined) announcement.expiresAt = parsedExpiresAt;
    if (tags !== undefined) announcement.tags = tags;
    if (archived !== undefined) announcement.archived = archived;
    
    announcement.updatedBy = req.user._id;
    announcement.updatedAt = new Date();
    
    await announcement.save();
    
    // Populate user info for response
    await announcement.populate([
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'updatedBy', select: 'firstName lastName email' }
    ]);
    
    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement',
      error: error.message
    });
  }
};

/**
 * Delete announcement (Admin only)
 */
const deleteAnnouncement = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
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
      message: 'Failed to delete announcement',
      error: error.message
    });
  }
};

/**
 * Archive expired announcements (System/Admin)
 */
const archiveExpiredAnnouncements = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const now = new Date();
    
    const result = await Announcement.updateMany(
      {
        expiresAt: { $lte: now },
        archived: false
      },
      {
        $set: {
          archived: true,
          updatedAt: now,
          updatedBy: req.user ? req.user._id : null
        }
      }
    );
    
    res.json({
      success: true,
      message: `${result.modifiedCount} expired announcements archived`,
      data: {
        archivedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error archiving expired announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive expired announcements',
      error: error.message
    });
  }
};

/**
 * Get announcement statistics (Admin only)
 */
const getAnnouncementStats = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const now = new Date();
    
    const stats = await Promise.all([
      // Total announcements
      Announcement.countDocuments(),
      // Active announcements
      Announcement.countDocuments({
        archived: false,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: now } }
        ]
      }),
      // Expired announcements
      Announcement.countDocuments({
        expiresAt: { $lte: now },
        archived: false
      }),
      // Archived announcements
      Announcement.countDocuments({ archived: true }),
      // Recent announcements (last 30 days)
      Announcement.countDocuments({
        createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);
    
    res.json({
      success: true,
      data: {
        total: stats[0],
        active: stats[1],
        expired: stats[2],
        archived: stats[3],
        recent: stats[4]
      }
    });
  } catch (error) {
    console.error('Error fetching announcement statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcement statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAnnouncements,
  getActiveAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  archiveExpiredAnnouncements,
  getAnnouncementStats
};