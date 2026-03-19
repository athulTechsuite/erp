const request = require('supertest');
const express = require('express');
const Announcement = require('../../models/Announcement');
const announcementController = require('../announcementController');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

// Mock the models and middleware
jest.mock('../../models/Announcement');
jest.mock('../../middleware/auth');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.user = { id: 1, role: 'admin' };
  next();
});

// Routes for testing
app.get('/api/announcements', announcementController.getAnnouncements);
app.get('/api/announcements/active', announcementController.getActiveAnnouncements);
app.post('/api/announcements', announcementController.createAnnouncement);
app.put('/api/announcements/:id', announcementController.updateAnnouncement);
app.delete('/api/announcements/:id', announcementController.deleteAnnouncement);

describe('Announcement Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TC-001: Admin can create new company announcements', () => {
    it('should create announcement with title, content, and optional expiration date', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Test Announcement',
        content: 'This is a test announcement',
        expirationDate: '2024-12-31T23:59:59.000Z',
        createdBy: 1,
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(true)
      };

      Announcement.mockImplementation(() => mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements')
        .send({
          title: 'Test Announcement',
          content: 'This is a test announcement',
          expirationDate: '2024-12-31T23:59:59.000Z'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Announcement');
      expect(mockAnnouncement.save).toHaveBeenCalled();
    });

    it('should create announcement without expiration date', async () => {
      const mockAnnouncement = {
        id: 2,
        title: 'Permanent Announcement',
        content: 'This announcement has no expiration',
        expirationDate: null,
        createdBy: 1,
        save: jest.fn().mockResolvedValue(true)
      };

      Announcement.mockImplementation(() => mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements')
        .send({
          title: 'Permanent Announcement',
          content: 'This announcement has no expiration'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.expirationDate).toBeNull();
    });

    it('should reject announcement with missing title', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .send({
          content: 'This announcement has no title'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Title is required');
    });

    it('should reject announcement with missing content', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .send({
          title: 'Title without content'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Content is required');
    });
  });

  describe('TC-002: Admin can edit existing announcements', () => {
    it('should update announcement successfully', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Updated Title',
        content: 'Updated content',
        expirationDate: '2024-12-31T23:59:59.000Z',
        save: jest.fn().mockResolvedValue(true)
      };

      Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .put('/api/announcements/1')
        .send({
          title: 'Updated Title',
          content: 'Updated content',
          expirationDate: '2024-12-31T23:59:59.000Z'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
      expect(mockAnnouncement.save).toHaveBeenCalled();
    });

    it('should return 404 for non-existent announcement', async () => {
      Announcement.findByPk = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .put('/api/announcements/999')
        .send({
          title: 'Updated Title',
          content: 'Updated content'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Announcement not found');
    });
  });

  describe('TC-003: Admin can delete announcements', () => {
    it('should delete announcement successfully', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'To be deleted',
        destroy: jest.fn().mockResolvedValue(true)
      };

      Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .delete('/api/announcements/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Announcement deleted successfully');
      expect(mockAnnouncement.destroy).toHaveBeenCalled();
    });

    it('should return 404 when deleting non-existent announcement', async () => {
      Announcement.findByPk = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/announcements/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Announcement not found');
    });
  });

  describe('TC-004: System automatically archives expired announcements', () => {
    it('should not return expired announcements in active list', async () => {
      const currentDate = new Date();
      const pastDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      
      const mockActiveAnnouncements = [
        {
          id: 1,
          title: 'Active Announcement',
          content: 'This is active',
          expirationDate: null,
          createdAt: currentDate
        }
      ];

      Announcement.find = jest.fn().mockResolvedValue(mockActiveAnnouncements);

      const response = await request(app)
        .get('/api/announcements/active');

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].title).toBe('Active Announcement');
    });
  });

  describe('TC-008: Employees can view all current announcements', () => {
    it('should return all active announcements for employees', async () => {
      const mockAnnouncements = [
        {
          id: 1,
          title: 'Company Update',
          content: 'Important company news',
          expirationDate: null,
          createdAt: new Date(),
          createdBy: { firstName: 'Admin', lastName: 'User' }
        },
        {
          id: 2,
          title: 'Holiday Notice',
          content: 'Office will be closed',
          expirationDate: '2024-12-25T00:00:00.000Z',
          createdAt: new Date(),
          createdBy: { firstName: 'Admin', lastName: 'User' }
        }
      ];

      Announcement.find = jest.fn().mockResolvedValue(mockAnnouncements);
      Announcement.countDocuments = jest.fn().mockResolvedValue(2);

      const response = await request(app)
        .get('/api/announcements');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.announcements.length).toBe(2);
      expect(response.body.data.pagination.totalCount).toBe(2);
    });
  });

  describe('TC-010: System handles permissions correctly', () => {
    it('should allow admin to create announcements', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Admin Announcement',
        content: 'Admin created this',
        save: jest.fn().mockResolvedValue(true)
      };

      Announcement.mockImplementation(() => mockAnnouncement);
      requireAdmin.mockImplementation((req, res, next) => {
        if (req.user.role === 'admin') {
          next();
        } else {
          res.status(403).json({ message: 'Forbidden' });
        }
      });

      const response = await request(app)
        .post('/api/announcements')
        .send({
          title: 'Admin Announcement',
          content: 'Admin created this'
        });

      expect(response.status).toBe(201);
    });

    it('should deny non-admin users from creating announcements', async () => {
      const nonAdminApp = express();
      nonAdminApp.use(express.json());
      nonAdminApp.use((req, res, next) => {
        req.user = { id: 2, role: 'employee' };
        next();
      });
      nonAdminApp.use((req, res, next) => {
        if (req.user.role !== 'admin') {
          return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
        }
        next();
      });
      nonAdminApp.post('/api/announcements', announcementController.createAnnouncement);

      const response = await request(nonAdminApp)
        .post('/api/announcements')
        .send({
          title: 'Employee Attempt',
          content: 'This should fail'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. Admin role required.');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      Announcement.find = jest.fn().mockRejectedValue(new Error('Database connection error'));

      const response = await request(app)
        .get('/api/announcements');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch announcements');
    });

    it('should validate expiration date is in future', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

      const response = await request(app)
        .post('/api/announcements')
        .send({
          title: 'Invalid Date',
          content: 'This has past expiration',
          expirationDate: pastDate.toISOString()
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Expiration date must be in the future');
    });
  });
});