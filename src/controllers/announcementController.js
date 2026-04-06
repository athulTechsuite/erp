const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const mongoose = require('mongoose');

// Input sanitization middleware with enhanced validation
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // Strip HTML tags and sanitize content to prevent XSS
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

// Enhanced input validation for MongoDB queries
const validateAndSanitizeQuery = (queryParams) => {
  const sanitized = {};
  
  // Only allow safe query parameters
  const allowedParams = ['isActive', 'createdAt', 'title'];
  
  for (const [key, value] of Object.entries(queryParams)) {
    if (allowedParams.includes(key)) {
      if (typeof value === 'string') {
        // Prevent NoSQL injection by sanitizing string values
        sanitized[key] = sanitizeInput(value);
      } else if (typeof value === 'boolean') {
        sanitized[key] = Boolean(value);
      } else if (key === 'createdAt' && value instanceof Date) {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
};

// Secure ObjectId validation
const validateObjectId = (id) => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  // Additional validation to prevent injection through malformed ObjectIds
  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  return objectIdPattern.test(id) && mongoose.Types.ObjectId.isValid(id);
};

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  }
  next();
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
    // Use parameterized query with strict field selection
    const query = { isActive: true };
    const projection = { title: 1, content: 1, createdAt: 1, updatedAt: 1 };
    const options = { sort: { createdAt: -1 }, lean: true };

    const announcements = await Announcement.find(query, projection, options);

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
    // Sanitize query parameters to prevent NoSQL injection
    const sanitizedQuery = validateAndSanitizeQuery(req.query);
    const options = { sort: { createdAt: -1 }, lean: true };

    const announcements = await Announcement.find(sanitizedQuery, null, options);

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

    // Enhanced input validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title is required and must be a non-empty string'
      });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Content is required and must be a non-empty string'
      });
    }

    // Validate user ID to prevent injection
    if (!validateObjectId(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Sanitize input to prevent stored XSS
    const sanitizedTitle = sanitizeInput(title.trim());
    const sanitizedContent = sanitizeInput(content.trim());

    // Use parameterized creation with validated ObjectId
    const announcementData = {
      title: sanitizedTitle,
      content: sanitizedContent,
      isActive: Boolean(isActive),
      createdBy: new mongoose.Types.ObjectId(req.user._id)
    };

    const announcement = new Announcement(announcementData);
    await announcement.save();

    // Populate creator info for response using safe query
    await announcement.populate({
      path: 'createdBy',
      select: 'name email',
      options: { lean: true }
    });

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
    
    // Enhanced ObjectId validation to prevent injection
    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Use parameterized query with ObjectId conversion
    const announcementId = new mongoose.Types.ObjectId(id);
    const announcement = await Announcement.findById(announcementId, null, { lean: true })
      .populate({
        path: 'createdBy',
        select: 'name email',
        options: { lean: true }
      });

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

    // Enhanced ObjectId validation to prevent injection
    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Use parameterized query with ObjectId conversion
    const announcementId = new mongoose.Types.ObjectId(id);
    const announcement = await Announcement.findById(announcementId);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Build update object with validation and sanitization
    const updateData = {};
    
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Title must be a non-empty string'
        });
      }
      updateData.title = sanitizeInput(title.trim());
    }
    
    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Content must be a non-empty string'
        });
      }
      updateData.content = sanitizeInput(content.trim());
    }
    
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    updateData.updatedAt = new Date();

    // Use parameterized update
    const updatedAnnouncement = await Announcement.findByIdAndUpdate(
      announcementId,
      updateData,
      { new: true, runValidators: true, lean: true }
    ).populate({
      path: 'createdBy',
      select: 'name email',
      options: { lean: true }
    });

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: updatedAnnouncement
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

    // Enhanced ObjectId validation to prevent injection
    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Use parameterized query with ObjectId conversion
    const announcementId = new mongoose.Types.ObjectId(id);
    const announcement = await Announcement.findById(announcementId, null, { lean: true });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Use parameterized delete
    await Announcement.findByIdAndDelete(announcementId);

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

    // Enhanced ObjectId validation to prevent injection
    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Use parameterized query with ObjectId conversion
    const announcementId = new mongoose.Types.ObjectId(id);
    const announcement = await Announcement.findById(announcementId);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Use parameterized update
    const updatedAnnouncement = await Announcement.findByIdAndUpdate(
      announcementId,
      {
        isActive: !announcement.isActive,
        updatedAt: new Date()
      },
      { new: true, runValidators: true, lean: true }
    ).populate({
      path: 'createdBy',
      select: 'name email',
      options: { lean: true }
    });

    res.json({
      success: true,
      message: `Announcement ${updatedAnnouncement.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedAnnouncement
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