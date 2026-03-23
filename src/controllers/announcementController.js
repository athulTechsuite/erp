const Announcement = require('../models/Announcement');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { validationResult } = require('express-validator');

// Get all active announcements
const getAnnouncements = async (req, res) => {
  try {
    const currentDate = new Date();
    const announcements = await Announcement.find({
      publicationDate: { $lte: currentDate },
      $or: [
        { expirationDate: { $gte: currentDate } },
        { expirationDate: null }
      ]
    })
    .populate('createdBy', 'name email')
    .sort({ isPriority: -1, isUrgent: -1, publicationDate: -1 });

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

// Get all announcements for admin (including scheduled and expired)
const getAllAnnouncementsForAdmin = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching all announcements:', error);
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
      .populate('createdBy', 'name email');

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

// Create new announcement
const createAnnouncement = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      title,
      content,
      publicationDate,
      expirationDate,
      isUrgent,
      isPriority
    } = req.body;

    const announcement = new Announcement({
      title,
      content,
      publicationDate: publicationDate || new Date(),
      expirationDate,
      isUrgent: isUrgent || false,
      isPriority: isPriority || false,
      createdBy: req.user.id
    });

    await announcement.save();
    await announcement.populate('createdBy', 'name email');

    // Send email notifications for urgent announcements
    if (isUrgent && new Date(publicationDate || new Date()) <= new Date()) {
      try {
        const users = await User.find({ isActive: true }).select('email name');
        const emailPromises = users.map(user => 
          emailService.sendUrgentAnnouncementEmail(user.email, {
            userName: user.name,
            title: announcement.title,
            content: announcement.content
          })
        );
        await Promise.all(emailPromises);
      } catch (emailError) {
        console.error('Error sending urgent announcement emails:', emailError);
        // Don't fail the request if email sending fails
      }
    }

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

// Update announcement
const updateAnnouncement = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      title,
      content,
      publicationDate,
      expirationDate,
      isUrgent,
      isPriority
    } = req.body;

    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Store previous urgent status to check if we need to send notifications
    const wasUrgent = announcement.isUrgent;

    announcement.title = title;
    announcement.content = content;
    announcement.publicationDate = publicationDate;
    announcement.expirationDate = expirationDate;
    announcement.isUrgent = isUrgent || false;
    announcement.isPriority = isPriority || false;
    announcement.updatedAt = new Date();

    await announcement.save();
    await announcement.populate('createdBy', 'name email');

    // Send email notifications if announcement became urgent or content changed for urgent announcements
    if (isUrgent && (!wasUrgent || wasUrgent) && new Date(publicationDate || new Date()) <= new Date()) {
      try {
        const users = await User.find({ isActive: true }).select('email name');
        const emailPromises = users.map(user => 
          emailService.sendUrgentAnnouncementEmail(user.email, {
            userName: user.name,
            title: announcement.title,
            content: announcement.content
          })
        );
        await Promise.all(emailPromises);
      } catch (emailError) {
        console.error('Error sending urgent announcement emails:', emailError);
      }
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

// Delete announcement
const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    await Announcement.findByIdAndDelete(req.params.id);

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

// Mark announcement as read by user
const markAsRead = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check if user already marked as read
    const userIndex = announcement.readBy.findIndex(
      read => read.user.toString() === req.user.id
    );

    if (userIndex === -1) {
      announcement.readBy.push({
        user: req.user.id,
        readAt: new Date()
      });
      await announcement.save();
    }

    res.json({
      success: true,
      message: 'Announcement marked as read'
    });
  } catch (error) {
    console.error('Error marking announcement as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark announcement as read'
    });
  }
};

// Mark announcement as unread by user
const markAsUnread = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Remove user from readBy array
    announcement.readBy = announcement.readBy.filter(
      read => read.user.toString() !== req.user.id
    );
    
    await announcement.save();

    res.json({
      success: true,
      message: 'Announcement marked as unread'
    });
  } catch (error) {
    console.error('Error marking announcement as unread:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark announcement as unread'
    });
  }
};

// Get announcement read status for current user
const getReadStatus = async (req, res) => {
  try {
    const announcements = await Announcement.find({
      publicationDate: { $lte: new Date() },
      $or: [
        { expirationDate: { $gte: new Date() } },
        { expirationDate: null }
      ]
    }).select('_id readBy');

    const readStatus = announcements.map(announcement => ({
      announcementId: announcement._id,
      isRead: announcement.readBy.some(read => read.user.toString() === req.user.id)
    }));

    res.json({
      success: true,
      data: readStatus
    });
  } catch (error) {
    console.error('Error fetching read status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch read status'
    });
  }
};

module.exports = {
  getAnnouncements,
  getAllAnnouncementsForAdmin,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  markAsRead,
  markAsUnread,
  getReadStatus
};