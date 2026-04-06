const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const mongoose = require('mongoose');

// Global lock registry for managing concurrent operations
const operationLocks = new Map();

// Distributed lock mechanism using MongoDB
const acquireLock = async (lockKey, timeout = 30000) => {
  const lockId = new mongoose.Types.ObjectId();
  const expiresAt = new Date(Date.now() + timeout);
  
  try {
    // Try to acquire lock using MongoDB's atomic operations
    const lockDoc = await mongoose.connection.db.collection('locks').findOneAndUpdate(
      { 
        _id: lockKey,
        $or: [
          { expiresAt: { $lt: new Date() } },
          { expiresAt: { $exists: false } }
        ]
      },
      {
        $set: {
          _id: lockKey,
          lockId: lockId,
          expiresAt: expiresAt,
          acquiredAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    
    // Verify we acquired the lock
    if (lockDoc.value && lockDoc.value.lockId.toString() === lockId.toString()) {
      return lockId;
    }
    
    return null;
  } catch (error) {
    console.error('Lock acquisition failed:', error);
    return null;
  }
};

const releaseLock = async (lockKey, lockId) => {
  try {
    await mongoose.connection.db.collection('locks').deleteOne({
      _id: lockKey,
      lockId: lockId
    });
  } catch (error) {
    console.error('Lock release failed:', error);
  }
};

// Wrapper for concurrent-safe operations
const withLock = async (lockKey, operation, timeout = 30000) => {
  let lockId = null;
  let retries = 3;
  
  while (retries > 0 && !lockId) {
    lockId = await acquireLock(lockKey, timeout);
    if (!lockId) {
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      }
    }
  }
  
  if (!lockId) {
    throw new Error('Could not acquire lock for operation');
  }
  
  try {
    return await operation();
  } finally {
    await releaseLock(lockKey, lockId);
  }
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

// Get all announcements (public - for dashboard display)
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

// Create new announcement (admin only) with concurrency protection
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

    // Use distributed lock to prevent race conditions during creation
    const lockKey = `announcement:create:${req.user._id}`;
    
    const announcement = await withLock(lockKey, async () => {
      // Using secure parameterized query - Mongoose automatically parameterizes
      const announcementData = {
        title: sanitizedTitle,
        content: sanitizedContent,
        isActive,
        createdBy: new mongoose.Types.ObjectId(req.user._id)
      };

      return await executeSecureQuery(Announcement, 'create', announcementData);
    });

    // Populate creator info for response using secure query
    await announcement.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    if (error.message === 'Could not acquire lock for operation') {
      return res.status(409).json({
        success: false,
        message: 'Another operation is in progress. Please try again.'
      });
    }
    
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

// Update announcement (admin only) with concurrency protection
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

    // Use distributed lock to prevent concurrent updates
    const lockKey = `announcement:update:${id}`;
    
    const announcement = await withLock(lockKey, async () => {
      // Using secure query helper with built-in validation
      const announcement = await executeSecureQuery(Announcement, 'findById', id);

      if (!announcement) {
        throw new Error('Announcement not found');
      }

      // Update fields with sanitization - Mongoose saves use parameterized queries
      if (title !== undefined) announcement.title = sanitizeInput(title);
      if (content !== undefined) announcement.content = sanitizeInput(content);
      if (isActive !== undefined) announcement.isActive = isActive;

      announcement.updatedAt = new Date();
      // Mongoose save() uses parameterized queries internally
      await announcement.save();
      
      return announcement;
    });

    // Populate creator info for response
    await announcement.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });
  } catch (error) {
    if (error.message === 'Could not acquire lock for operation') {
      return res.status(409).json({
        success: false,
        message: 'Another operation is in progress. Please try again.'
      });
    }
    
    if (error.message === 'Announcement not found') {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: error.message
    });
  }
};

// Delete announcement (admin only) with concurrency protection
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    // Use distributed lock to prevent concurrent deletes
    const lockKey = `announcement:delete:${id}`;
    
    await withLock(lockKey, async () => {
      // Using secure query helper with built-in validation
      const announcement = await executeSecureQuery(Announcement, 'findById', id);

      if (!announcement) {
        throw new Error('Announcement not found');
      }

      // Using secure parameterized delete operation
      await executeSecureQuery(Announcement, 'findByIdAndDelete', id);
    });

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Could not acquire lock for operation') {
      return res.status(409).json({
        success: false,
        message: 'Another operation is in progress. Please try again.'
      });
    }
    
    if (error.message === 'Announcement not found') {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: error.message
    });
  }
};

// Toggle announcement active status (admin only) with concurrency protection
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Use distributed lock to prevent concurrent status changes
    const lockKey = `announcement:toggle:${id}`;
    
    const announcement = await withLock(lockKey, async () => {
      // Using secure query helper with built-in validation
      const announcement = await executeSecureQuery(Announcement, 'findById', id);

      if (!announcement) {
        throw new Error('Announcement not found');
      }

      announcement.isActive = !announcement.isActive;
      announcement.updatedAt = new Date();
      // Mongoose save() uses parameterized queries internally
      await announcement.save();
      
      return announcement;
    });

    await announcement.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'} successfully`,
      data: announcement
    });
  } catch (error) {
    if (error.message === 'Could not acquire lock for operation') {
      return res.status(409).json({
        success: false,
        message: 'Another operation is in progress. Please try again.'
      });
    }
    
    if (error.message === 'Announcement not found') {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating announcement status',
      error: error.message
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