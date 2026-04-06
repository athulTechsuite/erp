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

// Enhanced input sanitization and validation middleware
const sanitizeAndValidateInput = (input, maxLength = 1000) => {
  if (typeof input !== 'string') return input;
  
  // Trim whitespace and limit length to prevent DoS attacks
  let sanitized = input.trim().substring(0, maxLength);
  
  // Strip HTML tags and sanitize content to prevent XSS
  sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] });
  
  // Additional SQL injection prevention - escape potential SQL metacharacters
  sanitized = sanitized.replace(/['";\\]/g, '');
  
  return sanitized;
};

// Legacy function for backward compatibility
const sanitizeInput = (input) => sanitizeAndValidateInput(input);

// Enhanced secure database query helper with comprehensive SQL injection protection
const executeSecureQuery = async (model, operation, params = {}, options = {}) => {
  try {
    // Validate all ObjectId parameters to prevent injection attacks
    const validateObjectId = (id) => {
      if (typeof id === 'string' && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)) {
        return mongoose.Types.ObjectId.isValid(id);
      }
      return false;
    };

    // Sanitize query parameters to prevent NoSQL injection
    const sanitizeQueryParams = (queryParams) => {
      if (typeof queryParams !== 'object' || queryParams === null) {
        return {};
      }
      
      const sanitized = {};
      Object.keys(queryParams).forEach(key => {
        const value = queryParams[key];
        
        // Prevent operator injection ($ne, $gt, etc.)
        if (key.startsWith('$')) {
          throw new Error('Query operators are not allowed in user input');
        }
        
        // Sanitize string values
        if (typeof value === 'string') {
          sanitized[key] = sanitizeAndValidateInput(value);
        } else if (typeof value === 'boolean' || typeof value === 'number') {
          sanitized[key] = value;
        } else if (value instanceof Date) {
          sanitized[key] = value;
        } else if (mongoose.Types.ObjectId.isValid(value)) {
          sanitized[key] = value;
        }
      });
      
      return sanitized;
    };

    // All Mongoose operations use parameterized queries by default
    // This wrapper provides additional validation and injection prevention
    switch (operation) {
      case 'find':
        const sanitizedParams = sanitizeQueryParams(params);
        return await model.find(sanitizedParams, null, options).lean();
      
      case 'findById':
        // Strict ObjectId validation to prevent injection
        if (!validateObjectId(params)) {
          throw new Error('Invalid ObjectId format - potential injection attempt detected');
        }
        return await model.findById(new mongoose.Types.ObjectId(params), null, options);
      
      case 'findByIdAndUpdate':
        if (!validateObjectId(params.id)) {
          throw new Error('Invalid ObjectId format - potential injection attempt detected');
        }
        const sanitizedUpdateData = sanitizeQueryParams(params.updateData);
        return await model.findByIdAndUpdate(
          new mongoose.Types.ObjectId(params.id),
          { $set: sanitizedUpdateData },
          { ...options, new: true, runValidators: true }
        );
      
      case 'findByIdAndDelete':
        if (!validateObjectId(params)) {
          throw new Error('Invalid ObjectId format - potential injection attempt detected');
        }
        return await model.findByIdAndDelete(new mongoose.Types.ObjectId(params), options);
      
      case 'create':
        // Sanitize all input data before creation
        const sanitizedCreateData = {};
        Object.keys(params).forEach(key => {
          const value = params[key];
          if (typeof value === 'string') {
            sanitizedCreateData[key] = sanitizeAndValidateInput(value, key === 'content' ? 5000 : 200);
          } else {
            sanitizedCreateData[key] = value;
          }
        });
        return await model.create(sanitizedCreateData);
      
      case 'updateOne':
        const sanitizedFilter = sanitizeQueryParams(params.filter);
        const sanitizedUpdate = sanitizeQueryParams(params.update);
        return await model.updateOne(sanitizedFilter, { $set: sanitizedUpdate }, options);
      
      default:
        throw new Error('Unsupported database operation - security violation');
    }
  } catch (error) {
    // Log potential injection attempts with details
    console.error('Secure query execution failed:', {
      operation,
      error: error.message,
      timestamp: new Date().toISOString(),
      params: JSON.stringify(params, null, 2)
    });
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

// Enhanced input validation middleware
const validateAnnouncementInput = (req, res, next) => {
  const { title, content } = req.body;
  
  // Validate title
  if (title && (typeof title !== 'string' || title.trim().length === 0 || title.length > 200)) {
    return res.status(400).json({
      success: false,
      message: 'Title must be a non-empty string with maximum 200 characters'
    });
  }
  
  // Validate content
  if (content && (typeof content !== 'string' || content.trim().length === 0 || content.length > 5000)) {
    return res.status(400).json({
      success: false,
      message: 'Content must be a non-empty string with maximum 5000 characters'
    });
  }
  
  next();
};

// Get all announcements (authenticated users only) - SQL injection safe
const getAllAnnouncements = async (req, res) => {
  try {
    // Using secure parameterized query with comprehensive protection
    const announcements = await executeSecureQuery(
      Announcement,
      'find',
      { isActive: true },
      {
        sort: { createdAt: -1 },
        select: 'title content createdAt updatedAt',
        limit: 100 // Prevent potential DoS from large result sets
      }
    );

    res.json({
      success: true,
      data: announcements,
      count: announcements.length
    });
  } catch (error) {
    console.error('Error in getAllAnnouncements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Get all announcements for admin management - SQL injection safe
const getAnnouncementsForAdmin = async (req, res) => {
  try {
    // Using secure parameterized query with comprehensive protection
    const announcements = await executeSecureQuery(
      Announcement,
      'find',
      {},
      { 
        sort: { createdAt: -1 },
        limit: 200 // Admin pagination limit
      }
    );

    res.json({
      success: true,
      data: announcements,
      count: announcements.length
    });
  } catch (error) {
    console.error('Error in getAnnouncementsForAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Create new announcement (admin only) - SQL injection safe
const createAnnouncement = [
  validateAnnouncementInput,
  async (req, res) => {
    try {
      // Check for validation errors from express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { title, content, isActive = true } = req.body;

      // Validate user ID format to prevent injection
      if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format - authentication error'
        });
      }

      // Data is sanitized within executeSecureQuery for 'create' operation
      const announcementData = {
        title,
        content,
        isActive: Boolean(isActive),
        createdBy: new mongoose.Types.ObjectId(req.user._id),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const announcement = await executeSecureQuery(Announcement, 'create', announcementData);

      // Populate creator info using secure query
      const populatedAnnouncement = await executeSecureQuery(
        Announcement,
        'findById',
        announcement._id
      );
      await populatedAnnouncement.populate('createdBy', 'name email');

      res.status(201).json({
        success: true,
        message: 'Announcement created successfully',
        data: populatedAnnouncement
      });
    } catch (error) {
      console.error('Error in createAnnouncement:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating announcement',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
];

// Get single announcement by ID - SQL injection safe
const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Input validation and sanitization handled in executeSecureQuery
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
    console.error('Error in getAnnouncementById:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Update announcement (admin only) - SQL injection safe
const updateAnnouncement = [
  validateAnnouncementInput,
  async (req, res) => {
    try {
      // Check for validation errors from express-validator
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

      // Build update data object with only provided fields
      const updateData = { updatedAt: new Date() };
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);

      // Using secure parameterized update with comprehensive protection
      const updatedAnnouncement = await executeSecureQuery(
        Announcement,
        'findByIdAndUpdate',
        { id, updateData },
        { new: true, runValidators: true }
      );

      if (!updatedAnnouncement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      // Populate creator info for response
      await updatedAnnouncement.populate('createdBy', 'name email');

      res.json({
        success: true,
        message: 'Announcement updated successfully',
        data: updatedAnnouncement
      });
    } catch (error) {
      console.error('Error in updateAnnouncement:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating announcement',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
      });
    }
  }
];

// Delete announcement (admin only) - SQL injection safe
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    // Using secure query with comprehensive ObjectId validation
    const deletedAnnouncement = await executeSecureQuery(Announcement, 'findByIdAndDelete', id);

    if (!deletedAnnouncement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    res.json({
      success: true,
      message: 'Announcement deleted successfully',
      deletedId: deletedAnnouncement._id
    });
  } catch (error) {
    console.error('Error in deleteAnnouncement:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Toggle announcement active status (admin only) - SQL injection safe
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // First, get current announcement using secure query
    const announcement = await executeSecureQuery(Announcement, 'findById', id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Toggle status using secure update
    const updatedAnnouncement = await executeSecureQuery(
      Announcement,
      'findByIdAndUpdate',
      {
        id,
        updateData: {
          isActive: !announcement.isActive,
          updatedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    );

    await updatedAnnouncement.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: `Announcement ${updatedAnnouncement.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedAnnouncement
    });
  } catch (error) {
    console.error('Error in toggleAnnouncementStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating announcement status',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

module.exports = {
  requireAuth,
  requireAdmin,
  validateAnnouncementInput,
  getAllAnnouncements,
  getAnnouncementsForAdmin,
  createAnnouncement,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus
};