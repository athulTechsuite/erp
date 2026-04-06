const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const mongoose = require('mongoose');

// Input validation and sanitization middleware for all endpoints
const validateAndSanitizeInput = (req, res, next) => {
  // Validate MongoDB ObjectId format for route parameters
  if (req.params.id && !mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // Sanitize all string inputs in request body
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = sanitizeInput(value);
      }
    }
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = sanitizeInput(value);
      }
    }
  }

  next();
};

// Authentication middleware to verify JWT token
const requireAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // Strip HTML tags and sanitize content to prevent XSS
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
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

// Get all announcements (public - for dashboard display)
const getAllAnnouncements = async (req, res) => {
  try {
    // Using Mongoose ORM with parameterized queries (secure by default)
    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select('title content createdAt updatedAt');

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
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    // Using Mongoose ORM with parameterized queries (secure by default)
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .session(session);

    await session.commitTransaction();

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Create new announcement (admin only)
const createAnnouncement = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { title, content, isActive = true } = req.body;

    // Additional validation for required fields
    if (!title || !content) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    // Using Mongoose ORM with parameterized queries (secure by default)
    const announcement = new Announcement({
      title: title,
      content: content,
      isActive: Boolean(isActive),
      createdBy: new mongoose.Types.ObjectId(req.user._id)
    });

    await announcement.save({ session });

    // Populate creator info for response
    await announcement.populate('createdBy', 'name email');

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: 'Error creating announcement',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Get single announcement by ID
const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Using Mongoose ORM with parameterized queries (secure by default)
    const announcement = await Announcement.findById(new mongoose.Types.ObjectId(id))
      .populate('createdBy', 'name email');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Non-admin users can only see active announcements
    if (req.user && req.user.role !== 'admin' && !announcement.isActive) {
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
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement',
      error: error.message
    });
  }
};

// Update announcement (admin only)
const updateAnnouncement = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { title, content, isActive } = req.body;

    // Using Mongoose ORM with parameterized queries (secure by default)
    const announcement = await Announcement.findById(new mongoose.Types.ObjectId(id)).session(session);

    if (!announcement) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Update fields with validation
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Title must be a non-empty string'
        });
      }
      announcement.title = title;
    }
    
    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim().length === 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Content must be a non-empty string'
        });
      }
      announcement.content = content;
    }
    
    if (isActive !== undefined) announcement.isActive = Boolean(isActive);

    announcement.updatedAt = new Date();
    await announcement.save({ session });

    // Populate creator info for response
    await announcement.populate('createdBy', 'name email');

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Delete announcement (admin only)
const deleteAnnouncement = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    const { id } = req.params;

    // Using Mongoose ORM with parameterized queries (secure by default)
    const announcement = await Announcement.findById(new mongoose.Types.ObjectId(id)).session(session);

    if (!announcement) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    await Announcement.findByIdAndDelete(new mongoose.Types.ObjectId(id)).session(session);

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Toggle announcement active status (admin only)
const toggleAnnouncementStatus = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    const { id } = req.params;

    // Using Mongoose ORM with parameterized queries (secure by default)
    const announcement = await Announcement.findById(new mongoose.Types.ObjectId(id)).session(session);

    if (!announcement) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    announcement.isActive = !announcement.isActive;
    announcement.updatedAt = new Date();
    await announcement.save({ session });

    await announcement.populate('createdBy', 'name email');

    await session.commitTransaction();

    res.json({
      success: true,
      message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'} successfully`,
      data: announcement
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: 'Error updating announcement status',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  validateAndSanitizeInput,
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