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

// Transaction wrapper for database operations
const withTransaction = async (operation) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
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
      .lean(); // Use lean() for read-only operations for better performance

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
      .lean();

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

    // Use transaction for atomic operation
    const result = await withTransaction(async (session) => {
      const announcement = new Announcement({
        title: sanitizedTitle,
        content: sanitizedContent,
        isActive: Boolean(isActive),
        createdBy: new mongoose.Types.ObjectId(req.user._id)
      });

      const savedAnnouncement = await announcement.save({ session });
      
      // Populate creator info
      await savedAnnouncement.populate('createdBy', 'name email');
      
      return savedAnnouncement;
    });

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: result
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

    // Use transaction for atomic update operation
    const result = await withTransaction(async (session) => {
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

      // Use findOneAndUpdate with session for atomic operation and optimistic locking
      const announcement = await Announcement.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: updateData },
        { 
          new: true, 
          runValidators: true,
          session 
        }
      ).populate('createdBy', 'name email');

      if (!announcement) {
        throw new Error('Announcement not found');
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

    // Validate ObjectId format to prevent injection
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Use transaction for atomic delete operation
    const result = await withTransaction(async (session) => {
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

// Toggle announcement active status (admin only)
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

    // Use transaction for atomic toggle operation
    const result = await withTransaction(async (session) => {
      // First, get the current announcement
      const currentAnnouncement = await Announcement.findOne(
        { _id: new mongoose.Types.ObjectId(id) },
        null,
        { session }
      );

      if (!currentAnnouncement) {
        throw new Error('Announcement not found');
      }

      // Toggle the status atomically
      const announcement = await Announcement.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id) },
        { 
          $set: { 
            isActive: !currentAnnouncement.isActive,
            updatedAt: new Date()
          }
        },
        { 
          new: true, 
          session 
        }
      ).populate('createdBy', 'name email');

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