const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateAnnouncement, validateAnnouncementUpdate } = require('../middleware/validation');
const announcementService = require('../services/announcementService');
const notificationService = require('../services/notificationService');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/announcements/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

// Get all published announcements for employees
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, priority, archived = false } = req.query;
    const userId = req.user.id;
    
    const announcements = await announcementService.getAnnouncementsForUser(
      userId,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        priority,
        archived: archived === 'true'
      }
    );
    
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
});

// Get announcement statistics (admin only)
router.get('/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const stats = await announcementService.getAnnouncementStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching announcement stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcement statistics'
    });
  }
});

// Get specific announcement by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    const announcement = await announcementService.getAnnouncementById(id, userId, isAdmin);
    
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
});

// Get read statistics for specific announcement (admin only)
router.get('/:id/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const stats = await announcementService.getAnnouncementReadStats(id);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching announcement stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcement statistics'
    });
  }
});

// Create new announcement (admin only)
router.post('/', 
  authenticateToken, 
  requireRole('admin'), 
  upload.array('attachments', 5),
  validateAnnouncement,
  async (req, res) => {
    try {
      const announcementData = {
        ...req.body,
        authorId: req.user.id,
        attachments: req.files ? req.files.map(file => ({
          filename: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype
        })) : []
      };
      
      const announcement = await announcementService.createAnnouncement(announcementData);
      
      // Send notifications for urgent announcements if published immediately
      if (announcement.priority === 'urgent' && announcement.publishedAt && new Date(announcement.publishedAt) <= new Date()) {
        await notificationService.sendUrgentAnnouncementNotification(announcement);
      }
      
      res.status(201).json({
        success: true,
        data: announcement,
        message: 'Announcement created successfully'
      });
    } catch (error) {
      console.error('Error creating announcement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create announcement'
      });
    }
  }
);

// Update announcement (admin only)
router.put('/:id', 
  authenticateToken, 
  requireRole('admin'), 
  upload.array('attachments', 5),
  validateAnnouncementUpdate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: req.user.id
      };
      
      // Handle new attachments
      if (req.files && req.files.length > 0) {
        updateData.newAttachments = req.files.map(file => ({
          filename: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype
        }));
      }
      
      const announcement = await announcementService.updateAnnouncement(id, updateData);
      
      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }
      
      res.json({
        success: true,
        data: announcement,
        message: 'Announcement updated successfully'
      });
    } catch (error) {
      console.error('Error updating announcement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update announcement'
      });
    }
  }
);

// Delete announcement (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await announcementService.deleteAnnouncement(id);
    
    if (!deleted) {
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
      message: 'Failed to delete announcement'
    });
  }
});

// Mark announcement as read
router.post('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await announcementService.markAnnouncementAsRead(id, userId);
    
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
});

// Mark announcement as unread
router.post('/:id/unread', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await announcementService.markAnnouncementAsUnread(id, userId);
    
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
});

// Archive old announcements (admin only)
router.post('/archive/old', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const archivedCount = await announcementService.archiveOldAnnouncements();
    
    res.json({
      success: true,
      message: `${archivedCount} announcements archived successfully`
    });
  } catch (error) {
    console.error('Error archiving old announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive old announcements'
    });
  }
});

// Publish scheduled announcements (internal endpoint)
router.post('/publish/scheduled', async (req, res) => {
  try {
    // This endpoint should be protected by internal service authentication
    const publishedAnnouncements = await announcementService.publishScheduledAnnouncements();
    
    // Send notifications for urgent announcements
    for (const announcement of publishedAnnouncements) {
      if (announcement.priority === 'urgent') {
        await notificationService.sendUrgentAnnouncementNotification(announcement);
      }
    }
    
    res.json({
      success: true,
      message: `${publishedAnnouncements.length} announcements published`
    });
  } catch (error) {
    console.error('Error publishing scheduled announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish scheduled announcements'
    });
  }
});

module.exports = router;