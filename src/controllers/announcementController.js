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

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
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

// Enhanced transaction wrapper for database operations with retry mechanism
const withTransaction = async (operation, retries = 3) => {
  let attempt = 0;
  
  while (attempt < retries) {
    const session = await mongoose.startSession();
    session.startTransaction({
      readConcern: { level: "majority" },
      writeConcern: { w: "majority" }
    });
    
    try {
      const result = await operation(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      
      // Retry on write conflicts or transient errors
      if ((error.code === 112 || error.code === 11000 || error.name === 'WriteConflictError') && attempt < retries - 1) {
        attempt++;
        // Exponential backoff with jitter
        const delay = Math.floor(Math.random() * (50 * Math.pow(2, attempt)));
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    } finally {
      session.endSession();
    }
  }
};

// Enhanced atomic operation helper for concurrent-safe operations
const performAtomicOperation = async (operation, options = {}) => {
  const { maxRetries = 3, baseDelay = 50 } = options;
  
  return await withTransaction(async (session) => {
    return await operation(session);
  }, maxRetries);
};

// Get all announcements (public - for dashboard display)
const getAllAnnouncements = async (req, res) => {
  try {
    // Using parameterized query with MongoDB native operations - safe from injection
    const announcements = await Announcement.find({ 
      isActive: { $eq: true } 
    })
      .sort({ createdAt: -1 })
      .select('title content createdAt updatedAt')
      .lean() // Use lean() for read-only operations for better performance
      .read('secondaryPreferred'); // Use secondary read for better performance on read-heavy operations

    res.json({
      success: true,
      data: announcements
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
    const announcements = await Announcement.find({})
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .lean()
      .read('secondaryPreferred');

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Create new announcement (admin only) - Enhanced with race condition protection
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

    // Validate input types and lengths
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

    if (title.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Title must be 200 characters or less'
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Content must be 5000 characters or less'
      });
    }

    // Sanitize input to prevent stored XSS
    const sanitizedTitle = sanitizeInput(title.trim());
    const sanitizedContent = sanitizeInput(content.trim());

    // Enhanced atomic operation with race condition protection
    const result = await performAtomicOperation(async (session) => {
      // Generate unique identifier for this creation request
      const creationTimestamp = new Date();
      const uniqueId = new mongoose.Types.ObjectId();
      
      // Check for potential duplicate creation attempts by the same user with same title
      // within a short time window (prevents accidental double-clicks)
      const recentDuplicate = await Announcement.findOne({
        title: sanitizedTitle,
        createdBy: new mongoose.Types.ObjectId(req.user._id),
        createdAt: { 
          $gte: new Date(creationTimestamp.getTime() - 5000) // 5 seconds window
        }
      }, null, { session });

      if (recentDuplicate) {
        throw new Error('DUPLICATE_REQUEST: Announcement with same title was just created');
      }

      // Create announcement with atomic operation
      const announcementData = {
        _id: uniqueId,
        title: sanitizedTitle,
        content: sanitizedContent,
        isActive: Boolean(isActive),
        createdBy: new mongoose.Types.ObjectId(req.user._id),
        createdAt: creationTimestamp,
        updatedAt: creationTimestamp
      };

      // Use insertOne for better control over concurrent insertions
      const insertResult = await Announcement.collection.insertOne(
        announcementData,
        { session }
      );

      if (!insertResult.acknowledged) {
        throw new Error('Failed to create announcement');
      }

      // Retrieve the created announcement with populated fields
      const savedAnnouncement = await Announcement.findById(uniqueId, null, { session })
        .populate('createdBy', 'name email');
      
      return savedAnnouncement;
    });

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: result
    });
  } catch (error) {
    // Handle specific duplicate request error
    if (error.message === 'DUPLICATE_REQUEST: Announcement with same title was just created') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate request detected. Announcement with same title was recently created.'
      });
    }

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Announcement creation conflict. Please try again.'
      });
    }

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
    
    // Validate ObjectId format to prevent injection
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Use parameterized query with exact ObjectId match - safe from injection
    const announcement = await Announcement.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    })
      .populate('createdBy', 'name email')
      .lean()
      .read('secondaryPreferred');

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
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Update announcement (admin only) - Enhanced with optimistic locking
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

    // Validate ObjectId format to prevent injection
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Validate input if provided
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Title must be a non-empty string'
        });
      }
      if (title.length > 200) {
        return res.status(400).json({
          success: false,
          message: 'Title must be 200 characters or less'
        });
      }
    }

    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Content must be a non-empty string'
        });
      }
      if (content.length > 5000) {
        return res.status(400).json({
          success: false,
          message: 'Content must be 5000 characters or less'
        });
      }
    }

    // Enhanced atomic update operation with optimistic locking
    const result = await performAtomicOperation(async (session) => {
      // First, get current document with version for optimistic locking
      const currentAnnouncement = await Announcement.findById(
        new mongoose.Types.ObjectId(id),
        null,
        { session }
      );

      if (!currentAnnouncement) {
        throw new Error('Announcement not found');
      }

      // Build update object
      const updateData = {
        updatedAt: new Date()
      };

      if (title !== undefined) {
        updateData.title = sanitizeInput(title.trim());
      }
      if (content !== undefined) {
        updateData.content = sanitizeInput(content.trim());
      }
      if (isActive !== undefined) {
        updateData.isActive = Boolean(isActive);
      }

      // Use findOneAndUpdate with optimistic locking pattern
      const announcement = await Announcement.findOneAndUpdate(
        { 
          _id: new mongoose.Types.ObjectId(id),
          updatedAt: currentAnnouncement.updatedAt // Optimistic locking check
        },
        { $set: updateData },
        { 
          new: true, 
          runValidators: true,
          session 
        }
      ).populate('createdBy', 'name email');

      if (!announcement) {
        throw new Error('Update conflict detected. Document was modified by another process.');
      }

      return announcement;
    });

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: result
    });
  } catch (error) {
    if (error.message === 'Announcement not found') {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    if (error.message === 'Update conflict detected. Document was modified by another process.') {
      return res.status(409).json({
        success: false,
        message: 'Update conflict. The announcement was modified by another user. Please refresh and try again.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Delete announcement (admin only) - Enhanced with atomic operation
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format to prevent injection
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Enhanced atomic delete operation
    const result = await performAtomicOperation(async (session) => {
      const announcement = await Announcement.findOneAndDelete(
        { _id: new mongoose.Types.ObjectId(id) },
        { session }
      );

      if (!announcement) {
        throw new Error('Announcement not found');
      }

      return announcement;
    });

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Announcement not found') {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Toggle announcement active status (admin only) - Enhanced with race condition protection
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format to prevent injection
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Enhanced atomic toggle operation with race condition protection
    const result = await performAtomicOperation(async (session) => {
      // Get current announcement with session for consistency
      const currentAnnouncement = await Announcement.findOne(
        { _id: new mongoose.Types.ObjectId(id) },
        null,
        { session }
      );

      if (!currentAnnouncement) {
        throw new Error('Announcement not found');
      }

      // Store current state for optimistic locking
      const currentUpdatedAt = currentAnnouncement.updatedAt;
      const newStatus = !currentAnnouncement.isActive;

      // Atomic toggle with optimistic locking
      const announcement = await Announcement.findOneAndUpdate(
        { 
          _id: new mongoose.Types.ObjectId(id),
          updatedAt: currentUpdatedAt // Ensure no concurrent modifications
        },
        { 
          $set: { 
            isActive: newStatus,
            updatedAt: new Date()
          }
        },
        { 
          new: true, 
          session 
        }
      ).populate('createdBy', 'name email');

      if (!announcement) {
        throw new Error('Status toggle conflict. Document was modified by another process.');
      }

      return announcement;
    });

    res.json({
      success: true,
      message: `Announcement ${result.isActive ? 'activated' : 'deactivated'} successfully`,
      data: result
    });
  } catch (error) {
    if (error.message === 'Announcement not found') {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    if (error.message === 'Status toggle conflict. Document was modified by another process.') {
      return res.status(409).json({
        success: false,
        message: 'Status update conflict. The announcement was modified by another user. Please refresh and try again.'
      });
    }

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
  getAllAnnouncements,
  getAnnouncementsForAdmin,
  createAnnouncement,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus
};