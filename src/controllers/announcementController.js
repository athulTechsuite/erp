const Announcement = require('../models/Announcement');
const User = require('../models/User');
const NotificationService = require('../services/NotificationService');
const FileUploadService = require('../services/FileUploadService');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

class AnnouncementController {
  // Create new announcement
  async createAnnouncement(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const {
        title,
        content,
        priority,
        scheduledAt,
        attachments
      } = req.body;

      // Check admin permissions
      if (req.user.role !== 'admin' && req.user.role !== 'hr_admin') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to create announcements'
        });
      }

      // Handle file attachments if present
      let processedAttachments = [];
      if (attachments && attachments.length > 0) {
        processedAttachments = await FileUploadService.processAttachments(attachments);
      }

      const announcement = await Announcement.create({
        title,
        content,
        priority: priority || 'normal',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        createdBy: req.user.id,
        attachments: processedAttachments,
        isPublished: scheduledAt ? new Date(scheduledAt) <= new Date() : true
      });

      // Send notifications for urgent announcements if published immediately
      if (announcement.isPublished && priority === 'urgent') {
        await this.sendUrgentNotifications(announcement);
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
        message: 'Internal server error'
      });
    }
  }

  // Get all announcements with filtering and pagination
  async getAnnouncements(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        priority,
        archived = false,
        search
      } = req.query;

      const offset = (page - 1) * limit;
      const isAdmin = req.user.role === 'admin' || req.user.role === 'hr_admin';

      let whereClause = {};

      // Non-admin users only see published announcements
      if (!isAdmin) {
        whereClause.isPublished = true;
        whereClause.scheduledAt = {
          [Op.lte]: new Date()
        };
      }

      // Filter by priority
      if (priority) {
        whereClause.priority = priority;
      }

      // Filter by archived status
      if (archived === 'true') {
        whereClause.archivedAt = {
          [Op.not]: null
        };
      } else {
        whereClause.archivedAt = null;
      }

      // Search functionality
      if (search) {
        whereClause[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { content: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const announcements = await Announcement.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ],
        order: [['scheduledAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Add read status for current user if not admin
      if (!isAdmin) {
        const announcementIds = announcements.rows.map(a => a.id);
        const readStatuses = await this.getUserReadStatuses(req.user.id, announcementIds);
        
        announcements.rows.forEach(announcement => {
          announcement.dataValues.isRead = readStatuses[announcement.id] || false;
        });
      }

      res.json({
        success: true,
        data: {
          announcements: announcements.rows,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(announcements.count / limit),
            totalItems: announcements.count,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching announcements:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get single announcement by ID
  async getAnnouncementById(req, res) {
    try {
      const { id } = req.params;
      const isAdmin = req.user.role === 'admin' || req.user.role === 'hr_admin';

      let whereClause = { id };

      // Non-admin users only see published announcements
      if (!isAdmin) {
        whereClause.isPublished = true;
        whereClause.scheduledAt = {
          [Op.lte]: new Date()
        };
        whereClause.archivedAt = null;
      }

      const announcement = await Announcement.findOne({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      });

      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      // Mark as read for non-admin users
      if (!isAdmin) {
        await this.markAsRead(req.user.id, announcement.id);
        announcement.dataValues.isRead = true;
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
  }

  // Update announcement
  async updateAnnouncement(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const {
        title,
        content,
        priority,
        scheduledAt,
        attachments
      } = req.body;

      // Check admin permissions
      if (req.user.role !== 'admin' && req.user.role !== 'hr_admin') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to update announcements'
        });
      }

      const announcement = await Announcement.findByPk(id);
      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      // Handle file attachments if present
      let processedAttachments = announcement.attachments;
      if (attachments !== undefined) {
        if (attachments.length > 0) {
          processedAttachments = await FileUploadService.processAttachments(attachments);
        } else {
          processedAttachments = [];
        }
      }

      const updateData = {
        title: title || announcement.title,
        content: content || announcement.content,
        priority: priority || announcement.priority,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : announcement.scheduledAt,
        attachments: processedAttachments,
        updatedAt: new Date()
      };

      // Update publication status based on scheduled date
      if (scheduledAt) {
        updateData.isPublished = new Date(scheduledAt) <= new Date();
      }

      await announcement.update(updateData);

      // Send notifications for urgent announcements if newly published
      if (updateData.isPublished && priority === 'urgent' && !announcement.isPublished) {
        await this.sendUrgentNotifications(announcement);
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
  }

  // Delete announcement
  async deleteAnnouncement(req, res) {
    try {
      const { id } = req.params;

      // Check admin permissions
      if (req.user.role !== 'admin' && req.user.role !== 'hr_admin') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to delete announcements'
        });
      }

      const announcement = await Announcement.findByPk(id);
      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      // Delete associated files
      if (announcement.attachments && announcement.attachments.length > 0) {
        await FileUploadService.deleteAttachments(announcement.attachments);
      }

      await announcement.destroy();

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
  }

  // Mark announcement as read/unread
  async toggleReadStatus(req, res) {
    try {
      const { id } = req.params;
      const { isRead } = req.body;

      const announcement = await Announcement.findOne({
        where: {
          id,
          isPublished: true,
          scheduledAt: {
            [Op.lte]: new Date()
          },
          archivedAt: null
        }
      });

      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      if (isRead) {
        await this.markAsRead(req.user.id, id);
      } else {
        await this.markAsUnread(req.user.id, id);
      }

      res.json({
        success: true,
        message: `Announcement marked as ${isRead ? 'read' : 'unread'}`
      });
    } catch (error) {
      console.error('Error toggling read status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get announcement statistics (admin only)
  async getAnnouncementStats(req, res) {
    try {
      const { id } = req.params;

      // Check admin permissions
      if (req.user.role !== 'admin' && req.user.role !== 'hr_admin') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view announcement statistics'
        });
      }

      const announcement = await Announcement.findByPk(id);
      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      const AnnouncementRead = require('../models/AnnouncementRead');
      
      const totalEmployees = await User.count({
        where: {
          role: {
            [Op.not]: 'admin'
          },
          isActive: true
        }
      });

      const readCount = await AnnouncementRead.count({
        where: { announcementId: id }
      });

      const readUsers = await AnnouncementRead.findAll({
        where: { announcementId: id },
        include: [
          {
            model: User,
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ],
        order: [['readAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          totalEmployees,
          readCount,
          unreadCount: totalEmployees - readCount,
          readPercentage: totalEmployees > 0 ? ((readCount / totalEmployees) * 100).toFixed(1) : 0,
          readUsers: readUsers.map(read => ({
            user: read.User,
            readAt: read.readAt
          }))
        }
      });
    } catch (error) {
      console.error('Error fetching announcement stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Archive old announcements (scheduled job)
  async archiveOldAnnouncements() {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const archivedCount = await Announcement.update(
        { archivedAt: new Date() },
        {
          where: {
            scheduledAt: {
              [Op.lt]: sixMonthsAgo
            },
            archivedAt: null
          }
        }
      );

      console.log(`Archived ${archivedCount[0]} announcements older than 6 months`);
      return archivedCount[0];
    } catch (error) {
      console.error('Error archiving old announcements:', error);
      throw error;
    }
  }

  // Helper method to send urgent notifications
  async sendUrgentNotifications(announcement) {
    try {
      const employees = await User.findAll({
        where: {
          role: {
            [Op.not]: 'admin'
          },
          isActive: true
        },
        attributes: ['id', 'email', 'firstName']
      });

      const notifications = employees.map(employee => ({
        userId: employee.id,
        type: 'urgent_announcement',
        title: 'Urgent Company Announcement',
        message: `${announcement.title}`,
        data: {
          announcementId: announcement.id,
          priority: announcement.priority
        }
      }));

      await NotificationService.sendBulkNotifications(notifications);
    } catch (error) {
      console.error('Error sending urgent notifications:', error);
    }
  }

  // Helper method to mark announcement as read
  async markAsRead(userId, announcementId) {
    const AnnouncementRead = require('../models/AnnouncementRead');
    
    await AnnouncementRead.upsert({
      userId,
      announcementId,
      readAt: new Date()
    });
  }

  // Helper method to mark announcement as unread
  async markAsUnread(userId, announcementId) {
    const AnnouncementRead = require('../models/AnnouncementRead');
    
    await AnnouncementRead.destroy({
      where: {
        userId,
        announcementId
      }
    });
  }

  // Helper method to get user read statuses
  async getUserReadStatuses(userId, announcementIds) {
    const AnnouncementRead = require('../models/AnnouncementRead');
    
    const reads = await AnnouncementRead.findAll({
      where: {
        userId,
        announcementId: {
          [Op.in]: announcementIds
        }
      }
    });

    const readStatuses = {};
    reads.forEach(read => {
      readStatuses[read.announcementId] = true;
    });

    return readStatuses;
  }
}

module.exports = new AnnouncementController();