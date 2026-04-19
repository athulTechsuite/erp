const Announcement = require('../models/Announcement');
const User = require('../models/User');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

// Get all announcements
const getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: announcements
    });
  } catch (error) {
    logger.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements',
      error: error.message
    });
  }
};

// Get active announcements for dashboard
const getActiveAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: announcements
    });
  } catch (error) {
    logger.error('Error fetching active announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements',
      error: error.message
    });
  }
};

// Create new announcement
const createAnnouncement = async (req, res) => {
  try {
    const { title, content } = req.body;
    const createdBy = req.user.id;

    // Validate input
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    // Create announcement
    const announcement = new Announcement({
      title: title.trim(),
      content: content.trim(),
      createdBy,
      isActive: true
    });

    await announcement.save();
    await announcement.populate('createdBy', 'firstName lastName email');

    // Send email notifications to all active employees
    try {
      const activeUsers = await User.find({ 
        isActive: true,
        status: 'active' 
      }).select('email firstName lastName');

      if (activeUsers.length > 0) {
        const emailPromises = activeUsers.map(user => 
          emailService.sendAnnouncementEmail({
            to: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            announcement: {
              title: announcement.title,
              content: announcement.content,
              createdAt: announcement.createdAt,
              createdBy: `${announcement.createdBy.firstName} ${announcement.createdBy.lastName}`
            }
          })
        );

        // Send emails in batches to avoid overwhelming the email service
        const batchSize = 50;
        for (let i = 0; i < emailPromises.length; i += batchSize) {
          const batch = emailPromises.slice(i, i + batchSize);
          await Promise.allSettled(batch);
        }

        logger.info(`Announcement emails sent to ${activeUsers.length} users for announcement: ${announcement.title}`);
      }
    } catch (emailError) {
      logger.error('Error sending announcement emails:', emailError);
      // Don't fail the announcement creation if email fails
      // The announcement is still created and visible in-app
    }

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    logger.error('Error creating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement',
      error: error.message
    });
  }
};

// Get single announcement by ID
const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id)
      .populate('createdBy', 'firstName lastName email');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    res.status(200).json({
      success: true,
      data: announcement
    });
  } catch (error) {
    logger.error('Error fetching announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcement',
      error: error.message
    });
  }
};

// Update announcement
const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, isActive } = req.body;

    // Validate input
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Update announcement
    announcement.title = title.trim();
    announcement.content = content.trim();
    announcement.isActive = isActive !== undefined ? isActive : announcement.isActive;
    announcement.updatedAt = new Date();

    await announcement.save();
    await announcement.populate('createdBy', 'firstName lastName email');

    res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });
  } catch (error) {
    logger.error('Error updating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement',
      error: error.message
    });
  }
};

// Delete announcement
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    await Announcement.findByIdAndDelete(id);

    logger.info(`Announcement deleted: ${announcement.title} by user: ${req.user.id}`);

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement',
      error: error.message
    });
  }
};

// Toggle announcement active status
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    announcement.isActive = !announcement.isActive;
    announcement.updatedAt = new Date();
    await announcement.save();

    res.status(200).json({
      success: true,
      message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'} successfully`,
      data: announcement
    });
  } catch (error) {
    logger.error('Error toggling announcement status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle announcement status',
      error: error.message
    });
  }
};

// Send announcement to new employee
const sendAnnouncementToNewEmployee = async (userId) => {
  try {
    const user = await User.findById(userId).select('email firstName lastName');
    if (!user) {
      logger.error('User not found for announcement delivery:', userId);
      return;
    }

    const activeAnnouncements = await Announcement.find({ isActive: true })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    if (activeAnnouncements.length === 0) {
      return;
    }

    // Send email for each active announcement
    const emailPromises = activeAnnouncements.map(announcement => 
      emailService.sendAnnouncementEmail({
        to: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        announcement: {
          title: announcement.title,
          content: announcement.content,
          createdAt: announcement.createdAt,
          createdBy: `${announcement.createdBy.firstName} ${announcement.createdBy.lastName}`
        }
      })
    );

    await Promise.allSettled(emailPromises);
    logger.info(`Active announcements sent to new employee: ${user.email}`);
  } catch (error) {
    logger.error('Error sending announcements to new employee:', error);
  }
};

module.exports = {
  getAllAnnouncements,
  getActiveAnnouncements,
  createAnnouncement,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus,
  sendAnnouncementToNewEmployee
};