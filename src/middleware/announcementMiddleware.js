const { body, param, query, validationResult } = require('express-validator');
const Announcement = require('../models/Announcement');
const User = require('../models/User');

// Validation middleware for creating announcements
const validateCreateAnnouncement = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 10, max: 10000 })
    .withMessage('Content must be between 10 and 10000 characters'),
  
  body('priority')
    .optional()
    .isIn(['normal', 'important', 'urgent'])
    .withMessage('Priority must be normal, important, or urgent'),
  
  body('publishDate')
    .optional()
    .isISO8601()
    .withMessage('Publish date must be a valid ISO 8601 date')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Publish date cannot be in the past');
      }
      return true;
    }),
  
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  
  body('attachments.*.filename')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Attachment filename is required'),
  
  body('attachments.*.url')
    .optional()
    .isURL()
    .withMessage('Attachment URL must be valid'),
  
  body('attachments.*.size')
    .optional()
    .isInt({ min: 1, max: 50 * 1024 * 1024 }) // Max 50MB
    .withMessage('Attachment size must be between 1 byte and 50MB')
];

// Validation middleware for updating announcements
const validateUpdateAnnouncement = [
  param('id')
    .isMongoId()
    .withMessage('Invalid announcement ID'),
  
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('content')
    .optional()
    .trim()
    .isLength({ min: 10, max: 10000 })
    .withMessage('Content must be between 10 and 10000 characters'),
  
  body('priority')
    .optional()
    .isIn(['normal', 'important', 'urgent'])
    .withMessage('Priority must be normal, important, or urgent'),
  
  body('publishDate')
    .optional()
    .isISO8601()
    .withMessage('Publish date must be a valid ISO 8601 date'),
  
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  
  body('attachments.*.filename')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Attachment filename is required'),
  
  body('attachments.*.url')
    .optional()
    .isURL()
    .withMessage('Attachment URL must be valid'),
  
  body('attachments.*.size')
    .optional()
    .isInt({ min: 1, max: 50 * 1024 * 1024 })
    .withMessage('Attachment size must be between 1 byte and 50MB')
];

// Validation middleware for announcement ID parameter
const validateAnnouncementId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid announcement ID')
];

// Validation middleware for query parameters
const validateAnnouncementQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('priority')
    .optional()
    .isIn(['normal', 'important', 'urgent'])
    .withMessage('Priority must be normal, important, or urgent'),
  
  query('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

// Check if user has admin privileges
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking admin privileges',
      error: error.message
    });
  }
};

// Check if announcement exists and user has access
const checkAnnouncementAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id)
      .populate('createdBy', 'name email')
      .populate('readBy.user', 'name email');
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check if user has access based on role and announcement status
    const isAdmin = req.user.role === 'admin' || req.user.role === 'company_admin';
    const isCreator = announcement.createdBy._id.toString() === req.user._id.toString();
    const isPublished = announcement.status === 'published';

    if (!isAdmin && !isCreator && !isPublished) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    req.announcement = announcement;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking announcement access',
      error: error.message
    });
  }
};

// Check if announcement can be edited
const checkEditPermission = async (req, res, next) => {
  try {
    const announcement = req.announcement;
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'company_admin';
    const isCreator = announcement.createdBy._id.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Cannot edit this announcement'
      });
    }

    // Check if announcement is archived
    if (announcement.status === 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit archived announcement'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking edit permission',
      error: error.message
    });
  }
};

// Mark announcement as read for the current user
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const announcement = await Announcement.findById(id);
    
    if (announcement && announcement.status === 'published') {
      const readEntry = announcement.readBy.find(
        entry => entry.user.toString() === userId.toString()
      );

      if (!readEntry) {
        announcement.readBy.push({
          user: userId,
          readAt: new Date()
        });
        await announcement.save();
      }
    }

    next();
  } catch (error) {
    // Don't fail the request if marking as read fails
    console.error('Error marking announcement as read:', error);
    next();
  }
};

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

// Rate limiting for announcement creation
const createAnnouncementRateLimit = (req, res, next) => {
  // Simple in-memory rate limiting (in production, use Redis)
  const userKey = req.user._id.toString();
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5; // Max 5 announcements per minute

  if (!global.announcementRateLimit) {
    global.announcementRateLimit = new Map();
  }

  const userRequests = global.announcementRateLimit.get(userKey) || [];
  const recentRequests = userRequests.filter(time => now - time < windowMs);

  if (recentRequests.length >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: 'Too many announcements created. Please wait before creating another.',
      retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
    });
  }

  recentRequests.push(now);
  global.announcementRateLimit.set(userKey, recentRequests);
  
  next();
};

module.exports = {
  validateCreateAnnouncement,
  validateUpdateAnnouncement,
  validateAnnouncementId,
  validateAnnouncementQuery,
  requireAdmin,
  checkAnnouncementAccess,
  checkEditPermission,
  markAsRead,
  handleValidationErrors,
  createAnnouncementRateLimit
};