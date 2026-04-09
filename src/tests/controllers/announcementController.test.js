const request = require('supertest');
const express = require('express');
const Announcement = require('../../models/Announcement');
const announcementController = require('../../controllers/announcementController');
const { authenticateToken, requireRole } = require('../../middleware/auth');

// Mock dependencies
jest.mock('../../models/Announcement');
jest.mock('../../middleware/auth');

const app = express();
app.use(express.json());
app.use('/api/announcements', require('../../routes/announcements'));

// Mock authentication middleware
authenticateToken.mockImplementation((req, res, next) => {
  req.user = { id: 1, role: 'admin', name: 'Admin User' };
  next();
});

requireRole.mockImplementation((role) => (req, res, next) => {
  if (req.user.role === role || req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied' });
  }
});

describe('Announcement Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/announcements - Published Announcements', () => {
    it('should return published announcements for all authenticated users', async () => {
      const mockAnnouncements = [
        {
          id: 1,
          title: 'Company Update',
          content: 'Important company announcement',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          title: 'Holiday Schedule',
          content: 'Upcoming holiday information',
          created_at: new Date(Date.now() - 86400000).toISOString()
        }
      ];

      Announcement.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue(mockAnnouncements)
          })
        })
      });

      const response = await request(app)
        .get('/api/announcements')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].title).toBe('Company Update');
      expect(Announcement.find).toHaveBeenCalledWith({ isPublished: true });
    });

    it('should limit announcements to 5 items maximum', async () => {
      const mockAnnouncements = Array.from({ length: 7 }, (_, i) => ({
        id: i + 1,
        title: `Announcement ${i + 1}`,
        content: `Content ${i + 1}`,
        created_at: new Date(Date.now() - i * 86400000).toISOString()
      }));

      Announcement.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue(mockAnnouncements.slice(0, 5))
          })
        })
      });

      const response = await request(app)
        .get('/api/announcements')
        .expect(200);

      expect(response.body.data).toHaveLength(5);
    });

    it('should return announcements in reverse chronological order', async () => {
      const mockAnnouncements = [
        {
          id: 2,
          title: 'Newer Announcement',
          content: 'More recent content',
          created_at: new Date().toISOString()
        },
        {
          id: 1,
          title: 'Older Announcement',
          content: 'Older content',
          created_at: new Date(Date.now() - 86400000).toISOString()
        }
      ];

      Announcement.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue(mockAnnouncements)
          })
        })
      });

      const response = await request(app)
        .get('/api/announcements')
        .expect(200);

      expect(response.body.data[0].title).toBe('Newer Announcement');
      expect(response.body.data[1].title).toBe('Older Announcement');
    });

    it('should handle API errors gracefully', async () => {
      Announcement.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      });

      const response = await request(app)
        .get('/api/announcements')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error fetching announcements');
    });
  });

  describe('POST /api/announcements - Create Announcement', () => {
    beforeEach(() => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 1, role: 'admin', name: 'Admin User' };
        next();
      });
    });

    it('should create announcement when admin provides valid data', async () => {
      const newAnnouncement = {
        title: 'New Company Policy',
        content: 'Details about the new policy',
        isPublished: true
      };

      const savedAnnouncement = {
        id: 1,
        ...newAnnouncement,
        created_at: new Date().toISOString(),
        createdBy: 1
      };

      Announcement.prototype.save = jest.fn().mockResolvedValue(savedAnnouncement);

      const response = await request(app)
        .post('/api/announcements')
        .send(newAnnouncement)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(newAnnouncement.title);
    });

    it('should return validation error when title is missing', async () => {
      const invalidData = {
        content: 'Content without title',
        isPublished: true
      };

      const response = await request(app)
        .post('/api/announcements')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Title is required');
    });

    it('should return validation error when content is missing', async () => {
      const invalidData = {
        title: 'Title without content',
        isPublished: true
      };

      const response = await request(app)
        .post('/api/announcements')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Content is required');
    });

    it('should return validation error when both title and content are missing', async () => {
      const invalidData = {
        isPublished: true
      };

      const response = await request(app)
        .post('/api/announcements')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Title is required');
      expect(response.body.errors).toContain('Content is required');
    });

    it('should deny access to non-admin users', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 2, role: 'employee', name: 'Employee User' };
        next();
      });

      const announcementData = {
        title: 'Test Announcement',
        content: 'Test content'
      };

      const response = await request(app)
        .post('/api/announcements')
        .send(announcementData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. Admin privileges required.');
    });
  });

  describe('PUT /api/announcements/:id - Update Announcement', () => {
    it('should update announcement when admin provides valid data', async () => {
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content',
        isPublished: false
      };

      const updatedAnnouncement = {
        id: 1,
        ...updateData,
        updated_at: new Date().toISOString()
      };

      Announcement.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedAnnouncement);

      const response = await request(app)
        .put('/api/announcements/1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
    });

    it('should handle announcement not found error', async () => {
      Announcement.findByIdAndUpdate = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .put('/api/announcements/999')
        .send({ title: 'Test', content: 'Test' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Announcement not found');
    });
  });

  describe('DELETE /api/announcements/:id - Delete Announcement', () => {
    it('should delete announcement when admin provides valid ID', async () => {
      Announcement.findByIdAndDelete = jest.fn().mockResolvedValue({ id: 1 });

      const response = await request(app)
        .delete('/api/announcements/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Announcement deleted successfully');
    });

    it('should handle delete of non-existent announcement', async () => {
      Announcement.findByIdAndDelete = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/announcements/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Announcement not found');
    });
  });
});