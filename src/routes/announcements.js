const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get all announcements (accessible to all authenticated users)
router.get('/', requireAuth, async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .limit(50);
    
    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
});

// Get recent announcements for dashboard widget
router.get('/recent', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('createdBy', 'name')
      .select('title content createdAt createdBy priority');
    
    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching recent announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent announcements'
    });
  }
});

// Create new announcement (admin only)
router.post('/', 
  requireAuth,
  requireAdmin,
  [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('content')
      .trim()
      .notEmpty()
      .withMessage('Content is required')
      .isLength({ min: 10, max: 5000 })
      .withMessage('Content must be between 10 and 5000 characters'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priority must be one of: low, medium, high, urgent'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Expiration date must be a valid date')
      .custom((value) => {
        if (value && new Date(value) <= new Date()) {
          throw new Error('Expiration date must be in the future');
        }
        return true;
      })
  ],
  async (req, res) => {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { title, content, priority = 'medium', expiresAt } = req.body;

      const announcement = new Announcement({
        title,
        content,
        priority,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: req.user._id,
        isActive: true
      });

      await announcement.save();
      await announcement.populate('createdBy', 'name email');

      // Emit notification for new announcement
      if (req.io) {
        req.io.emit('newAnnouncement', {
          id: announcement._id,
          title: announcement.title,
          priority: announcement.priority,
          createdBy: announcement.createdBy.name,
          createdAt: announcement.createdAt
        });
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
        message: 'Failed to create announcement'
      });
    }
  }
);

// Get single announcement by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check if announcement is active or if user is admin
    if (!announcement.isActive && req.user.role !== 'admin') {
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
      message: 'Failed to fetch announcement'
    });
  }
});

// Update announcement (admin only)
router.put('/:id',
  requireAuth,
  requireAdmin,
  [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('content')
      .optional()
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Content must be between 10 and 5000 characters'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priority must be one of: low, medium, high, urgent'),
    body('expiresAt')
      .optional()
      .custom((value) => {
        if (value && value !== null && new Date(value) <= new Date()) {
          throw new Error('Expiration date must be in the future');
        }
        return true;
      })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const announcement = await Announcement.findById(req.params.id);
      
      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      // Update fields if provided
      const allowedUpdates = ['title', 'content', 'priority', 'expiresAt'];
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          announcement[field] = req.body[field];
        }
      });

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
        message: 'Failed to update announcement'
      });
    }
  }
);

// Delete announcement (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Soft delete by setting isActive to false
    announcement.isActive = false;
    announcement.deletedAt = new Date();
    announcement.deletedBy = req.user._id;
    await announcement.save();

    // Emit notification for deleted announcement
    if (req.io) {
      req.io.emit('announcementDeleted', {
        id: announcement._id
      });
    }

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement'
    });
  }
});

// Permanently delete announcement (admin only)
router.delete('/:id/permanent', requireAuth, requireAdmin, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    await Announcement.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Announcement permanently deleted'
    });
  } catch (error) {
    console.error('Error permanently deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to permanently delete announcement'
    });
  }
});

// Get announcement statistics (admin only)
router.get('/stats/overview', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [totalActive, totalDeleted, recentCount, urgentCount] = await Promise.all([
      Announcement.countDocuments({ isActive: true }),
      Announcement.countDocuments({ isActive: false }),
      Announcement.countDocuments({ 
        isActive: true, 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      }),
      Announcement.countDocuments({ isActive: true, priority: 'urgent' })
    ]);

    res.json({
      success: true,
      data: {
        totalActive,
        totalDeleted,
        recentCount,
        urgentCount
      }
    });
  } catch (error) {
    console.error('Error fetching announcement stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcement statistics'
    });
  }
});

module.exports = router;