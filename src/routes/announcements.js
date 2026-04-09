const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Announcement = require('../models/Announcement');

// Get all active announcements (public route for all authenticated users)
router.get('/', auth, async (req, res) => {
  try {
    const announcements = await Announcement.find({ status: 'active' })
      .populate('author', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ message: 'Server error while fetching announcements' });
  }
});

// Get single announcement by ID (public route for all authenticated users)
router.get('/:id', auth, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('author', 'name email');
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    res.json(announcement);
  } catch (error) {
    console.error('Error fetching announcement:', error);
    res.status(500).json({ message: 'Server error while fetching announcement' });
  }
});

// Create new announcement (admin only)
router.post('/', [
  auth,
  adminAuth,
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 1, max: 5000 })
    .withMessage('Content must be between 1 and 5000 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, content, priority } = req.body;

    const announcement = new Announcement({
      title: title.trim(),
      content: content.trim(),
      author: req.user.id,
      priority: priority || 'normal',
      status: 'active'
    });

    await announcement.save();
    
    // Populate author information for response
    await announcement.populate('author', 'name email');
    
    res.status(201).json({
      message: 'Announcement created successfully',
      announcement
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ message: 'Server error while creating announcement' });
  }
});

// Update announcement (admin only)
router.put('/:id', [
  auth,
  adminAuth,
  body('title')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('content')
    .optional()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Content must be between 1 and 5000 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, content, priority, status } = req.body;
    
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    // Update fields if provided
    if (title !== undefined) announcement.title = title.trim();
    if (content !== undefined) announcement.content = content.trim();
    if (priority !== undefined) announcement.priority = priority;
    if (status !== undefined) announcement.status = status;
    
    announcement.updatedAt = new Date();

    await announcement.save();
    await announcement.populate('author', 'name email');
    
    res.json({
      message: 'Announcement updated successfully',
      announcement
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ message: 'Server error while updating announcement' });
  }
});

// Delete announcement (admin only)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    await Announcement.findByIdAndDelete(req.params.id);
    
    res.json({ 
      message: 'Announcement deleted successfully',
      deletedId: req.params.id
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ message: 'Server error while deleting announcement' });
  }
});

// Toggle announcement status (admin only)
router.patch('/:id/toggle-status', [auth, adminAuth], async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    announcement.status = announcement.status === 'active' ? 'inactive' : 'active';
    announcement.updatedAt = new Date();
    
    await announcement.save();
    await announcement.populate('author', 'name email');
    
    res.json({
      message: `Announcement ${announcement.status === 'active' ? 'activated' : 'deactivated'} successfully`,
      announcement
    });
  } catch (error) {
    console.error('Error toggling announcement status:', error);
    res.status(500).json({ message: 'Server error while toggling announcement status' });
  }
});

// Get announcement statistics (admin only)
router.get('/admin/stats', [auth, adminAuth], async (req, res) => {
  try {
    const totalAnnouncements = await Announcement.countDocuments();
    const activeAnnouncements = await Announcement.countDocuments({ status: 'active' });
    const inactiveAnnouncements = await Announcement.countDocuments({ status: 'inactive' });
    
    const recentAnnouncements = await Announcement.find()
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      stats: {
        total: totalAnnouncements,
        active: activeAnnouncements,
        inactive: inactiveAnnouncements
      },
      recent: recentAnnouncements
    });
  } catch (error) {
    console.error('Error fetching announcement stats:', error);
    res.status(500).json({ message: 'Server error while fetching announcement statistics' });
  }
});

// Get all announcements for admin management (admin only)
router.get('/admin/manage', [auth, adminAuth], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    
    let query = {};
    if (status && ['active', 'inactive'].includes(status)) {
      query.status = status;
    }

    const announcements = await Announcement.find(query)
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Announcement.countDocuments(query);
    
    res.json({
      announcements,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching announcements for admin:', error);
    res.status(500).json({ message: 'Server error while fetching announcements' });
  }
});

module.exports = router;