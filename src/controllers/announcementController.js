const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const mongoose = require('mongoose');

// Distributed locking mechanism for critical operations
class DistributedLock {
  constructor(collection = 'locks') {
    this.collection = collection;
    this.lockTimeout = 30000; // 30 seconds default timeout
  }

  async acquireLock(resource, sessionId, timeout = this.lockTimeout) {
    const lockId = `announcement_${resource}`;
    const expiresAt = new Date(Date.now() + timeout);
    
    try {
      // Try to create a lock document
      const result = await mongoose.connection.db.collection(this.collection).insertOne({
        _id: lockId,
        sessionId,
        resource,
        createdAt: new Date(),
        expiresAt,
        type: 'announcement_operation'
      });
      
      return result.acknowledged;
    } catch (error) {
      // If lock already exists, check if it's expired
      if (error.code === 11000) {
        const existingLock = await mongoose.connection.db.collection(this.collection)
          .findOne({ _id: lockId });
        
        if (existingLock && existingLock.expiresAt < new Date()) {
          // Remove expired lock and retry
          await this.releaseLock(resource, existingLock.sessionId);
          return this.acquireLock(resource, sessionId, timeout);
        }
        return false;
      }
      throw error;
    }
  }

  async releaseLock(resource, sessionId) {
    const lockId = `announcement_${resource}`;
    
    try {
      const result = await mongoose.connection.db.collection(this.collection).deleteOne({
        _id: lockId,
        sessionId
      });
      
      return result.deletedCount > 0;
    } catch (error) {
      // Log error but don't throw to avoid blocking cleanup
      console.error(`Failed to release lock for ${resource}:`, error.message);
      return false;
    }
  }

  async withLock(resource, operation, timeout = this.lockTimeout) {
    const sessionId = new mongoose.Types.ObjectId().toString();
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      const lockAcquired = await this.acquireLock(resource, sessionId, timeout);
      
      if (lockAcquired) {
        try {
          return await operation();
        } finally {
          await this.releaseLock(resource, sessionId);
        }
      }

      // If lock not acquired, wait and retry
      attempt++;
      if (attempt < maxRetries) {
        const delay = Math.floor(Math.random() * (100 * Math.pow(2, attempt)));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Could not acquire distributed lock after maximum retries');
  }
}

// Initialize distributed lock instance
const distributedLock = new DistributedLock();

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

// Enhanced transaction wrapper with improved concurrency handling
const withTransaction = async (operation, retries = 3) => {
  let attempt = 0;
  
  while (attempt < retries) {
    const session = await mongoose.startSession();
    
    try {
      // Use stronger isolation for critical operations
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority", j: true },
        readPreference: "primary" // Ensure consistent reads
      });
      
      const result = await operation(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      
      // Enhanced retry logic for various conflict scenarios
      const retryableErrors = [
        112, // WriteConflictError
        11000, // DuplicateKeyError
        16500, // TransientTransactionError
        251, // NoSuchTransaction
        50 // ExceededTimeLimit
      ];
      
      const isRetryable = retryableErrors.includes(error.code) || 
                         error.name === 'WriteConflictError' ||
                         error.hasErrorLabel?.('TransientTransactionError');
      
      if (isRetryable && attempt < retries - 1) {
        attempt++;
        // Progressive backoff with jitter
        const baseDelay = 50 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * baseDelay * 0.1);
        const delay = baseDelay + jitter;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    } finally {
      session.endSession();
    }
  }
};

