const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');
const { body, param } = require('express-validator');
const xss = require('xss');

// Input validation and sanitization middleware
const validateAnnouncement = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
    .customSanitizer(value => xss(value)),
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Content must be between 1 and 5000 characters')
    .customSanitizer(value => xss(value))
];

const validateAnnouncementId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid announcement ID format')
];

// Get all active announcements (public access)
const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ status: 'active' })
      .populate('author', 'firstName lastName')
      .sort({ createdAt: -1 });
    
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
};

// Create new announcement (admin only)
const createAnnouncement = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { title, content } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    // Validate content length
    if (title.trim().length === 0 || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title and content cannot be empty'
      });
    }

    const announcement = new Announcement({
      title: title.trim(),
      content: content.trim(),
      author: req.user._id,
      status: 'active'
    });

    await announcement.save();
    
    // Populate author information for response
    await announcement.populate('author', 'firstName lastName');

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
};

// Update announcement (admin only)
const updateAnnouncement = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { id } = req.params;
    const { title, content } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    // Validate content length
    if (title.trim().length === 0 || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title and content cannot be empty'
      });
    }

    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    announcement.title = title.trim();
    announcement.content = content.trim();
    announcement.updatedAt = new Date();

    await announcement.save();
    
    // Populate author information for response
    await announcement.populate('author', 'firstName lastName');

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
};

// Delete announcement (admin only)
const deleteAnnouncement = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
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
      message: 'Failed to delete announcement'
    });
  }
};

// Get single announcement by ID
const getAnnouncementById = async (req, res) => {
  try {
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

    const announcement = await Announcement.findById(id)
      .populate('author', 'firstName lastName');
    
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
      message: 'Failed to fetch announcement'
    });
  }
};

// Get all announcements including inactive (admin only)
const getAllAnnouncements = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const announcements = await Announcement.find()
      .populate('author', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching all announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
};

module.exports = {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getAnnouncementById,
  getAllAnnouncements,
  validateAnnouncement,
  validateAnnouncementId
};