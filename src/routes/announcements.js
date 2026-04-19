const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { body, validationResult, param } = require('express-validator');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { sendUrgentAnnouncementEmail } = require('../services/emailService');

// Validation middleware
const validateAnnouncement = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Content must be between 1 and 5000 characters'),
  body('priority').optional().isIn(['normal', 'urgent']).withMessage('Priority must be normal or urgent'),
  body('publishDate').optional().isISO8601().withMessage('Publish date must be a valid ISO date'),
  body('expirationDate').optional().isISO8601().withMessage('Expiration date must be a valid ISO date'),
  body('isActive').optional().isBoolean().withMessage('IsActive must be a boolean')
];

const validateAnnouncementId = [
  param('id').isInt({ min: 1 }).withMessage('Announcement ID must be a positive integer')
];

// GET /api/announcements - Get all active announcements for employees
router.get('/', authenticateToken, async (req, res) => {
  try {
    const announcements = await Announcement.findAll({
      where: {
        isActive: true,
        publishDate: {
          [require('sequelize').Op.lte]: new Date()
        },
        expirationDate: {
          [require('sequelize').Op.gt]: new Date()
        }
      },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }],
      order: [
        ['priority', 'DESC'],
        ['publishDate', 'DESC']
      ]
    });

    // Check read status for current user
    const announcementsWithReadStatus = await Promise.all(
      announcements.map(async (announcement) => {
        const readStatus = await announcement.getReadByUsers({
          where: { id: req.user.id }
        });
        
        return {
          ...announcement.toJSON(),
          isRead: readStatus.length > 0
        };
      })
    );

    res.json(announcementsWithReadStatus);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/announcements/admin - Get all announcements for admin
router.get('/admin', authenticateToken, requireRole(['admin', 'hr']), async (req, res) => {
  try {
    const announcements = await Announcement.findAll({
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json(announcements);
  } catch (error) {
    console.error('Error fetching admin announcements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/announcements/:id - Get specific announcement
router.get('/:id', authenticateToken, validateAnnouncementId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const announcement = await Announcement.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }]
    });

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // Check if user has admin role or if announcement is active and published
    const isAdmin = ['admin', 'hr'].includes(req.user.role);
    const isPublished = announcement.isActive && 
      new Date(announcement.publishDate) <= new Date() &&
      new Date(announcement.expirationDate) > new Date();

    if (!isAdmin && !isPublished) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json(announcement);
  } catch (error) {
    console.error('Error fetching announcement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/announcements - Create new announcement
router.post('/', authenticateToken, requireRole(['admin', 'hr']), validateAnnouncement, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      content,
      priority = 'normal',
      publishDate = new Date(),
      expirationDate,
      isActive = true
    } = req.body;

    // Set default expiration date to 30 days from publish date if not provided
    const defaultExpirationDate = new Date(publishDate);
    defaultExpirationDate.setDate(defaultExpirationDate.getDate() + 30);

    const announcement = await Announcement.create({
      title,
      content,
      priority,
      publishDate: new Date(publishDate),
      expirationDate: expirationDate ? new Date(expirationDate) : defaultExpirationDate,
      isActive,
      authorId: req.user.id
    });

    // Send email notification for urgent announcements that are immediately published
    if (priority === 'urgent' && new Date(publishDate) <= new Date() && isActive) {
      try {
        const users = await User.findAll({
          where: { isActive: true },
          attributes: ['email', 'firstName', 'lastName']
        });

        await sendUrgentAnnouncementEmail(users, announcement);
      } catch (emailError) {
        console.error('Error sending urgent announcement emails:', emailError);
        // Don't fail the announcement creation if email fails
      }
    }

    const createdAnnouncement = await Announcement.findByPk(announcement.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }]
    });

    res.status(201).json(createdAnnouncement);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/announcements/:id - Update announcement
router.put('/:id', authenticateToken, requireRole(['admin', 'hr']), validateAnnouncementId, validateAnnouncement, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const {
      title,
      content,
      priority,
      publishDate,
      expirationDate,
      isActive
    } = req.body;

    const wasUrgent = announcement.priority === 'urgent';
    const wasPublished = announcement.isActive && new Date(announcement.publishDate) <= new Date();

    await announcement.update({
      title,
      content,
      priority,
      publishDate: publishDate ? new Date(publishDate) : announcement.publishDate,
      expirationDate: expirationDate ? new Date(expirationDate) : announcement.expirationDate,
      isActive: isActive !== undefined ? isActive : announcement.isActive
    });

    // Send email notification for newly urgent announcements
    const isNowUrgent = priority === 'urgent';
    const isNowPublished = announcement.isActive && new Date(announcement.publishDate) <= new Date();
    
    if (isNowUrgent && isNowPublished && (!wasUrgent || !wasPublished)) {
      try {
        const users = await User.findAll({
          where: { isActive: true },
          attributes: ['email', 'firstName', 'lastName']
        });

        await sendUrgentAnnouncementEmail(users, announcement);
      } catch (emailError) {
        console.error('Error sending urgent announcement emails:', emailError);
      }
    }

    const updatedAnnouncement = await Announcement.findByPk(announcement.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }]
    });

    res.json(updatedAnnouncement);
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/announcements/:id - Delete announcement
router.delete('/:id', authenticateToken, requireRole(['admin', 'hr']), validateAnnouncementId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    await announcement.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/announcements/:id/mark-read - Mark announcement as read
router.post('/:id/mark-read', authenticateToken, validateAnnouncementId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // Check if announcement is active and published
    const isPublished = announcement.isActive && 
      new Date(announcement.publishDate) <= new Date() &&
      new Date(announcement.expirationDate) > new Date();

    if (!isPublished) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const user = await User.findByPk(req.user.id);
    await announcement.addReadByUser(user);

    res.json({ message: 'Announcement marked as read' });
  } catch (error) {
    // If already marked as read, ignore the error
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.json({ message: 'Announcement already marked as read' });
    }
    
    console.error('Error marking announcement as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/announcements/:id/mark-read - Mark announcement as unread
router.delete('/:id/mark-read', authenticateToken, validateAnnouncementId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const user = await User.findByPk(req.user.id);
    await announcement.removeReadByUser(user);

    res.json({ message: 'Announcement marked as unread' });
  } catch (error) {
    console.error('Error marking announcement as unread:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/announcements/:id/stats - Get announcement read statistics (admin only)
router.get('/:id/stats', authenticateToken, requireRole(['admin', 'hr']), validateAnnouncementId, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const totalUsers = await User.count({ where: { isActive: true } });
    const readUsers = await announcement.countReadByUsers();
    const unreadCount = totalUsers - readUsers;

    const readUsersList = await announcement.getReadByUsers({
      attributes: ['id', 'firstName', 'lastName', 'email'],
      through: { attributes: ['createdAt'] }
    });

    res.json({
      announcementId: announcement.id,
      totalUsers,
      readCount: readUsers,
      unreadCount,
      readPercentage: totalUsers > 0 ? Math.round((readUsers / totalUsers) * 100) : 0,
      readUsers: readUsersList.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        readAt: user.AnnouncementRead?.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching announcement stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;