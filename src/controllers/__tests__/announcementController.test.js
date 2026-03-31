const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Announcement = require('../../models/Announcement');
const User = require('../../models/User');
const emailService = require('../../services/emailService');
const announcementController = require('../announcementController');
const { requireAuth, requireRole } = require('../../middleware/auth');

// Mock dependencies
jest.mock('../../models/Announcement');
jest.mock('../../models/User');
jest.mock('../../services/emailService');
jest.mock('../../utils/logger');

const app = express();
app.use(express.json());

// Mock middleware
const mockAuth = (req, res, next) => {
  req.user = { id: 'admin123', role: 'admin', email: 'admin@company.com' };
  next();
};

const mockRequireRole = (role) => (req, res, next) => {
  if (req.user.role !== role) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  next();
};

app.get('/announcements', mockAuth, announcementController.getActiveAnnouncements);
app.get('/announcements/manage', mockAuth, mockRequireRole('admin'), announcementController.getAllAnnouncements);
app.post('/announcements', mockAuth, mockRequireRole('admin'), announcementController.createAnnouncement);
app.delete('/announcements/:id', mockAuth, mockRequireRole('admin'), announcementController.deleteAnnouncement);

describe('Announcement Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /announcements - getActiveAnnouncements', () => {
    it('should return active announcements for authenticated users', async () => {
      // Test Case 3: Dashboard view for authenticated users
      const mockAnnouncements = [
        {
          _id: 'ann1',
          title: 'Company Holiday',
          content: 'Office will be closed tomorrow',
          createdAt: new Date(),
          isActive: true,
          createdBy: { firstName: 'John', lastName: 'Admin' }
        },
        {
          _id: 'ann2',
          title: 'Team Meeting',
          content: 'All-hands meeting at 2 PM',
          createdAt: new Date(),
          isActive: true,
          createdBy: { firstName: 'Jane', lastName: 'Manager' }
        }
      ];

      Announcement.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockAnnouncements)
        })
      });

      const response = await request(app)
        .get('/announcements')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].title).toBe('Company Holiday');
      expect(Announcement.find).toHaveBeenCalledWith({ isActive: true });
    });

    it('should handle database errors gracefully', async () => {
      Announcement.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      const response = await request(app)
        .get('/announcements')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch announcements');
    });
  });

  describe('GET /announcements/manage - getAllAnnouncements', () => {
    it('should return all announcements for admin users', async () => {
      // Test Case 1: Admin management view
      const mockAnnouncements = [
        {
          _id: 'ann1',
          title: 'Active Announcement',
          content: 'This is active',
          createdAt: new Date(),
          isActive: true,
          createdBy: { firstName: 'John', lastName: 'Admin', email: 'admin@company.com' }
        },
        {
          _id: 'ann2',
          title: 'Inactive Announcement',
          content: 'This is inactive',
          createdAt: new Date(),
          isActive: false,
          createdBy: { firstName: 'John', lastName: 'Admin', email: 'admin@company.com' }
        }
      ];

      Announcement.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockAnnouncements)
        })
      });

      const response = await request(app)
        .get('/announcements/manage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(Announcement.find).toHaveBeenCalledWith({});
    });

    it('should deny access to non-admin users', async () => {
      const nonAdminApp = express();
      nonAdminApp.use(express.json());
      
      const mockNonAdminAuth = (req, res, next) => {
        req.user = { id: 'user123', role: 'employee', email: 'user@company.com' };
        next();
      };

      nonAdminApp.get('/announcements/manage', mockNonAdminAuth, mockRequireRole('admin'), announcementController.getAllAnnouncements);

      const response = await request(nonAdminApp)
        .get('/announcements/manage')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });
  });

  describe('POST /announcements - createAnnouncement', () => {
    it('should create announcement and send emails successfully', async () => {
      // Test Case 2: Create announcement with email delivery
      const newAnnouncementData = {
        title: 'New Company Policy',
        content: 'Please review the updated handbook'
      };

      const mockActiveUsers = [
        { _id: 'user1', email: 'employee1@company.com', status: 'active' },
        { _id: 'user2', email: 'employee2@company.com', status: 'active' }
      ];

      const savedAnnouncement = {
        _id: 'ann123',
        ...newAnnouncementData,
        createdBy: 'admin123',
        isActive: true,
        emailSent: true,
        recipientCount: 2,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue({
          ...newAnnouncementData,
          createdBy: { firstName: 'John', lastName: 'Admin' }
        }),
        markEmailSent: jest.fn()
      };

      Announcement.mockImplementation(() => savedAnnouncement);
      User.find = jest.fn().mockResolvedValue(mockActiveUsers);
      emailService.sendAnnouncementEmail = jest.fn().mockResolvedValue({ messageId: 'msg123' });

      const response = await request(app)
        .post('/announcements')
        .send(newAnnouncementData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(newAnnouncementData.title);
      expect(savedAnnouncement.save).toHaveBeenCalled();
      expect(User.find).toHaveBeenCalledWith({ status: 'active' });
      expect(emailService.sendAnnouncementEmail).toHaveBeenCalledWith(expect.objectContaining(savedAnnouncement), mockActiveUsers);
    });

    it('should create announcement even when email sending fails', async () => {
      // Test Case 6: Email failure handling
      const newAnnouncementData = {
        title: 'Important Notice',
        content: 'This is important information'
      };

      const mockActiveUsers = [
        { _id: 'user1', email: 'employee1@company.com', status: 'active' }
      ];

      const savedAnnouncement = {
        _id: 'ann123',
        ...newAnnouncementData,
        createdBy: 'admin123',
        isActive: true,
        emailSent: false,
        emailFailure: true,
        emailFailureReason: 'SMTP connection failed',
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue({
          ...newAnnouncementData,
          createdBy: { firstName: 'John', lastName: 'Admin' }
        }),
        markEmailFailure: jest.fn()
      };

      Announcement.mockImplementation(() => savedAnnouncement);
      User.find = jest.fn().mockResolvedValue(mockActiveUsers);
      emailService.sendAnnouncementEmail = jest.fn().mockRejectedValue(new Error('SMTP connection failed'));

      const response = await request(app)
        .post('/announcements')
        .send(newAnnouncementData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.emailWarning).toBe(true);
      expect(response.body.message).toContain('email delivery failed');
      expect(savedAnnouncement.save).toHaveBeenCalled();
      expect(savedAnnouncement.markEmailFailure).toHaveBeenCalledWith('SMTP connection failed');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/announcements')
        .send({ title: '', content: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Title and content are required');
    });

    it('should handle announcement save errors', async () => {
      const newAnnouncementData = {
        title: 'Test Announcement',
        content: 'Test content'
      };

      const failingAnnouncement = {
        save: jest.fn().mockRejectedValue(new Error('Database save failed'))
      };

      Announcement.mockImplementation(() => failingAnnouncement);

      const response = await request(app)
        .post('/announcements')
        .send(newAnnouncementData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to create announcement');
    });
  });

  describe('DELETE /announcements/:id - deleteAnnouncement', () => {
    it('should delete announcement successfully', async () => {
      // Test Case 5: Delete announcement
      const mockAnnouncement = {
        _id: 'ann123',
        title: 'Test Announcement',
        isActive: true
      };

      Announcement.findById = jest.fn().mockResolvedValue(mockAnnouncement);
      Announcement.findByIdAndUpdate = jest.fn().mockResolvedValue({
        ...mockAnnouncement,
        isActive: false
      });

      const response = await request(app)
        .delete('/announcements/ann123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Announcement deleted successfully');
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'ann123',
        { isActive: false },
        { new: true }
      );
    });

    it('should handle non-existent announcement deletion', async () => {
      Announcement.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .delete('/announcements/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Announcement not found');
    });

    it('should handle database errors during deletion', async () => {
      Announcement.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/announcements/ann123')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to delete announcement');
    });
  });
});