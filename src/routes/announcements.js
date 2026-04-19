const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Announcement = require('../models/Announcement');

// Validation rules
const announcementValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be less than 200 characters'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Content is required and must be less than 5000 characters'),
  body('expirationDate')
    .optional()
    .isISO8601()
    .withMessage('Expiration date must be a valid date')
    .custom((value) => {
      if (value && new Date(value) <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
      return true;
    })
];

// GET /api/announcements - Get all active announcements (accessible to all authenticated users)
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get active announcements (not expired and not archived)
    const announcements = await Announcement.find({
      $and: [
        { archived: false },
        {
          $or: [
            { expirationDate: null },
            { expirationDate: { $gt: new Date() } }
          ]
        }
      ]
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

    const total = await Announcement.countDocuments({
      $and: [
        { archived: false },
        {
          $or: [
            { expirationDate: null },
            { expirationDate: { $gt: new Date() } }
          ]
        }
      ]
    });

    res.json({
      success: true,
      data: {
        announcements,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements'
    });
  }
});

// GET /api/announcements/all - Get all announcements including archived (admin only)
router.get('/all', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const includeArchived = req.query.includeArchived === 'true';

    let filter = {};
    if (!includeArchived) {
      filter.archived = false;
    }

    const announcements = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    const total = await Announcement.countDocuments(filter);

    res.json({
      success: true,
      data: {
        announcements,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching all announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements'
    });
  }
});

// GET /api/announcements/recent - Get recent announcements for dashboard widget
router.get('/recent', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const announcements = await Announcement.find({
      $and: [
        { archived: false },
        {
          $or: [
            { expirationDate: null },
            { expirationDate: { $gt: new Date() } }
          ]
        }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title content createdAt expirationDate')
    .populate('createdBy', 'name');

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching recent announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent announcements'
    });
  }
});

// GET /api/announcements/:id - Get specific announcement
router.get('/:id', auth, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check if user has permission to view archived announcements
    if (announcement.archived && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
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
      message: 'Error fetching announcement'
    });
  }
});

// POST /api/announcements - Create new announcement (admin only)
router.post('/', auth, adminAuth, announcementValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, content, expirationDate, priority = 'normal' } = req.body;

    const announcement = new Announcement({
      title,
      content,
      expirationDate: expirationDate || null,
      priority,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });

    await announcement.save();
    await announcement.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating announcement'
    });
  }
});

// PUT /api/announcements/:id - Update announcement (admin only)
router.put('/:id', auth, adminAuth, announcementValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, content, expirationDate, priority } = req.body;

    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      {
        title,
        content,
        expirationDate: expirationDate || null,
        priority,
        updatedBy: req.user.id,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate('createdBy updatedBy', 'name email');

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
    console.error('Error updating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating announcement'
    });
  }
});

// DELETE /api/announcements/:id - Delete announcement (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);

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
    console.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement'
    });
  }
});

// PUT /api/announcements/:id/archive - Archive announcement (admin only)
router.put('/:id/archive', auth, adminAuth, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      {
        archived: true,
        archivedAt: new Date(),
        updatedBy: req.user.id,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    res.json({
      success: true,
      message: 'Announcement archived successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Error archiving announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Error archiving announcement'
    });
  }
});

// PUT /api/announcements/:id/unarchive - Unarchive announcement (admin only)
router.put('/:id/unarchive', auth, adminAuth, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      {
        archived: false,
        archivedAt: null,
        updatedBy: req.user.id,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    res.json({
      success: true,
      message: 'Announcement unarchived successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Error unarchiving announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Error unarchiving announcement'
    });
  }
});

// POST /api/announcements/auto-archive - Auto-archive expired announcements (system endpoint)
router.post('/auto-archive', auth, adminAuth, async (req, res) => {
  try {
    const result = await Announcement.updateMany(
      {
        archived: false,
        expirationDate: { $lte: new Date() }
      },
      {
        archived: true,
        archivedAt: new Date()
      }
    );

    res.json({
      success: true,
      message: `Auto-archived ${result.modifiedCount} expired announcements`,
      data: {
        archivedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error auto-archiving announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Error auto-archiving announcements'
    });
  }
});

module.exports = router;