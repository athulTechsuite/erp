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

// Enhanced parameterized query helper for MongoDB operations
const executeSecureQuery = async (model, operation, params = {}) => {
  try {
    // Validate all ObjectId parameters to prevent injection
    for (const [key, value] of Object.entries(params)) {
      if (key.includes('Id') || key === '_id' || key === 'id') {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new Error(`Invalid ObjectId format for parameter: ${key}`);
        }
        // Convert to proper ObjectId to ensure parameterized query
        params[key] = new mongoose.Types.ObjectId(value);
      }
    }

    // Execute operation with validated parameters using proper MongoDB methods
    switch (operation) {
      case 'find':
        // Use parameterized query with filter object - prevents injection
        return await model.find(params.filter || {}, params.select || null, params.options || {});
      case 'findById':
        // MongoDB's findById method automatically uses parameterized queries
        return await model.findById(params.id, params.select || null);
      case 'findOne':
        // Use parameterized query with filter object
        return await model.findOne(params.filter || {}, params.select || null);
      case 'create':
        // Create method uses parameterized insertion
        return await model.create(params.data);
      case 'findByIdAndUpdate':
        // Update methods use parameterized queries with proper filter and update objects
        return await model.findByIdAndUpdate(params.id, params.update, params.options || {});
      case 'findByIdAndDelete':
        // Delete method uses parameterized query
        return await model.findByIdAndDelete(params.id);
      case 'updateOne':
        // UpdateOne uses parameterized filter and update objects
        return await model.updateOne(params.filter, params.update, params.options || {});
      case 'deleteOne':
        // DeleteOne uses parameterized filter object
        return await model.deleteOne(params.filter);
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
    const announcements = await executeSecureQuery(Announcement, 'find', {
      filter: {},
      options: { sort: { createdAt: -1 } }
    });

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

    // Sanitize input to prevent stored XSS
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

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
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

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: updatedAnnouncement
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
  const session = await mongoose.startSession();
  
  try {
    const { id } = req.params;

    await session.withTransaction(async () => {
      // First, verify the announcement exists within the transaction
      const announcement = await executeSecureQuery(Announcement, 'findById', {
        id: id
      });

      if (!announcement) {
        throw new Error('Announcement not found');
      }

      // Perform the delete operation within the transaction
      await executeSecureQuery(Announcement, 'findByIdAndDelete', {
        id: id
      });
    });

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Announcement not found') {
      res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error deleting announcement',
        error: error.message
      });
    }
  } finally {
    await session.endSession();
  }
};

// Toggle announcement active status (admin only)
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;

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