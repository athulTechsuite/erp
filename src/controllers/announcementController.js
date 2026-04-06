const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const mongoose = require('mongoose');

// Authentication middleware to protect announcement endpoints
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in to access this resource.'
    });
  }
  next();
};

// Input sanitization middleware with enhanced XSS protection
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // Strip HTML tags and sanitize content to prevent XSS attacks
  // Use strict sanitization with no allowed tags for security
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  });
};

// Input validation middleware
const validateInputs = (inputs) => {
  const errors = [];
  
  for (const [key, value] of Object.entries(inputs)) {
    if (value === null || value === undefined) continue;
    
    // Validate string inputs
    if (typeof value === 'string') {
      if (value.length > 10000) {
        errors.push(`${key} exceeds maximum length`);
      }
      // Check for potential SQL injection patterns (even though we use MongoDB)
      const sqlInjectionPatterns = /(\$where|\$ne|\$gt|\$lt|\$in|\$nin|\$exists|\$regex|javascript:|eval\(|function\()/i;
      if (sqlInjectionPatterns.test(value)) {
        errors.push(`${key} contains potentially dangerous content`);
      }
    }
    
    // Validate ObjectId strings
    if ((key.includes('Id') || key === '_id' || key === 'id') && typeof value === 'string') {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        errors.push(`${key} must be a valid ObjectId`);
      }
    }
    
    // Validate boolean inputs
    if (key === 'isActive' && typeof value !== 'boolean') {
      errors.push(`${key} must be a boolean value`);
    }
  }
  
  return errors;
};

// Enhanced parameterized query helper for MongoDB operations
const executeSecureQuery = async (model, operation, params = {}) => {
  try {
    // Validate all input parameters first
    const validationErrors = validateInputs(params);
    if (validationErrors.length > 0) {
      throw new Error(`Input validation failed: ${validationErrors.join(', ')}`);
    }
    
    // Validate and convert ObjectId parameters to prevent injection
    const processedParams = { ...params };
    for (const [key, value] of Object.entries(processedParams)) {
      if (key.includes('Id') || key === '_id' || key === 'id') {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new Error(`Invalid ObjectId format for parameter: ${key}`);
        }
        // Convert to proper ObjectId to ensure parameterized query
        processedParams[key] = new mongoose.Types.ObjectId(value);
      }
      
      // Recursively process nested objects (like filter, update objects)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if ((nestedKey.includes('Id') || nestedKey === '_id' || nestedKey === 'id') && 
              typeof nestedValue === 'string') {
            if (!mongoose.Types.ObjectId.isValid(nestedValue)) {
              throw new Error(`Invalid ObjectId format for nested parameter: ${nestedKey}`);
            }
            value[nestedKey] = new mongoose.Types.ObjectId(nestedValue);
          }
        }
      }
    }

    // Execute operation with validated and processed parameters
    switch (operation) {
      case 'find':
        return await model.find(
          processedParams.filter || {}, 
          processedParams.select || null, 
          processedParams.options || {}
        );
      case 'findById':
        return await model.findById(processedParams.id, processedParams.select || null);
      case 'findOne':
        return await model.findOne(
          processedParams.filter || {}, 
          processedParams.select || null
        );
      case 'create':
        return await model.create(processedParams.data);
      case 'findByIdAndUpdate':
        return await model.findByIdAndUpdate(
          processedParams.id, 
          processedParams.update, 
          processedParams.options || {}
        );
      case 'findByIdAndDelete':
        return await model.findByIdAndDelete(processedParams.id);
      case 'updateOne':
        return await model.updateOne(
          processedParams.filter, 
          processedParams.update, 
          processedParams.options || {}
        );
      case 'deleteOne':
        return await model.deleteOne(processedParams.filter);
      default:
        throw new Error(`Unsupported database operation: ${operation}`);
    }
  } catch (error) {
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
    const announcements = await executeSecureQuery(Announcement, 'find', {
      filter: { isActive: true },
      select: 'title content createdAt updatedAt',
      options: { sort: { createdAt: -1 } }
    });

    // Sanitize content before sending to client for additional XSS protection
    const sanitizedAnnouncements = announcements.map(announcement => ({
      ...announcement.toObject(),
      title: sanitizeInput(announcement.title),
      content: sanitizeInput(announcement.content)
    }));

    res.json({
      success: true,
      data: sanitizedAnnouncements
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
    const announcements = await executeSecureQuery(Announcement, 'find', {
      filter: {},
      options: { sort: { createdAt: -1 } }
    });

    // Sanitize content before sending to client for additional XSS protection
    const sanitizedAnnouncements = announcements.map(announcement => ({
      ...announcement.toObject(),
      title: sanitizeInput(announcement.title),
      content: sanitizeInput(announcement.content)
    }));

    res.json({
      success: true,
      data: sanitizedAnnouncements
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

    // Validate input data
    const inputValidationErrors = validateInputs({ title, content, isActive, createdBy: req.user._id });
    if (inputValidationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Input validation failed',
        errors: inputValidationErrors
      });
    }

    // Sanitize input to prevent stored XSS attacks
    const sanitizedTitle = sanitizeInput(title);
    const sanitizedContent = sanitizeInput(content);

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
      isActive,
      createdBy: new mongoose.Types.ObjectId(req.user._id)
    };

    const announcement = await executeSecureQuery(Announcement, 'create', {
      data: announcementData
    });

    // Populate creator info for response using secure query
    await announcement.populate('createdBy', 'name email');

    // Sanitize response data before sending
    const responseData = {
      ...announcement.toObject(),
      title: sanitizeInput(announcement.title),
      content: sanitizeInput(announcement.content)
    };

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: responseData
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

    // Sanitize content before sending to client
    const responseData = {
      ...announcement.toObject(),
      title: sanitizeInput(announcement.title),
      content: sanitizeInput(announcement.content)
    };

    res.json({
      success: true,
      data: responseData
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

    // Prepare update data with sanitization to prevent XSS
    const updateData = {};
    if (title !== undefined) updateData.title = sanitizeInput(title);
    if (content !== undefined) updateData.content = sanitizeInput(content);
    if (isActive !== undefined) updateData.isActive = isActive;
    updateData.updatedAt = new Date();

    const updatedAnnouncement = await executeSecureQuery(Announcement, 'findByIdAndUpdate', {
      id: id,
      update: updateData,
      options: { new: true }
    });

    // Populate creator info for response
    await updatedAnnouncement.populate('createdBy', 'name email');

    // Sanitize response data before sending
    const responseData = {
      ...updatedAnnouncement.toObject(),
      title: sanitizeInput(updatedAnnouncement.title),
      content: sanitizeInput(updatedAnnouncement.content)
    };

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: responseData
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
      error: error.message
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
      options: { new: true }
    });

    await updatedAnnouncement.populate('createdBy', 'name email');

    // Sanitize response data before sending
    const responseData = {
      ...updatedAnnouncement.toObject(),
      title: sanitizeInput(updatedAnnouncement.title),
      content: sanitizeInput(updatedAnnouncement.content)
    };

    res.json({
      success: true,
      message: `Announcement ${updatedAnnouncement.isActive ? 'activated' : 'deactivated'} successfully`,
      data: responseData
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