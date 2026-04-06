const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const mongoose = require('mongoose');

// Input sanitization middleware
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // Strip HTML tags and sanitize content to prevent XSS
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

// Enhanced input validation middleware
const validateInputs = (inputs) => {
  const errors = [];
  
  for (const [key, value] of Object.entries(inputs)) {
    if (value === null || value === undefined) continue;
    
    // Validate string inputs
    if (typeof value === 'string') {
      // Check for empty strings where not allowed
      if (key === 'title' || key === 'content') {
        if (value.trim().length === 0) {
          errors.push(`${key} cannot be empty`);
        }
      }
      
      // Check maximum length
      if (value.length > 10000) {
        errors.push(`${key} exceeds maximum length of 10000 characters`);
      }
      
      // Enhanced SQL/NoSQL injection pattern detection
      const injectionPatterns = [
        /(\$where|\$ne|\$gt|\$lt|\$in|\$nin|\$exists|\$regex|\$expr|\$jsonSchema)/i,
        /(javascript:|eval\(|function\(|setTimeout|setInterval)/i,
        /(<script|<iframe|<object|<embed)/i,
        /(union\s+select|drop\s+table|insert\s+into|delete\s+from)/i,
        /(\'\s*or\s*\'|\'\s*and\s*\'|;\s*--)/i
      ];
      
      for (const pattern of injectionPatterns) {
        if (pattern.test(value)) {
          errors.push(`${key} contains potentially dangerous content`);
          break;
        }
      }
    }
    
    // Validate ObjectId strings
    if ((key.includes('Id') || key === '_id' || key === 'id') && typeof value === 'string') {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        errors.push(`${key} must be a valid ObjectId`);
      }
    }
    
    // Validate boolean inputs
    if (key === 'isActive' && value !== undefined && typeof value !== 'boolean') {
      errors.push(`${key} must be a boolean value`);
    }
    
    // Validate required fields
    if (key === 'title' && (!value || value.trim().length < 1)) {
      errors.push('Title is required and cannot be empty');
    }
    if (key === 'content' && (!value || value.trim().length < 1)) {
      errors.push('Content is required and cannot be empty');
    }
  }
  
  return errors;
};

// Enhanced parameterized query helper for MongoDB operations with strict validation
const executeSecureQuery = async (model, operation, params = {}) => {
  try {
    // Validate all input parameters first
    const validationErrors = validateInputs(params);
    if (validationErrors.length > 0) {
      throw new Error(`Input validation failed: ${validationErrors.join(', ')}`);
    }
    
    // Deep clone params to avoid mutation
    const processedParams = JSON.parse(JSON.stringify(params));
    
    // Recursively validate and convert ObjectId parameters
    const processObjectIds = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (key.includes('Id') || key === '_id' || key === 'id') {
          if (typeof value === 'string') {
            if (!mongoose.Types.ObjectId.isValid(value)) {
              throw new Error(`Invalid ObjectId format for parameter: ${key}`);
            }
            obj[key] = new mongoose.Types.ObjectId(value);
          }
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          processObjectIds(value);
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              processObjectIds(item);
            }
          });
        }
      }
    };
    
    processObjectIds(processedParams);

    // Whitelist allowed operations to prevent injection
    const allowedOperations = [
      'find', 'findById', 'findOne', 'create', 
      'findByIdAndUpdate', 'findByIdAndDelete', 
      'updateOne', 'deleteOne', 'countDocuments'
    ];
    
    if (!allowedOperations.includes(operation)) {
      throw new Error(`Unsupported database operation: ${operation}`);
    }

    // Execute operation with validated and processed parameters
    switch (operation) {
      case 'find':
        return await model.find(
          processedParams.filter || {}, 
          processedParams.select || null, 
          { ...processedParams.options, maxTimeMS: 30000 }
        );
      case 'findById':
        return await model.findById(
          processedParams.id, 
          processedParams.select || null,
          { maxTimeMS: 30000 }
        );
      case 'findOne':
        return await model.findOne(
          processedParams.filter || {}, 
          processedParams.select || null,
          { maxTimeMS: 30000 }
        );
      case 'create':
        // Additional validation for create operations
        if (!processedParams.data || typeof processedParams.data !== 'object') {
          throw new Error('Invalid data object for create operation');
        }
        return await model.create(processedParams.data);
      case 'findByIdAndUpdate':
        if (!processedParams.update || typeof processedParams.update !== 'object') {
          throw new Error('Invalid update object');
        }
        return await model.findByIdAndUpdate(
          processedParams.id, 
          processedParams.update, 
          { ...processedParams.options, maxTimeMS: 30000, runValidators: true }
        );
      case 'findByIdAndDelete':
        return await model.findByIdAndDelete(
          processedParams.id,
          { maxTimeMS: 30000 }
        );
      case 'updateOne':
        if (!processedParams.filter || !processedParams.update) {
          throw new Error('Filter and update objects are required');
        }
        return await model.updateOne(
          processedParams.filter, 
          processedParams.update, 
          { ...processedParams.options, maxTimeMS: 30000, runValidators: true }
        );
      case 'deleteOne':
        if (!processedParams.filter) {
          throw new Error('Filter object is required for deleteOne');
        }
        return await model.deleteOne(
          processedParams.filter,
          { maxTimeMS: 30000 }
        );
      case 'countDocuments':
        return await model.countDocuments(
          processedParams.filter || {},
          { maxTimeMS: 30000 }
        );
      default:
        throw new Error(`Unsupported database operation: ${operation}`);
    }
  } catch (error) {
    // Log error for monitoring (don't expose internal details)
    console.error('Database operation error:', {
      operation,
      error: error.message,
      timestamp: new Date().toISOString()
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

// Get all announcements (public - for dashboard display)
const getAllAnnouncements = async (req, res) => {
  try {
    // Validate query parameters if any
    const { limit, skip } = req.query;
    const queryParams = {};
    
    if (limit !== undefined) {
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 0 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid limit parameter. Must be between 0 and 100.'
        });
      }
      queryParams.limit = limitNum;
    }
    
    if (skip !== undefined) {
      const skipNum = parseInt(skip, 10);
      if (isNaN(skipNum) || skipNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid skip parameter. Must be non-negative.'
        });
      }
      queryParams.skip = skipNum;
    }

    const announcements = await executeSecureQuery(Announcement, 'find', {
      filter: { isActive: true },
      select: 'title content createdAt updatedAt',
      options: { 
        sort: { createdAt: -1 },
        ...queryParams
      }
    });

    res.json({
      success: true,
      data: announcements,
      count: announcements.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Get all announcements for admin management
const getAnnouncementsForAdmin = async (req, res) => {
  try {
    // Validate query parameters
    const { limit, skip } = req.query;
    const queryParams = {};
    
    if (limit !== undefined) {
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 0 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid limit parameter. Must be between 0 and 100.'
        });
      }
      queryParams.limit = limitNum;
    }
    
    if (skip !== undefined) {
      const skipNum = parseInt(skip, 10);
      if (isNaN(skipNum) || skipNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid skip parameter. Must be non-negative.'
        });
      }
      queryParams.skip = skipNum;
    }

    const announcements = await executeSecureQuery(Announcement, 'find', {
      filter: {},
      options: { 
        sort: { createdAt: -1 },
        ...queryParams
      }
    });

    res.json({
      success: true,
      data: announcements,
      count: announcements.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Create new announcement (admin only)
const createAnnouncement = async (req, res) => {
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

    // Comprehensive input validation
    const inputValidationErrors = validateInputs({ 
      title, 
      content, 
      isActive, 
      createdBy: req.user?._id 
    });
    
    if (inputValidationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Input validation failed',
        errors: inputValidationErrors
      });
    }

    // Validate user authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Sanitize input to prevent stored XSS
    const sanitizedTitle = sanitizeInput(title?.toString().trim());
    const sanitizedContent = sanitizeInput(content?.toString().trim());

    // Validate createdBy user ID
    if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const announcementData = {
      title: sanitizedTitle,
      content: sanitizedContent,
      isActive: Boolean(isActive),
      createdBy: new mongoose.Types.ObjectId(req.user._id),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const announcement = await executeSecureQuery(Announcement, 'create', {
      data: announcementData
    });

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
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Get single announcement by ID
const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate input parameters
    const inputValidationErrors = validateInputs({ id });
    if (inputValidationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID',
        errors: inputValidationErrors
      });
    }
    
    // Use secure query which validates ObjectId
    const announcement = await executeSecureQuery(Announcement, 'findById', {
      id: id
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Non-admin users can only see active announcements
    if (req.user?.role !== 'admin' && !announcement.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    await announcement.populate('createdBy', 'name email');

    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Update announcement (admin only)
const updateAnnouncement = async (req, res) => {
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

    // Validate all input parameters
    const inputValidationErrors = validateInputs({ id, title, content, isActive });
    if (inputValidationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Input validation failed',
        errors: inputValidationErrors
      });
    }

    const announcement = await executeSecureQuery(Announcement, 'findById', {
      id: id
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Prepare update data with sanitization
    const updateData = {};
    if (title !== undefined) {
      const sanitizedTitle = sanitizeInput(title.toString().trim());
      if (sanitizedTitle.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Title cannot be empty after sanitization'
        });
      }
      updateData.title = sanitizedTitle;
    }
    
    if (content !== undefined) {
      const sanitizedContent = sanitizeInput(content.toString().trim());
      if (sanitizedContent.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Content cannot be empty after sanitization'
        });
      }
      updateData.content = sanitizedContent;
    }
    
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    updateData.updatedAt = new Date();

    const updatedAnnouncement = await executeSecureQuery(Announcement, 'findByIdAndUpdate', {
      id: id,
      update: updateData,
      options: { new: true, runValidators: true }
    });

    // Populate creator info for response
    await updatedAnnouncement.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: updatedAnnouncement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Delete announcement (admin only)
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate input parameters
    const inputValidationErrors = validateInputs({ id });
    if (inputValidationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID',
        errors: inputValidationErrors
      });
    }

    const announcement = await executeSecureQuery(Announcement, 'findById', {
      id: id
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    await executeSecureQuery(Announcement, 'findByIdAndDelete', {
      id: id
    });

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Toggle announcement active status (admin only)
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate input parameters
    const inputValidationErrors = validateInputs({ id });
    if (inputValidationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID',
        errors: inputValidationErrors
      });
    }

    const announcement = await executeSecureQuery(Announcement, 'findById', {
      id: id
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    const updateData = {
      isActive: !announcement.isActive,
      updatedAt: new Date()
    };

    const updatedAnnouncement = await executeSecureQuery(Announcement, 'findByIdAndUpdate', {
      id: id,
      update: updateData,
      options: { new: true, runValidators: true }
    });

    await updatedAnnouncement.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: `Announcement ${updatedAnnouncement.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedAnnouncement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating announcement status',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

module.exports = {
  requireAdmin,
  getAllAnnouncements,
  getAnnouncementsForAdmin,
  createAnnouncement,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus
};