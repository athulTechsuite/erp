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
app.get('/api/announcements/archived', announcementController.getArchivedAnnouncements);
app.post('/api/announcements', announcementController.createAnnouncement);
app.post('/api/announcements/:id/archive', announcementController.archiveAnnouncement);
app.post('/api/announcements/:id/unarchive', announcementController.unarchiveAnnouncement);
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

    it('should reject announcement with empty title', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .send({
          title: '   ',
          content: 'Valid content'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Title cannot be empty');
    });

    it('should reject announcement with extremely long title', async () => {
      const longTitle = 'A'.repeat(501);
      const response = await request(app)
        .post('/api/announcements')
        .send({
          title: longTitle,
          content: 'Valid content'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Title must be less than 500 characters');
    });

    it('should handle creation with special characters in content', async () => {
      const mockAnnouncement = {
        id: 3,
        title: 'Special Characters Test',
        content: 'Content with émojis 🎉 and special chars: <>&"\'',
        save: jest.fn().mockResolvedValue(true)
      };

      Announcement.mockImplementation(() => mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements')
        .send({
          title: 'Special Characters Test',
          content: 'Content with émojis 🎉 and special chars: <>&"\''
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
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

    it('should handle partial updates', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Original Title',
        content: 'Updated content only',
        expirationDate: null,
        save: jest.fn().mockResolvedValue(true)
      };

      Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .put('/api/announcements/1')
        .send({
          content: 'Updated content only'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAnnouncement.content).toBe('Updated content only');
    });

    it('should validate updated expiration date is in future', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Test',
        content: 'Test'
      };

      Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const response = await request(app)
        .put('/api/announcements/1')
        .send({
          expirationDate: pastDate.toISOString()
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Expiration date must be in the future');
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

    it('should handle database errors during deletion', async () => {
      const mockAnnouncement = {
        id: 1,
        destroy: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .delete('/api/announcements/1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to delete announcement');
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

    it('should automatically archive announcements that have expired', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const mockExpiredAnnouncement = {
        id: 1,
        title: 'Expired Announcement',
        content: 'This has expired',
        expirationDate: expiredDate,
        isArchived: false,
        save: jest.fn().mockResolvedValue(true)
      };

      Announcement.findAll = jest.fn().mockResolvedValue([mockExpiredAnnouncement]);

      // Simulate the archive process
      const response = await request(app)
        .post('/api/announcements/1/archive');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Announcement archived successfully');
    });

    it('should identify announcements expiring today', async () => {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today

      const mockExpiringAnnouncement = {
        id: 2,
        title: 'Expiring Today',
        content: 'This expires today',
        expirationDate: today,
        isArchived: false
      };

      // Mock finding announcements expiring today
      Announcement.findAll = jest.fn().mockImplementation((query) => {
        if (query.where && query.where.expirationDate) {
          return Promise.resolve([mockExpiringAnnouncement]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/announcements/active');

      expect(response.status).toBe(200);
    });

    it('should handle timezone differences in expiration checking', async () => {
      const utcDate = new Date();
      utcDate.setUTCHours(0, 0, 0, 0); // Start of day UTC

      const mockAnnouncement = {
        id: 3,
        title: 'Timezone Test',
        content: 'Testing timezone handling',
        expirationDate: utcDate,
        isArchived: false
      };

      Announcement.findAll = jest.fn().mockResolvedValue([mockAnnouncement]);

      const response = await request(app)
        .get('/api/announcements/active');

      expect(response.status).toBe(200);
    });
  });

  describe('TC-005: Archive and Unarchive Functionality', () => {
    it('should manually archive an announcement', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'To be archived',
        content: 'This will be archived',
        isArchived: false,
        archivedAt: null,
        save: jest.fn().mockImplementation(function() {
          this.isArchived = true;
          this.archivedAt = new Date();
          return Promise.resolve(true);
        })
      };

      Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements/1/archive');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Announcement archived successfully');
      expect(mockAnnouncement.save).toHaveBeenCalled();
    });

    it('should unarchive an announcement', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Archived announcement',
        content: 'This is archived',
        isArchived: true,
        archivedAt: new Date(),
        save: jest.fn().mockImplementation(function() {
          this.isArchived = false;
          this.archivedAt = null;
          return Promise.resolve(true);
        })
      };

      Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements/1/unarchive');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Announcement unarchived successfully');
      expect(mockAnnouncement.save).toHaveBeenCalled();
    });

    it('should return archived announcements separately', async () => {
      const mockArchivedAnnouncements = [
        {
          id: 1,
          title: 'Archived Announcement 1',
          content: 'This is archived',
          isArchived: true,
          archivedAt: new Date()
        },
        {
          id: 2,
          title: 'Archived Announcement 2',
          content: 'This is also archived',
          isArchived: true,
          archivedAt: new Date()
        }
      ];

      Announcement.findAll = jest.fn().mockResolvedValue(mockArchivedAnnouncements);

      const response = await request(app)
        .get('/api/announcements/archived');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data.every(ann => ann.isArchived)).toBe(true);
    });

    it('should prevent archiving already archived announcement', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Already archived',
        isArchived: true,
        archivedAt: new Date()
      };

      Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements/1/archive');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Announcement is already archived');
    });

    it('should prevent unarchiving already active announcement', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Already active',
        isArchived: false,
        archivedAt: null
      };

      Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements/1/unarchive');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Announcement is already active');
    });
  });

  describe('TC-006: Only admins can create/edit/delete announcements', () => {
    describe('Happy path - Admin access granted', () => {
      let adminApp;
      
      beforeEach(() => {
        adminApp = express();
        adminApp.use(express.json());
        adminApp.use((req, res, next) => {
          req.user = { id: 1, role: 'admin' };
          next();
        });
        adminApp.use((req, res, next) => {
          if (req.user.role === 'admin') {
            next();
          } else {
            return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
          }
        });
        adminApp.post('/api/announcements', announcementController.createAnnouncement);
        adminApp.put('/api/announcements/:id', announcementController.updateAnnouncement);
        adminApp.delete('/api/announcements/:id', announcementController.deleteAnnouncement);
      });

      it('should allow admin to create announcements', async () => {
        const mockAnnouncement = {
          id: 1,
          title: 'Admin Announcement',
          content: 'Admin created this',
          createdBy: 1,
          save: jest.fn().mockResolvedValue(true)
        };

        Announcement.mockImplementation(() => mockAnnouncement);

        const response = await request(adminApp)
          .post('/api/announcements')
          .send({
            title: 'Admin Announcement',
            content: 'Admin created this'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Admin Announcement');
      });

      it('should allow admin to edit announcements', async () => {
        const mockAnnouncement = {
          id: 1,
          title: 'Updated by Admin',
          content: 'Admin updated this',
          save: jest.fn().mockResolvedValue(true)
        };

        Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

        const response = await request(adminApp)
          .put('/api/announcements/1')
          .send({
            title: 'Updated by Admin',
            content: 'Admin updated this'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Updated by Admin');
      });

      it('should allow admin to delete announcements', async () => {
        const mockAnnouncement = {
          id: 1,
          title: 'To be deleted by admin',
          destroy: jest.fn().mockResolvedValue(true)
        };

        Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

        const response = await request(adminApp)
          .delete('/api/announcements/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Announcement deleted successfully');
      });
    });

    describe('Error path - Non-admin access denied', () => {
      let nonAdminApp;
      
      beforeEach(() => {
        nonAdminApp = express();
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
        nonAdminApp.put('/api/announcements/:id', announcementController.updateAnnouncement);
        nonAdminApp.delete('/api/announcements/:id', announcementController.deleteAnnouncement);
      });

      it('should deny employee from creating announcements', async () => {
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

      it('should deny employee from editing announcements', async () => {
        const response = await request(nonAdminApp)
          .put('/api/announcements/1')
          .send({
            title: 'Employee Edit Attempt',
            content: 'This should fail'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin role required.');
      });

      it('should deny employee from deleting announcements', async () => {
        const response = await request(nonAdminApp)
          .delete('/api/announcements/1');

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin role required.');
      });

      it('should deny manager from creating announcements', async () => {
        const managerApp = express();
        managerApp.use(express.json());
        managerApp.use((req, res, next) => {
          req.user = { id: 3, role: 'manager' };
          next();
        });
        managerApp.use((req, res, next) => {
          if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
          }
          next();
        });
        managerApp.post('/api/announcements', announcementController.createAnnouncement);

        const response = await request(managerApp)
          .post('/api/announcements')
          .send({
            title: 'Manager Attempt',
            content: 'This should also fail'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin role required.');
      });

      it('should deny user without role from creating announcements', async () => {
        const noRoleApp = express();
        noRoleApp.use(express.json());
        noRoleApp.use((req, res, next) => {
          req.user = { id: 4 }; // No role property
          next();
        });
        noRoleApp.use((req, res, next) => {
          if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
          }
          next();
        });
        noRoleApp.post('/api/announcements', announcementController.createAnnouncement);

        const response = await request(noRoleApp)
          .post('/api/announcements')
          .send({
            title: 'No Role Attempt',
            content: 'This should fail too'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin role required.');
      });

      it('should deny null role from creating announcements', async () => {
        const nullRoleApp = express();
        nullRoleApp.use(express.json());
        nullRoleApp.use((req, res, next) => {
          req.user = { id: 5, role: null };
          next();
        });
        nullRoleApp.use((req, res, next) => {
          if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
          }
          next();
        });
        nullRoleApp.post('/api/announcements', announcementController.createAnnouncement);

        const response = await request(nullRoleApp)
          .post('/api/announcements')
          .send({
            title: 'Null Role Attempt',
            content: 'This should fail'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin role required.');
      });
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

    it('should support pagination for announcement list', async () => {
      const mockAnnouncements = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        title: `Announcement ${i + 1}`,
        content: `Content ${i + 1}`,
        createdAt: new Date()
      }));

      Announcement.find = jest.fn().mockResolvedValue(mockAnnouncements.slice(0, 3));
      Announcement.countDocuments = jest.fn().mockResolvedValue(5);

      const response = await request(app)
        .get('/api/announcements?page=1&limit=3');

      expect(response.status).toBe(200);
      expect(response.body.data.announcements.length).toBe(3);
      expect(response.body.data.pagination.totalCount).toBe(5);
      expect(response.body.data.pagination.currentPage).toBe(1);
    });

    it('should sort announcements by creation date desc by default', async () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-12-01');

      const mockAnnouncements = [
        {
          id: 2,
          title: 'Newer Announcement',
          content: 'This is newer',
          createdAt: newDate
        },
        {
          id: 1,
          title: 'Older Announcement',
          content: 'This is older',
          createdAt: oldDate
        }
      ];

      Announcement.find = jest.fn().mockResolvedValue(mockAnnouncements);
      Announcement.countDocuments = jest.fn().mockResolvedValue(2);

      const response = await request(app)
        .get('/api/announcements');

      expect(response.status).toBe(200);
      expect(response.body.data.announcements[0].title).toBe('Newer Announcement');
      expect(response.body.data.announcements[1].title).toBe('Older Announcement');
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

    it('should allow all authenticated users to view announcements', async () => {
      const employeeApp = express();
      employeeApp.use(express.json());
      employeeApp.use((req, res, next) => {
        req.user = { id: 2, role: 'employee' };
        next();
      });
      employeeApp.get('/api/announcements', announcementController.getAnnouncements);

      const mockAnnouncements = [
        {
          id: 1,
          title: 'Public Announcement',
          content: 'Everyone can see this',
          createdAt: new Date()
        }
      ];

      Announcement.find = jest.fn().mockResolvedValue(mockAnnouncements);
      Announcement.countDocuments = jest.fn().mockResolvedValue(1);

      const response = await request(employeeApp)
        .get('/api/announcements');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.announcements.length).toBe(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
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

    it('should handle malformed expiration date', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .send({
          title: 'Invalid Date Format',
          content: 'This has malformed date',
          expirationDate: 'not-a-date'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Invalid expiration date format');
    });

    it('should handle announcements expiring at exact current moment', async () => {
      const now = new Date();
      const mockAnnouncement = {
        id: 1,
        title: 'Expiring Now',
        content: 'This expires right now',
        expirationDate: now,
        isArchived: false
      };

      Announcement.findAll = jest.fn().mockResolvedValue([mockAnnouncement]);

      const response = await request(app)
        .get('/api/announcements/active');

      expect(response.status).toBe(200);
      // Should handle edge case where announcement expires at exactly the current moment
    });

    it('should handle extremely long content gracefully', async () => {
      const longContent = 'A'.repeat(10000);
      const response = await request(app)
        .post('/api/announcements')
        .send({
          title: 'Long Content Test',
          content: longContent
        });

      // Should either accept it or reject with proper validation
      expect([201, 400]).toContain(response.status);
    });

    it('should handle concurrent archiving operations', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Concurrent Test',
        isArchived: false,
        save: jest.fn().mockImplementation(function() {
          if (this.isArchived) {
            throw new Error('Already archived by another process');
          }
          this.isArchived = true;
          return Promise.resolve(true);
        })
      };

      Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements/1/archive');

      expect(response.status).toBe(200);
    });

    it('should handle missing user context gracefully', async () => {
      const noUserApp = express();
      noUserApp.use(express.json());
      // No user middleware
      noUserApp.post('/api/announcements', announcementController.createAnnouncement);

      const response = await request(noUserApp)
        .post('/api/announcements')
        .send({
          title: 'No User Context',
          content: 'Should handle missing user'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle announcements with null values gracefully', async () => {
      const mockAnnouncement = {
        id: null,
        title: null,
        content: null,
        save: jest.fn().mockRejectedValue(new Error('Null constraint violation'))
      };

      Announcement.mockImplementation(() => mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements')
        .send({
          title: null,
          content: null
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle duplicate announcement titles', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Duplicate Title',
        content: 'First announcement',
        save: jest.fn().mockResolvedValue(true)
      };

      Announcement.mockImplementation(() => mockAnnouncement);

      // Create first announcement
      const response1 = await request(app)
        .post('/api/announcements')
        .send({
          title: 'Duplicate Title',
          content: 'First announcement'
        });

      expect(response1.status).toBe(201);

      // Try to create second announcement with same title
      const mockDuplicateError = new Error('Title already exists');
      mockDuplicateError.name = 'SequelizeUniqueConstraintError';
      
      const mockFailingAnnouncement = {
        save: jest.fn().mockRejectedValue(mockDuplicateError)
      };

      Announcement.mockImplementation(() => mockFailingAnnouncement);

      const response2 = await request(app)
        .post('/api/announcements')
        .send({
          title: 'Duplicate Title',
          content: 'Second announcement'
        });

      expect(response2.status).toBe(400);
      expect(response2.body.success).toBe(false);
    });
  });

  describe('Comprehensive CRUD Operations', () => {
    describe('READ Operations', () => {
      it('should get single announcement by ID', async () => {
        const mockAnnouncement = {
          id: 1,
          title: 'Single Announcement',
          content: 'Content for single announcement',
          createdAt: new Date(),
          createdBy: { firstName: 'Admin', lastName: 'User' }
        };

        Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

        const response = await request(app)
          .get('/api/announcements/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Single Announcement');
      });

      it('should return 404 for non-existent announcement by ID', async () => {
        Announcement.findByPk = jest.fn().mockResolvedValue(null);

        const response = await request(app)
          .get('/api/announcements/999');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Announcement not found');
      });

      it('should filter announcements by date range', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-12-31');
        
        const mockAnnouncements = [
          {
            id: 1,
            title: 'Q1 Announcement',
            content: 'First quarter update',
            createdAt: new Date('2024-03-01')
          }
        ];

        Announcement.find = jest.fn().mockResolvedValue(mockAnnouncements);
        Announcement.countDocuments = jest.fn().mockResolvedValue(1);

        const response = await request(app)
          .get(`/api/announcements?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);

        expect(response.status).toBe(200);
        expect(response.body.data.announcements.length).toBe(1);
      });

      it('should search announcements by title and content', async () => {
        const mockAnnouncements = [
          {
            id: 1,
            title: 'Company Policy Update',
            content: 'New remote work policy',
            createdAt: new Date()
          }
        ];

        Announcement.find = jest.fn().mockResolvedValue(mockAnnouncements);
        Announcement.countDocuments = jest.fn().mockResolvedValue(1);

        const response = await request(app)
          .get('/api/announcements?search=policy');

        expect(response.status).toBe(200);
        expect(response.body.data.announcements.length).toBe(1);
        expect(response.body.data.announcements[0].title).toContain('Policy');
      });
    });

    describe('UPDATE Operations - Extended', () => {
      it('should update only title', async () => {
        const mockAnnouncement = {
          id: 1,
          title: 'New Title Only',
          content: 'Original content',
          expirationDate: null,
          save: jest.fn().mockResolvedValue(true)
        };

        Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

        const response = await request(app)
          .put('/api/announcements/1')
          .send({
            title: 'New Title Only'
          });

        expect(response.status).toBe(200);
        expect(response.body.data.title).toBe('New Title Only');
        expect(response.body.data.content).toBe('Original content');
      });

      it('should clear expiration date when set to null', async () => {
        const mockAnnouncement = {
          id: 1,
          title: 'Test Announcement',
          content: 'Test content',
          expirationDate: null,
          save: jest.fn().mockResolvedValue(true)
        };

        Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

        const response = await request(app)
          .put('/api/announcements/1')
          .send({
            expirationDate: null
          });

        expect(response.status).toBe(200);
        expect(response.body.data.expirationDate).toBeNull();
      });

      it('should handle update with no changes', async () => {
        const mockAnnouncement = {
          id: 1,
          title: 'Unchanged Title',
          content: 'Unchanged content',
          expirationDate: null,
          save: jest.fn().mockResolvedValue(true)
        };

        Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

        const response = await request(app)
          .put('/api/announcements/1')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('DELETE Operations - Extended', () => {
      it('should soft delete announcement (if implemented)', async () => {
        const mockAnnouncement = {
          id: 1,
          title: 'To be soft deleted',
          isDeleted: false,
          deletedAt: null,
          save: jest.fn().mockImplementation(function() {
            this.isDeleted = true;
            this.deletedAt = new Date();
            return Promise.resolve(true);
          }),
          destroy: jest.fn().mockResolvedValue(true)
        };

        Announcement.findByPk = jest.fn().mockResolvedValue(mockAnnouncement);

        const response = await request(app)
          .delete('/api/announcements/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should prevent deletion of announcement with invalid ID format', async () => {
        const response = await request(app)
          .delete('/api/announcements/invalid-id');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Invalid announcement ID format');
      });
    });
  });
});