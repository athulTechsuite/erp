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

// Enhanced input validation middleware with comprehensive checks
const validateInputs = (inputs) => {
  const errors = [];
  
  for (const [key, value] of Object.entries(inputs)) {
    if (value === null || value === undefined) continue;
    
    // Validate string inputs
    if (typeof value === 'string') {
      // Length validation
      if (value.length > 10000) {
        errors.push(`${key} exceeds maximum length of 10000 characters`);
      }
      
      // Check for potential NoSQL injection patterns
      const nosqlInjectionPatterns = /(\$where|\$ne|\$gt|\$gte|\$lt|\$lte|\$in|\$nin|\$exists|\$regex|\$expr|\$jsonSchema|\$mod|\$text|\$all|\$elemMatch|\$size|\$type|javascript:|eval\(|function\(|\{\s*\$|this\.|constructor|prototype)/i;
      if (nosqlInjectionPatterns.test(value)) {
        errors.push(`${key} contains potentially dangerous content`);
      }
      
      // Validate against script injection
      const scriptPatterns = /<script|javascript:|vbscript:|onload=|onerror=|onclick=|onmouseover=/i;
      if (scriptPatterns.test(value)) {
        errors.push(`${key} contains potentially malicious script content`);
      }
      
      // Title specific validation
      if (key === 'title' && (value.length < 1 || value.length > 200)) {
        errors.push('Title must be between 1 and 200 characters');
      }
      
      // Content specific validation
      if (key === 'content' && (value.length < 1 || value.length > 5000)) {
        errors.push('Content must be between 1 and 5000 characters');
      }
    }
    
    // Validate ObjectId strings with strict format checking
    if ((key.includes('Id') || key === '_id' || key === 'id') && typeof value === 'string') {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        errors.push(`${key} must be a valid ObjectId`);
      }
      // Additional check for ObjectId format (24 hex characters)
      if (!/^[0-9a-fA-F]{24}$/.test(value)) {
        errors.push(`${key} must be a valid 24-character hex ObjectId`);
      }
    }
    
    // Validate boolean inputs
    if (key === 'isActive' && typeof value !== 'boolean') {
      errors.push(`${key} must be a boolean value`);
    }
    
    // Validate against null bytes and control characters
    if (typeof value === 'string' && /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) {
      errors.push(`${key} contains invalid control characters`);
    }
  }
  
  return errors;
};

// Enhanced parameterized query helper for MongoDB operations with strict parameter validation
const executeSecureQuery = async (model, operation, params = {}) => {
  try {
    // Validate all input parameters first
    const validationErrors = validateInputs(params);
    if (validationErrors.length > 0) {
      throw new Error(`Input validation failed: ${validationErrors.join(', ')}`);
    }
    
    // Deep clone params to avoid mutation
    const processedParams = JSON.parse(JSON.stringify(params));
    
    // Recursively process and validate all ObjectId parameters
    const processObjectIds = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (key.includes('Id') || key === '_id' || key === 'id') {
          if (typeof value === 'string') {
            if (!mongoose.Types.ObjectId.isValid(value) || !/^[0-9a-fA-F]{24}$/.test(value)) {
              throw new Error(`Invalid ObjectId format for parameter: ${key}`);
            }
            obj[key] = new mongoose.Types.ObjectId(value);
          }
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof mongoose.Types.ObjectId) && !(value instanceof Date)) {
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
    
    // Ensure queries use strict parameter binding to prevent injection
    const options = { 
      strict: true, 
      strictQuery: true,
      ...processedParams.options
    };

    // Execute operation with validated and processed parameters using parameterized queries
    switch (operation) {
      case 'find':
        return await model.find(
          processedParams.filter || {}, 
          processedParams.select || null, 
          { ...options, sort: processedParams.options?.sort || {} }
        ).lean();
        
      case 'findById':
        if (!processedParams.id) {
          throw new Error('ID parameter is required for findById operation');
        }
        return await model.findById(
          processedParams.id, 
          processedParams.select || null,
          { strict: true }
        );
        
      case 'findOne':
        return await model.findOne(
          processedParams.filter || {}, 
          processedParams.select || null,
          { strict: true }
        );
        
      case 'create':
        if (!processedParams.data) {
          throw new Error('Data parameter is required for create operation');
        }
        // Additional validation for create data
        const createValidationErrors = validateInputs(processedParams.data);
        if (createValidationErrors.length > 0) {
          throw new Error(`Create data validation failed: ${createValidationErrors.join(', ')}`);
        }
        return await model.create(processedParams.data);
        
      case 'findByIdAndUpdate':
        if (!processedParams.id || !processedParams.update) {
          throw new Error('ID and update parameters are required for findByIdAndUpdate operation');
        }
        // Validate update data
        const updateValidationErrors = validateInputs(processedParams.update);
        if (updateValidationErrors.length > 0) {
          throw new Error(`Update data validation failed: ${updateValidationErrors.join(', ')}`);
        }
        return await model.findByIdAndUpdate(
          processedParams.id, 
          { $set: processedParams.update }, // Use $set operator for safety
          { 
            new: true, 
            runValidators: true, 
            strict: true,
            ...options 
          }
        );
        
      case 'findByIdAndDelete':
        if (!processedParams.id) {
          throw new Error('ID parameter is required for findByIdAndDelete operation');
        }
        return await model.findByIdAndDelete(processedParams.id, { strict: true });
        
      case 'updateOne':
        if (!processedParams.filter || !processedParams.update) {
          throw new Error('Filter and update parameters are required for updateOne operation');
        }
        return await model.updateOne(
          processedParams.filter, 
          { $set: processedParams.update }, // Use $set operator for safety
          { runValidators: true, strict: true, ...options }
        );
        
      case 'deleteOne':
        if (!processedParams.filter) {
          throw new Error('Filter parameter is required for deleteOne operation');
        }
        return await model.deleteOne(processedParams.filter, { strict: true });
        
      default:
        throw new Error(`Unsupported database operation: ${operation}`);
    }
  } catch (error) {
    // Log security-related errors for monitoring
    if (error.message.includes('validation failed') || error.message.includes('dangerous content')) {
      console.error(`Security validation error: ${error.message}`);
    }
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
    const queryParams = req.query || {};
    const inputValidationErrors = validateInputs(queryParams);
    if (inputValidationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: inputValidationErrors
      });
    }

    const announcements = await executeSecureQuery(Announcement, 'find', {
      filter: { isActive: true },
      select: 'title content createdAt updatedAt',
      options: { sort: { createdAt: -1 }, limit: 100 } // Add reasonable limit
    });

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error in getAllAnnouncements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get all announcements for admin management
const getAnnouncementsForAdmin = async (req, res) => {
  try {
    // Validate query parameters
    const queryParams = req.query || {};
    const inputValidationErrors = validateInputs(queryParams);
    if (inputValidationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: inputValidationErrors
      });
    }

    const announcements = await executeSecureQuery(Announcement, 'find', {
      filter: {},
      options: { sort: { createdAt: -1 }, limit: 1000 } // Add reasonable limit
    });

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error in getAnnouncementsForAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
      createdBy: req.user._id.toString() 
    });
    if (inputValidationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Input validation failed',
        errors: inputValidationErrors
      });
    }

    // Additional business logic validation
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    // Sanitize input to prevent stored XSS
    const sanitizedTitle = sanitizeInput(title.trim());
    const sanitizedContent = sanitizeInput(content.trim());

    // Validate that sanitization didn't remove all content
    if (!sanitizedTitle || !sanitizedContent) {
      return res.status(400).json({
        success: false,
        message: 'Title and content cannot be empty after sanitization'
      });
    }

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
      createdBy: new mongoose.Types.ObjectId(req.user._id)
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
    console.error('Error in createAnnouncement:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating announcement',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
    if (req.user.role !== 'admin' && !announcement.isActive) {
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
    console.error('Error in getAnnouncementById:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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

    // Check if announcement exists first
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
      const sanitizedTitle = sanitizeInput(title.trim());
      if (!sanitizedTitle) {
        return res.status(400).json({
          success: false,
          message: 'Title cannot be empty after sanitization'
        });
      }
      updateData.title = sanitizedTitle;
    }
    
    if (content !== undefined) {
      const sanitizedContent = sanitizeInput(content.trim());
      if (!sanitizedContent) {
        return res.status(400).json({
          success: false,
          message: 'Content cannot be empty after sanitization'
        });
      }
      updateData.content = sanitizedContent;
    }
    
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }
    
    updateData.updatedAt = new Date();

    const updatedAnnouncement = await executeSecureQuery(Announcement, 'findByIdAndUpdate', {
      id: id,
      update: updateData,
      options: { new: true }
    });

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
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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

    // Check if announcement exists first
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
    console.error('Error in deleteAnnouncement:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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

    // Check if announcement exists first
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
      options: { new: true }
    });

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
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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