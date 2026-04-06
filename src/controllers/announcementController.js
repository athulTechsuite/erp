const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const mongoose = require('mongoose');

// Enhanced input validation and sanitization
const validateAndSanitizeInput = {
  // Validate string input with length and content checks
  validateString: (input, fieldName, minLength = 1, maxLength = 1000) => {
    const errors = [];
    
    if (!input || typeof input !== 'string') {
      errors.push(`${fieldName} is required and must be a string`);
      return { isValid: false, errors, sanitized: '' };
    }
    
    const trimmed = input.trim();
    if (trimmed.length < minLength) {
      errors.push(`${fieldName} must be at least ${minLength} characters long`);
    }
    if (trimmed.length > maxLength) {
      errors.push(`${fieldName} must not exceed ${maxLength} characters`);
    }
    
    // Additional security checks
    if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(trimmed)) {
      errors.push(`${fieldName} contains potentially malicious content`);
    }
    
    const sanitized = DOMPurify.sanitize(trimmed, { ALLOWED_TAGS: [] });
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  },

  // Validate ObjectId with comprehensive checks
  validateObjectId: (id, fieldName = 'ID') => {
    if (!id) {
      return { isValid: false, error: `${fieldName} is required` };
    }
    
    if (typeof id !== 'string') {
      return { isValid: false, error: `${fieldName} must be a string` };
    }
    
    // Check for potential injection patterns
    if (/[{}$]/.test(id)) {
      return { isValid: false, error: `${fieldName} contains invalid characters` };
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { isValid: false, error: `Invalid ${fieldName} format` };
    }
    
    // Additional length check for ObjectId
    if (id.length !== 24) {
      return { isValid: false, error: `${fieldName} must be exactly 24 characters` };
    }
    
    return { isValid: true, sanitizedId: new mongoose.Types.ObjectId(id) };
  },

  // Validate boolean input
  validateBoolean: (input, fieldName, defaultValue = true) => {
    if (input === undefined || input === null) {
      return { isValid: true, sanitized: defaultValue };
    }
    
    if (typeof input === 'boolean') {
      return { isValid: true, sanitized: input };
    }
    
    if (typeof input === 'string') {
      const lowerInput = input.toLowerCase().trim();
      if (lowerInput === 'true' || lowerInput === '1') {
        return { isValid: true, sanitized: true };
      }
      if (lowerInput === 'false' || lowerInput === '0') {
        return { isValid: true, sanitized: false };
      }
    }
    
    return { isValid: false, error: `${fieldName} must be a boolean value` };
  }
};

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }
  next();
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user._id || req.user.role !== 'admin') {
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
    // Use parameterized query with explicit conditions
    const query = { isActive: { $eq: true } };
    const projection = { title: 1, content: 1, createdAt: 1, updatedAt: 1, _id: 1 };
    const sortOrder = { createdAt: -1 };

    const announcements = await Announcement.find(query, projection)
      .sort(sortOrder)
      .lean(); // Use lean() for better performance on read-only operations

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements'
    });
  }
};

// Get all announcements for admin management
const getAnnouncementsForAdmin = async (req, res) => {
  try {
    // Use explicit query object for parameterized query
    const query = {};
    const sortOrder = { createdAt: -1 };

    const announcements = await Announcement.find(query)
      .sort(sortOrder)
      .populate('createdBy', 'name email')
      .lean();

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching announcements for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements'
    });
  }
};

// Create new announcement (admin only)
const createAnnouncement = async (req, res) => {
  try {
    // Check for validation errors from express-validator
    const validatorErrors = validationResult(req);
    if (!validatorErrors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validatorErrors.array()
      });
    }

    const { title, content, isActive } = req.body;

    // Comprehensive input validation and sanitization
    const titleValidation = validateAndSanitizeInput.validateString(title, 'Title', 1, 200);
    const contentValidation = validateAndSanitizeInput.validateString(content, 'Content', 1, 5000);
    const isActiveValidation = validateAndSanitizeInput.validateBoolean(isActive, 'Active Status', true);

    const validationErrors = [];
    if (!titleValidation.isValid) validationErrors.push(...titleValidation.errors);
    if (!contentValidation.isValid) validationErrors.push(...contentValidation.errors);
    if (!isActiveValidation.isValid) validationErrors.push(isActiveValidation.error);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Input validation failed',
        errors: validationErrors
      });
    }

    // Validate user authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Create announcement with sanitized and validated data
    const announcementData = {
      title: titleValidation.sanitized,
      content: contentValidation.sanitized,
      isActive: isActiveValidation.sanitized,
      createdBy: new mongoose.Types.ObjectId(req.user._id),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const announcement = new Announcement(announcementData);
    await announcement.save();

    // Populate creator info for response using parameterized query
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
};

