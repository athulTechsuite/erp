const announcementController = require('../../../src/controllers/announcementController');
const Announcement = require('../../../src/models/Announcement');
const { validationResult } = require('express-validator');

// Mock dependencies
jest.mock('../../../src/models/Announcement');
jest.mock('express-validator');

describe('AnnouncementController Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: {
        _id: 'admin123',
        role: 'admin',
        firstName: 'Admin',
        lastName: 'User'
      }
    };

    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getAnnouncements', () => {
    it('should return all active announcements successfully', async () => {
      const mockAnnouncements = [
        {
          _id: '1',
          title: 'Test Announcement 1',
          content: 'Content 1',
          status: 'active',
          author: { firstName: 'Admin', lastName: 'User' }
        },
        {
          _id: '2',
          title: 'Test Announcement 2',
          content: 'Content 2',
          status: 'active',
          author: { firstName: 'Admin', lastName: 'User' }
        }
      ];

      const mockFind = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockAnnouncements)
      };

      Announcement.find.mockReturnValue(mockFind);

      await announcementController.getAnnouncements(req, res);

      expect(Announcement.find).toHaveBeenCalledWith({ status: 'active' });
      expect(mockFind.populate).toHaveBeenCalledWith('author', 'firstName lastName');
      expect(mockFind.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnnouncements
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockFind = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      Announcement.find.mockReturnValue(mockFind);
      console.error = jest.fn(); // Mock console.error

      await announcementController.getAnnouncements(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch announcements'
      });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('createAnnouncement', () => {
    beforeEach(() => {
      req.body = {
        title: 'New Announcement',
        content: 'New announcement content'
      };
    });

    it('should create announcement successfully for admin user', async () => {
      const mockSavedAnnouncement = {
        _id: 'new123',
        title: 'New Announcement',
        content: 'New announcement content',
        author: 'admin123',
        status: 'active',
        populate: jest.fn().mockResolvedValue({
          _id: 'new123',
          title: 'New Announcement',
          content: 'New announcement content',
          author: { firstName: 'Admin', lastName: 'User' },
          status: 'active'
        })
      };

      validationResult.mockReturnValue({ isEmpty: () => true });
      Announcement.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockSavedAnnouncement),
        populate: jest.fn().mockResolvedValue(mockSavedAnnouncement)
      }));

      await announcementController.createAnnouncement(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should reject non-admin users', async () => {
      req.user.role = 'employee';
      validationResult.mockReturnValue({ isEmpty: () => true });

      await announcementController.createAnnouncement(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    });

    it('should return validation errors when validation fails', async () => {
      const mockErrors = [
        { field: 'title', msg: 'Title is required' }
      ];

      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => mockErrors
      });

      await announcementController.createAnnouncement(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: mockErrors
      });
    });

    it('should validate required fields', async () => {
      req.body = { title: '', content: '' };
      validationResult.mockReturnValue({ isEmpty: () => true });

      await announcementController.createAnnouncement(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Title and content are required'
      });
    });

    it('should validate non-empty trimmed fields', async () => {
      req.body = { title: '   ', content: '   ' };
      validationResult.mockReturnValue({ isEmpty: () => true });

      await announcementController.createAnnouncement(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Title and content cannot be empty'
      });
    });

    it('should handle database save errors', async () => {
      validationResult.mockReturnValue({ isEmpty: () => true });
      Announcement.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('Save failed')),
        populate: jest.fn()
      }));

      console.error = jest.fn();

      await announcementController.createAnnouncement(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(console.error).toHaveBeenCalled();
    });

    it('should trim whitespace from title and content', async () => {
      req.body = {
        title: '  Trimmed Title  ',
        content: '  Trimmed Content  '
      };

      const mockConstructor = jest.fn();
      validationResult.mockReturnValue({ isEmpty: () => true });
      Announcement.mockImplementation(mockConstructor);
      mockConstructor.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue({}),
        populate: jest.fn().mockResolvedValue({})
      }));

      await announcementController.createAnnouncement(req, res);

      expect(mockConstructor).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Trimmed Title',
        content: 'Trimmed Content'
      }));
    });

    it('should set correct author and status', async () => {
      validationResult.mockReturnValue({ isEmpty: () => true });
      const mockConstructor = jest.fn();
      Announcement.mockImplementation(mockConstructor);
      mockConstructor.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue({}),
        populate: jest.fn().mockResolvedValue({})
      }));

      await announcementController.createAnnouncement(req, res);

      expect(mockConstructor).toHaveBeenCalledWith(expect.objectContaining({
        author: 'admin123',
        status: 'active'
      }));
    });

    it('should populate author information in response', async () => {
      const mockSavedAnnouncement = {
        _id: 'new123',
        title: 'New Announcement',
        content: 'New announcement content',
        populate: jest.fn().mockResolvedValue({
          _id: 'new123',
          title: 'New Announcement',
          author: { firstName: 'Admin', lastName: 'User' }
        })
      };

      validationResult.mockReturnValue({ isEmpty: () => true });
      Announcement.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockSavedAnnouncement)
      }));

      await announcementController.createAnnouncement(req, res);

      expect(mockSavedAnnouncement.populate).toHaveBeenCalledWith('author', 'firstName lastName');
    });
  });

  describe('Manager Role Access Control', () => {
    it('should reject manager users from creating announcements', async () => {
      req.user.role = 'manager';
      validationResult.mockReturnValue({ isEmpty: () => true });

      await announcementController.createAnnouncement(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    });

    it('should reject employee users from creating announcements', async () => {
      req.user.role = 'employee';
      validationResult.mockReturnValue({ isEmpty: () => true });

      await announcementController.createAnnouncement(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    });

    it('should reject users with undefined role', async () => {
      req.user.role = undefined;
      validationResult.mockReturnValue({ isEmpty: () => true });

      await announcementController.createAnnouncement(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing user object', async () => {
      req.user = null;
      validationResult.mockReturnValue({ isEmpty: () => true });

      await expect(announcementController.createAnnouncement(req, res))
        .rejects.toThrow();
    });

    it('should handle missing request body', async () => {
      req.body = null;
      validationResult.mockReturnValue({ isEmpty: () => true });

      await expect(announcementController.createAnnouncement(req, res))
        .rejects.toThrow();
    });

    it('should handle very long valid content', async () => {
      req.body = {
        title: 'Valid Title',
        content: 'A'.repeat(4999) // Just under the 5000 character limit
      };

      validationResult.mockReturnValue({ isEmpty: () => true });
      Announcement.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue({}),
        populate: jest.fn().mockResolvedValue({})
      }));

      await announcementController.createAnnouncement(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});