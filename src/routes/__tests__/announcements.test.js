const request = require('supertest');
const express = require('express');
const db = require('../../config/database');
const emailService = require('../../services/emailService');
const announcementRoutes = require('../announcements');
const { requireAuth, requireRole } = require('../../middleware/auth');

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../services/emailService');
jest.mock('../../utils/logger');

const app = express();
app.use(express.json());

// Mock authentication middleware
const mockAuth = (req, res, next) => {
  req.user = {
    id: 1,
    email: 'admin@company.com',
    role: 'admin',
    firstName: 'John',
    lastName: 'Admin'
  };
  next();
};

const mockEmployeeAuth = (req, res, next) => {
  req.user = {
    id: 2,
    email: 'employee@company.com',
    role: 'employee',
    firstName: 'Jane',
    lastName: 'Employee'
  };
  next();
};

app.use('/announcements', announcementRoutes);

// Override middleware for testing
jest.mock('../../middleware/auth', () => ({
  requireAuth: jest.fn((req, res, next) => next()),
  requireRole: jest.fn(() => (req, res, next) => next())
}));

describe('Announcements Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /announcements', () => {
    it('should return active announcements for authenticated users', async () => {
      // Test Case 3: Dashboard announcements view
      const mockRows = [
        {
          id: 1,
          title: 'Company Update',
          content: 'Important company news',
          created_at: new Date(),
          created_by: 1,
          first_name: 'John',
          last_name: 'Admin'
        },
        {
          id: 2,
          title: 'Holiday Notice',
          content: 'Office closed tomorrow',
          created_at: new Date(),
          created_by: 1,
          first_name: 'John',
          last_name: 'Admin'
        }
      ];

      db.query = jest.fn().mockResolvedValue({ rows: mockRows });

      // Override auth middleware to simulate authenticated user
      requireAuth.mockImplementation(mockAuth);

      const response = await request(app)
        .get('/announcements')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].title).toBe('Company Update');
      expect(response.body.data[0].createdBy.name).toBe('John Admin');
      
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE a.is_active = true'));
    });

    it('should handle database query errors', async () => {
      db.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      requireAuth.mockImplementation(mockAuth);

      const response = await request(app)
        .get('/announcements')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch announcements');
    });
  });

  describe('GET /announcements/manage', () => {
    it('should return all announcements for admin users', async () => {
      // Test Case 1: Admin management interface
      const mockRows = [
        {
          id: 1,
          title: 'Active Announcement',
          content: 'This is active',
          created_at: new Date(),
          created_by: 1,
          is_active: true,
          first_name: 'John',
          last_name: 'Admin'
        },
        {
          id: 2,
          title: 'Deleted Announcement',
          content: 'This was deleted',
          created_at: new Date(),
          created_by: 1,
          is_active: false,
          first_name: 'John',
          last_name: 'Admin'
        }
      ];

      db.query = jest.fn().mockResolvedValue({ rows: mockRows });
      requireAuth.mockImplementation(mockAuth);
      requireRole.mockImplementation(() => mockAuth);

      const response = await request(app)
        .get('/announcements/manage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].isActive).toBe(true);
      expect(response.body.data[1].isActive).toBe(false);
    });

    it('should deny access to non-admin users', async () => {
      requireAuth.mockImplementation(mockEmployeeAuth);
      requireRole.mockImplementation((role) => (req, res, next) => {
        if (req.user.role !== role) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
        next();
      });

      const response = await request(app)
        .get('/announcements/manage')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });
  });

  describe('POST /announcements', () => {
    it('should create announcement and send emails to all active employees', async () => {
      // Test Case 2: Create announcement with email delivery
      const newAnnouncement = {
        title: 'Emergency Meeting',
        content: 'All staff meeting at 3 PM today'
      };

      const mockInsertResult = {
        rows: [{
          id: 3,
          title: 'Emergency Meeting',
          content: 'All staff meeting at 3 PM today',
          created_by: 1,
          created_at: new Date(),
          is_active: true
        }]
      };

      const mockActiveUsers = {
        rows: [
          { id: 2, email: 'employee1@company.com', first_name: 'Jane', last_name: 'Employee' },
          { id: 3, email: 'employee2@company.com', first_name: 'Bob', last_name: 'Worker' }
        ]
      };

      db.query = jest.fn()
        .mockResolvedValueOnce(mockInsertResult) // INSERT announcement
        .mockResolvedValueOnce(mockActiveUsers) // SELECT active users
        .mockResolvedValueOnce({ rows: [] }); // UPDATE email_sent status

      emailService.sendAnnouncementEmail = jest.fn().mockResolvedValue({
        messageId: 'email-123',
        accepted: ['employee1@company.com', 'employee2@company.com']
      });

      requireAuth.mockImplementation(mockAuth);
      requireRole.mockImplementation(() => mockAuth);

      const response = await request(app)
        .post('/announcements')
        .send(newAnnouncement)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('created and sent successfully');
      expect(response.body.data.title).toBe(newAnnouncement.title);
      
      // Verify announcement was inserted
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO announcements'),
        expect.arrayContaining([newAnnouncement.title, newAnnouncement.content, 1])
      );
      
      // Verify email was sent
      expect(emailService.sendAnnouncementEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Emergency Meeting',
          content: 'All staff meeting at 3 PM today'
        }),
        expect.arrayContaining([
          expect.objectContaining({ email: 'employee1@company.com' })
        ])
      );
    });

    it('should create announcement even when email sending fails', async () => {
      // Test Case 6: Email failure but announcement creation succeeds
      const newAnnouncement = {
        title: 'System Maintenance',
        content: 'Scheduled maintenance tonight'
      };

      const mockInsertResult = {
        rows: [{
          id: 4,
          title: 'System Maintenance',
          content: 'Scheduled maintenance tonight',
          created_by: 1,
          created_at: new Date(),
          is_active: true
        }]
      };

      const mockActiveUsers = {
        rows: [
          { id: 2, email: 'employee1@company.com', first_name: 'Jane', last_name: 'Employee' }
        ]
      };

      db.query = jest.fn()
        .mockResolvedValueOnce(mockInsertResult) // INSERT announcement
        .mockResolvedValueOnce(mockActiveUsers) // SELECT active users
        .mockResolvedValueOnce({ rows: [] }); // UPDATE email_error

      emailService.sendAnnouncementEmail = jest.fn()
        .mockRejectedValue(new Error('SMTP server unavailable'));

      requireAuth.mockImplementation(mockAuth);
      requireRole.mockImplementation(() => mockAuth);

      const response = await request(app)
        .post('/announcements')
        .send(newAnnouncement)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.emailWarning).toBe(true);
      expect(response.body.message).toContain('email delivery failed');
      
      // Verify error was logged in database
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE announcements SET email_error'),
        expect.arrayContaining([expect.stringContaining('SMTP server unavailable'), 4])
      );
    });

    it('should validate required fields', async () => {
      requireAuth.mockImplementation(mockAuth);
      requireRole.mockImplementation(() => mockAuth);

      const response = await request(app)
        .post('/announcements')
        .send({ title: '', content: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Title and content are required');
    });

    it('should handle database insertion errors', async () => {
      const newAnnouncement = {
        title: 'Test Announcement',
        content: 'Test content'
      };

      db.query = jest.fn().mockRejectedValue(new Error('Database insertion failed'));
      requireAuth.mockImplementation(mockAuth);
      requireRole.mockImplementation(() => mockAuth);

      const response = await request(app)
        .post('/announcements')
        .send(newAnnouncement)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to create announcement');
    });
  });

  describe('DELETE /announcements/:id', () => {
    it('should delete announcement successfully', async () => {
      // Test Case 5: Delete announcement
      const mockDeleteResult = {
        rows: [{
          id: 1,
          title: 'Deleted Announcement',
          is_active: false
        }]
      };

      db.query = jest.fn().mockResolvedValue(mockDeleteResult);
      requireAuth.mockImplementation(mockAuth);
      requireRole.mockImplementation(() => mockAuth);

      const response = await request(app)
        .delete('/announcements/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Announcement deleted successfully');
      
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE announcements SET is_active = false'),
        [1]
      );
    });

    it('should handle non-existent announcement', async () => {
      db.query = jest.fn().mockResolvedValue({ rows: [] });
      requireAuth.mockImplementation(mockAuth);
      requireRole.mockImplementation(() => mockAuth);

      const response = await request(app)
        .delete('/announcements/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Announcement not found');
    });

    it('should handle database deletion errors', async () => {
      db.query = jest.fn().mockRejectedValue(new Error('Database deletion failed'));
      requireAuth.mockImplementation(mockAuth);
      requireRole.mockImplementation(() => mockAuth);

      const response = await request(app)
        .delete('/announcements/1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to delete announcement');
    });
  });
});