// Enhanced atomic operation helper with distributed locking
const performAtomicOperation = async (operation, options = {}) => {
  const { 
    maxRetries = 3, 
    baseDelay = 50, 
    useDistributedLock = false, 
    lockResource = null,
    lockTimeout = 30000 
  } = options;
  
  if (useDistributedLock && lockResource) {
    return await distributedLock.withLock(
      lockResource,
      async () => {
        return await withTransaction(async (session) => {
          return await operation(session);
        }, maxRetries);
      },
      lockTimeout
    );
  }
  
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

// Create new announcement (admin only) - Enhanced with distributed locking
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

    // Create lock resource identifier based on user and title
    const lockResource = `create_${req.user._id}_${Buffer.from(sanitizedTitle).toString('base64').substring(0, 20)}`;

    // Enhanced atomic operation with distributed locking
    const result = await performAtomicOperation(async (session) => {
      // Generate unique identifier for this creation request
      const creationTimestamp = new Date();
      const uniqueId = new mongoose.Types.ObjectId();
      
      // Enhanced duplicate detection with broader time window and content similarity
      const duplicateQuery = {
        $or: [
          {
            title: sanitizedTitle,
            createdBy: new mongoose.Types.ObjectId(req.user._id),
            createdAt: { 
              $gte: new Date(creationTimestamp.getTime() - 10000) // 10 seconds window
            }
          },
          {
            title: sanitizedTitle,
            content: sanitizedContent,
            createdAt: {
              $gte: new Date(creationTimestamp.getTime() - 60000) // 1 minute for exact content match
            }
          }
        ]
      };

      const recentDuplicate = await Announcement.findOne(duplicateQuery, null, { 
        session,
        readConcern: { level: "snapshot" }
      });

      if (recentDuplicate) {
        throw new Error('DUPLICATE_REQUEST: Similar announcement was recently created');
      }

      // Create announcement with atomic operation and version tracking
      const announcementData = {
        _id: uniqueId,
        title: sanitizedTitle,
        content: sanitizedContent,
        isActive: Boolean(isActive),
        createdBy: new mongoose.Types.ObjectId(req.user._id),
        createdAt: creationTimestamp,
        updatedAt: creationTimestamp,
        version: 1 // Add version field for optimistic locking
      };

      // Use insertOne with session for transactional consistency
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
    }, {
      useDistributedLock: true,
      lockResource,
      lockTimeout: 15000 // 15 second lock timeout for creation
    });

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: result
    });
  } catch (error) {
    // Handle specific error types
    if (error.message.includes('DUPLICATE_REQUEST')) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate request detected. Similar announcement was recently created.'
      });
    }

    if (error.message.includes('Could not acquire distributed lock')) {
      return res.status(429).json({
        success: false,
        message: 'System is busy processing similar requests. Please try again shortly.'
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

// Update announcement (admin only) - Enhanced with distributed locking and version control
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

    // Create lock resource for this specific announcement update
    const lockResource = `update_${id}`;

    // Enhanced atomic update operation with distributed locking
    const result = await performAtomicOperation(async (session) => {
      // Get current document with stronger read consistency
      const currentAnnouncement = await Announcement.findById(
        new mongoose.Types.ObjectId(id),
        null,
        { 
          session,
          readConcern: { level: "snapshot" }
        }
      );

      if (!currentAnnouncement) {
        throw new Error('Announcement not found');
      }

      // Build update object with version increment
      const updateData = {
        updatedAt: new Date(),
        $inc: { version: 1 }
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

      // Use findOneAndUpdate with enhanced optimistic locking
      const announcement = await Announcement.findOneAndUpdate(
        { 
          _id: new mongoose.Types.ObjectId(id),
          version: currentAnnouncement.version // Version-based optimistic locking
        },
        updateData,
        { 
          new: true, 
          runValidators: true,
          session
        }
      ).populate('createdBy', 'name email');

      if (!announcement) {
        throw new Error('UPDATE_CONFLICT: Document was modified by another process');
      }

      return announcement;
    }, {
      useDistributedLock: true,
      lockResource,
      lockTimeout: 10000 // 10 second lock timeout for updates
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

    if (error.message.includes('UPDATE_CONFLICT')) {
      return res.status(409).json({
        success: false,
        message: 'Update conflict. The announcement was modified by another user. Please refresh and try again.'
      });
    }

    if (error.message.includes('Could not acquire distributed lock')) {
      return res.status(429).json({
        success: false,
        message: 'Another update operation is in progress. Please try again shortly.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Delete announcement (admin only) - Enhanced with distributed locking
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

    // Create lock resource for this specific announcement deletion
    const lockResource = `delete_${id}`;

    // Enhanced atomic delete operation with distributed locking
    const result = await performAtomicOperation(async (session) => {
      // First verify the announcement exists
      const existingAnnouncement = await Announcement.findById(
        new mongoose.Types.ObjectId(id),
        null,
        { 
          session,
          readConcern: { level: "snapshot" }
        }
      );

      if (!existingAnnouncement) {
        throw new Error('Announcement not found');
      }

      // Perform atomic deletion
      const announcement = await Announcement.findOneAndDelete(
        { _id: new mongoose.Types.ObjectId(id) },
        { session }
      );

      if (!announcement) {
        throw new Error('DELETE_CONFLICT: Announcement was already deleted');
      }

      return announcement;
    }, {
      useDistributedLock: true,
      lockResource,
      lockTimeout: 10000 // 10 second lock timeout for deletion
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

    if (error.message.includes('DELETE_CONFLICT')) {
      return res.status(409).json({
        success: false,
        message: 'Delete conflict. The announcement may have been already deleted.'
      });
    }

    if (error.message.includes('Could not acquire distributed lock')) {
      return res.status(429).json({
        success: false,
        message: 'Another operation is in progress on this announcement. Please try again shortly.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

// Toggle announcement active status (admin only) - Enhanced with distributed locking
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

    // Create lock resource for this specific announcement toggle
    const lockResource = `toggle_${id}`;

    // Enhanced atomic toggle operation with distributed locking
    const result = await performAtomicOperation(async (session) => {
      // Get current announcement with stronger consistency
      const currentAnnouncement = await Announcement.findOne(
        { _id: new mongoose.Types.ObjectId(id) },
        null,
        { 
          session,
          readConcern: { level: "snapshot" }
        }
      );

      if (!currentAnnouncement) {
        throw new Error('Announcement not found');
      }

      // Store current state for version-based locking
      const currentVersion = currentAnnouncement.version || 0;
      const newStatus = !currentAnnouncement.isActive;

      // Atomic toggle with version-based optimistic locking
      const announcement = await Announcement.findOneAndUpdate(
        { 
          _id: new mongoose.Types.ObjectId(id),
          version: currentVersion // Version-based locking
        },
        { 
          $set: { 
            isActive: newStatus,
            updatedAt: new Date()
          },
          $inc: { version: 1 }
        },
        { 
          new: true, 
          session 
        }
      ).populate('createdBy', 'name email');

      if (!announcement) {
        throw new Error('TOGGLE_CONFLICT: Document was modified by another process');
      }

      return announcement;
    }, {
      useDistributedLock: true,
      lockResource,
      lockTimeout: 5000 // 5 second lock timeout for status toggle
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

    if (error.message.includes('TOGGLE_CONFLICT')) {
      return res.status(409).json({
        success: false,
        message: 'Status update conflict. The announcement was modified by another user. Please refresh and try again.'
      });
    }

    if (error.message.includes('Could not acquire distributed lock')) {
      return res.status(429).json({
        success: false,
        message: 'Another operation is in progress. Please try again shortly.'
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