// Get single announcement by ID
const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate and sanitize ObjectId
    const idValidation = validateAndSanitizeInput.validateObjectId(id, 'Announcement ID');
    if (!idValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: idValidation.error
      });
    }

    // Use parameterized query with explicit ObjectId
    const query = { _id: { $eq: idValidation.sanitizedId } };
    const announcement = await Announcement.findOne(query)
      .populate('createdBy', 'name email')
      .lean();

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
    console.error('Error fetching announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement'
    });
  }
};

// Update announcement (admin only)
const updateAnnouncement = async (req, res) => {
  try {
    // Check for validation errors from express-validator
    const validatorErrors = validationResult(req);
    if (!validatorErrors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validatorErrors.array()
      });
    }

    const { id } = req.params;
    const { title, content, isActive } = req.body;

    // Validate and sanitize ObjectId
    const idValidation = validateAndSanitizeInput.validateObjectId(id, 'Announcement ID');
    if (!idValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: idValidation.error
      });
    }

    // Validate and sanitize input fields
    const validationErrors = [];
    let sanitizedData = {};

    if (title !== undefined) {
      const titleValidation = validateAndSanitizeInput.validateString(title, 'Title', 1, 200);
      if (!titleValidation.isValid) {
        validationErrors.push(...titleValidation.errors);
      } else {
        sanitizedData.title = titleValidation.sanitized;
      }
    }

    if (content !== undefined) {
      const contentValidation = validateAndSanitizeInput.validateString(content, 'Content', 1, 5000);
      if (!contentValidation.isValid) {
        validationErrors.push(...contentValidation.errors);
      } else {
        sanitizedData.content = contentValidation.sanitized;
      }
    }

    if (isActive !== undefined) {
      const isActiveValidation = validateAndSanitizeInput.validateBoolean(isActive, 'Active Status');
      if (!isActiveValidation.isValid) {
        validationErrors.push(isActiveValidation.error);
      } else {
        sanitizedData.isActive = isActiveValidation.sanitized;
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Input validation failed',
        errors: validationErrors
      });
    }

    // Use parameterized query to find announcement
    const query = { _id: { $eq: idValidation.sanitizedId } };
    const announcement = await Announcement.findOne(query);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Update with sanitized data using parameterized update
    sanitizedData.updatedAt = new Date();
    const updateQuery = { _id: { $eq: idValidation.sanitizedId } };
    const updateData = { $set: sanitizedData };

    await Announcement.updateOne(updateQuery, updateData);

    // Fetch updated announcement with populated data
    const updatedAnnouncement = await Announcement.findOne(query)
      .populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: updatedAnnouncement
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating announcement'
    });
  }
};

// Delete announcement (admin only)
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate and sanitize ObjectId
    const idValidation = validateAndSanitizeInput.validateObjectId(id, 'Announcement ID');
    if (!idValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: idValidation.error
      });
    }

    // Use parameterized query to check existence
    const query = { _id: { $eq: idValidation.sanitizedId } };
    const announcement = await Announcement.findOne(query);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Use parameterized delete operation
    const deleteQuery = { _id: { $eq: idValidation.sanitizedId } };
    await Announcement.deleteOne(deleteQuery);

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
};

// Toggle announcement active status (admin only)
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate and sanitize ObjectId
    const idValidation = validateAndSanitizeInput.validateObjectId(id, 'Announcement ID');
    if (!idValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: idValidation.error
      });
    }

    // Use parameterized query to find announcement
    const query = { _id: { $eq: idValidation.sanitizedId } };
    const announcement = await Announcement.findOne(query);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Use parameterized update operation
    const newStatus = !announcement.isActive;
    const updateQuery = { _id: { $eq: idValidation.sanitizedId } };
    const updateData = { 
      $set: { 
        isActive: newStatus, 
        updatedAt: new Date() 
      } 
    };

    await Announcement.updateOne(updateQuery, updateData);

    // Fetch updated announcement with populated data
    const updatedAnnouncement = await Announcement.findOne(query)
      .populate('createdBy', 'name email');

    res.json({
      success: true,
      message: `Announcement ${newStatus ? 'activated' : 'deactivated'} successfully`,
      data: updatedAnnouncement
    });
  } catch (error) {
    console.error('Error updating announcement status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating announcement status'
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