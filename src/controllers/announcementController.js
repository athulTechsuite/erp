const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const mongoose = require('mongoose');

// Authentication middleware - ensures user is logged in
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  }
  next();
};

// Input sanitization middleware
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // Strip HTML tags and sanitize content to prevent XSS
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

// Secure database query helper - ensures parameterized queries
const executeSecureQuery = async (model, operation, params = {}, options = {}) => {
  try {
    // All Mongoose operations use parameterized queries by default
    // This wrapper provides additional validation and logging
    switch (operation) {
      case 'find':
        return await model.find(params, null, options);
      case 'findById':
        // Validate ObjectId to prevent injection
        if (!mongoose.Types.ObjectId.isValid(params)) {
          throw new Error('Invalid ObjectId format');
        }
        return await model.findById(params, null, options);
      case 'findByIdAndDelete':
        if (!mongoose.Types.ObjectId.isValid(params)) {
          throw new Error('Invalid ObjectId format');
        }
        return await model.findByIdAndDelete(params, options);
      case 'create':
        return await model.create(params);
      default:
        throw new Error('Unsupported database operation');
    }
  } catch (error) {
    // Log potential injection attempts
    console.error('Database query error:', error.message);
    throw error;
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// Get all announcements (authenticated users only)
const getAllAnnouncements = async (req, res) => {
  try {
    // Using secure parameterized query through Mongoose ODM
    const announcements = await executeSecureQuery(
      Announcement,
      'find',
      { isActive: true },
      {
        sort: { createdAt: -1 },
        select: 'title content createdAt updatedAt'
      }
    );

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: error.message
    });
  }
};

// Get all announcements for admin management
const getAnnouncementsForAdmin = async (req, res) => {
  try {
    // Using secure parameterized query through Mongoose ODM
    const announcements = await executeSecureQuery(
      Announcement,
      'find',
      {},
      { sort: { createdAt: -1 } }
    );

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: error.message
    });
  }
};

// Create new announcement (admin only)
const createAnnouncement = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { title, content, isActive = true } = req.body;

    // Sanitize input to prevent stored XSS
    const sanitizedTitle = sanitizeInput(title);
    const sanitizedContent = sanitizeInput(content);

    // Validate user ID format to prevent injection
    if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Using secure parameterized query - Mongoose automatically parameterizes
    const announcementData = {
      title: sanitizedTitle,
      content: sanitizedContent,
      isActive,
      createdBy: new mongoose.Types.ObjectId(req.user._id)
    };

    const announcement = await executeSecureQuery(Announcement, 'create', announcementData);

    // Populate creator info for response using secure query
    await announcement.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating announcement',
      error: error.message
    });
  }
};

// Get single announcement by ID
const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Using secure query helper with built-in validation
    const announcement = await executeSecureQuery(Announcement, 'findById', id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Non-admin users can only see active announcements
    if (req.user.role !== 'admin' && !announcement.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Populate with secure query
    await announcement.populate('createdBy', 'name email');

    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement',
      error: error.message
    });
  }
};

// Update announcement (admin only)
const updateAnnouncement = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { title, content, isActive } = req.body;

    // Using secure query helper with built-in validation
    const announcement = await executeSecureQuery(Announcement, 'findById', id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Update fields with sanitization - Mongoose saves use parameterized queries
    if (title !== undefined) announcement.title = sanitizeInput(title);
    if (content !== undefined) announcement.content = sanitizeInput(content);
    if (isActive !== undefined) announcement.isActive = isActive;

    announcement.updatedAt = new Date();
    // Mongoose save() uses parameterized queries internally
    await announcement.save();

    // Populate creator info for response
    await announcement.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: error.message
    });
  }
};

// Delete announcement (admin only)
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    // Using secure query helper with built-in validation
    const announcement = await executeSecureQuery(Announcement, 'findById', id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Using secure parameterized delete operation
    await executeSecureQuery(Announcement, 'findByIdAndDelete', id);

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: error.message
    });
  }
};

// Toggle announcement active status (admin only)
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Using secure query helper with built-in validation
    const announcement = await executeSecureQuery(Announcement, 'findById', id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    announcement.isActive = !announcement.isActive;
    announcement.updatedAt = new Date();
    // Mongoose save() uses parameterized queries internally
    await announcement.save();

    await announcement.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'} successfully`,
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating announcement status',
      error: error.message
    });
  }
};

module.exports = {
  requireAuth,
  requireAdmin,
  getAllAnnouncements,
  getAnnouncementsForAdmin,
  createAnnouncement,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus
};