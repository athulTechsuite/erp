const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');

// Get all announcements
const getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select('title content createdAt updatedAt author');
    
    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
};

// Get single announcement by ID
const getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('author', 'name email');
    
    if (!announcement) {
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
      message: 'Failed to fetch announcement'
    });
  }
};

// Create new announcement (Admin only)
const createAnnouncement = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const { title, content } = req.body;
    
    const announcement = new Announcement({
      title,
      content,
      author: req.user.id,
      isActive: true
    });
    
    await announcement.save();
    
    // Populate author details for response
    await announcement.populate('author', 'name email');
    
    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement'
    });
  }
};

// Update announcement (Admin only)
const updateAnnouncement = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const { title, content } = req.body;
    
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      {
        title,
        content,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate('author', 'name email');
    
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
      message: 'Failed to update announcement'
    });
  }
};

// Delete announcement (Admin only)
const deleteAnnouncement = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    // Soft delete by setting isActive to false
    announcement.isActive = false;
    announcement.updatedAt = new Date();
    await announcement.save();
    
    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement'
    });
  }
};

// Get announcements for admin management (includes inactive ones)
const getAnnouncementsForAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .populate('author', 'name email')
      .select('title content createdAt updatedAt author isActive');
    
    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching announcements for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
};

module.exports = {
  getAllAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getAnnouncementsForAdmin
};