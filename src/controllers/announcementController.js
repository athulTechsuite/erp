const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const mongoose = require('mongoose');

// Authentication middleware to check if user is logged in
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  next();
};

// Input sanitization middleware
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // Strip HTML tags and sanitize content to prevent XSS
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

// SQL injection protection for string parameters
const sanitizeForSQL = (input) => {
  if (typeof input !== 'string') return input;
  // Remove or escape common SQL injection patterns
  return input.replace(/['"\\;]/g, '').trim();
};

// Validate and sanitize query parameters to prevent NoSQL injection
const sanitizeQueryParams = (query) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(query)) {
    // Only allow safe query parameters
    if (['page', 'limit', 'sort', 'search', 'isActive'].includes(key)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeForSQL(value);
      } else if (typeof value === 'boolean' || typeof value === 'number') {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
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
    // Sanitize query parameters to prevent NoSQL injection
    const sanitizedQuery = sanitizeQueryParams(req.query);
    
    // Build safe query using MongoDB's parameterized approach
    const query = { isActive: true };
    
    // Add search functionality with safe regex
    if (sanitizedQuery.search) {
      const searchTerm = sanitizedQuery.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { content: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .select('title content createdAt updatedAt')
      .lean(); // Use lean() for better performance and security

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all announcements for admin management
const getAnnouncementsForAdmin = async (req, res) => {
  try {
    // Sanitize query parameters
    const sanitizedQuery = sanitizeQueryParams(req.query);
    
    // Build safe parameterized query
    const query = {};
    
    // Add filters with proper validation
    if (sanitizedQuery.isActive !== undefined) {
      query.isActive = sanitizedQuery.isActive === 'true';
    }

    if (sanitizedQuery.search) {
      const searchTerm = sanitizedQuery.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { content: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .lean();

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching admin announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
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

    // Validate input types to prevent injection
    if (typeof title !== 'string' || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input types'
      });
    }

    // Sanitize input to prevent stored XSS and injection
    const sanitizedTitle = sanitizeInput(sanitizeForSQL(title));
    const sanitizedContent = sanitizeInput(sanitizeForSQL(content));

    // Validate ObjectId for createdBy field
    if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Use parameterized approach with Mongoose (prevents NoSQL injection)
    const announcement = new Announcement({
      title: sanitizedTitle,
      content: sanitizedContent,
      isActive: Boolean(isActive),
      createdBy: new mongoose.Types.ObjectId(req.user._id)
    });

    await announcement.save();

    // Safe population with field selection
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
      message: 'Internal server error'
    });
  }
};

// Get single announcement by ID
const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Strict ObjectId validation to prevent injection
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Use parameterized query with validated ObjectId
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
    if (req.user.role !== 'admin' && !announcement.isActive) {
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
      message: 'Internal server error'
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

    // Strict ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Validate input types
    if (title !== undefined && typeof title !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Title must be a string'
      });
    }
    if (content !== undefined && typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Content must be a string'
      });
    }

    // Build update object with sanitized values
    const updateFields = {};
    if (title !== undefined) updateFields.title = sanitizeInput(sanitizeForSQL(title));
    if (content !== undefined) updateFields.content = sanitizeInput(sanitizeForSQL(content));
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);
    updateFields.updatedAt = new Date();

    // Use parameterized update with validated ObjectId
    const announcement = await Announcement.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete announcement (admin only)
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    // Strict ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // Use parameterized delete with validated ObjectId
    const announcement = await Announcement.findOneAndDelete({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Toggle announcement active status (admin only)
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Strict ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid announcement ID format'
      });
    }

    // First fetch the current document safely
    const announcement = await Announcement.findOne({ 
      _id: new mongoose.Types.ObjectId(id) 
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Use parameterized update to toggle status
    const updatedAnnouncement = await Announcement.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { 
        $set: { 
          isActive: !announcement.isActive,
          updatedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.json({
      success: true,
      message: `Announcement ${updatedAnnouncement.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedAnnouncement
    });
  } catch (error) {
    console.error('Error toggling announcement status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
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