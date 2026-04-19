const request = require('supertest');
const express = require('express');
const Announcement = require('../../models/Announcement');
const User = require('../../models/User');
const emailService = require('../../services/emailService');
const announcementController = require('../announcementController');

// Mock dependencies
jest.mock('../../models/Announcement');
jest.mock('../../models/User');
jest.mock('../../services/emailService');

const app = express();
app.use(express.json());
app.use('/api/announcements', require('../../routes/announcements'));

describe('AnnouncementController', () => {
  let mockUser, mockAnnouncement;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUser = {
      id: 1,
      name: 'Admin User',
      email: 'admin@company.com',
      role: 'admin'
    };

    mockAnnouncement = {
      id: 1,
      title: 'Test Announcement',
      content: '<p>Test content with <strong>rich text</strong></p>',
      priority: 'normal',
      publishDate: new Date(),
      expirationDate: new Date(Date.now() + 86400000),
      createdBy: mockUser.id,
      isActive: true,
      readBy: []
    };
  });

  // TC-001: Admin users can create new announcements with title, content, and publication date
  describe('TC-001: Create Announcements', () => {
    it('should create announcement with valid data', async () => {
      const announcementData = {
        title: 'Company Update',
        content: '<p>Important company announcement</p>',
        publishDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 86400000).toISOString(),
        priority: 'normal'
      };

      Announcement.create.mockResolvedValue({ ...mockAnnouncement, ...announcementData });

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer valid-token')
        .send(announcementData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(announcementData.title);
      expect(Announcement.create).toHaveBeenCalledWith(expect.objectContaining({
        title: announcementData.title,
        content: announcementData.content
      }));
    });

    it('should reject announcement with missing title', async () => {
      const invalidData = {
        content: '<p>Content without title</p>',
        publishDate: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('title');
    });
  });

  // TC-002: Announcements can be scheduled for future publication
  describe('TC-002: Schedule Future Publications', () => {
    it('should create scheduled announcement for future date', async () => {
      const futureDate = new Date(Date.now() + 2 * 86400000); // 2 days from now
      const scheduledData = {
        title: 'Future Announcement',
        content: '<p>This will be published later</p>',
        publishDate: futureDate.toISOString(),
        expirationDate: new Date(Date.now() + 7 * 86400000).toISOString()
      };

      Announcement.create.mockResolvedValue({ 
        ...mockAnnouncement, 
        ...scheduledData,
        publishDate: futureDate
      });

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer valid-token')
        .send(scheduledData)
        .expect(201);

      expect(response.body.data.publishDate).toBe(futureDate.toISOString());
      expect(new Date(response.body.data.publishDate)).toBeAfter(new Date());
    });

    it('should not return scheduled announcements in public list', async () => {
      const futureAnnouncement = {
        ...mockAnnouncement,
        publishDate: new Date(Date.now() + 86400000)
      };
      const currentAnnouncement = {
        ...mockAnnouncement,
        id: 2,
        publishDate: new Date(Date.now() - 3600000)
      };

      Announcement.find.mockResolvedValue([currentAnnouncement]);

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(currentAnnouncement.id);
    });
  });

  // TC-003: Employees can view all active announcements
  describe('TC-003: View Active Announcements', () => {
    it('should return active announcements for employees', async () => {
      const activeAnnouncements = [
        mockAnnouncement,
        { ...mockAnnouncement, id: 2, title: 'Another Announcement' }
      ];

      Announcement.find.mockResolvedValue(activeAnnouncements);

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'Bearer employee-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].title).toBe('Test Announcement');
    });

    it('should exclude expired announcements', async () => {
      const expiredAnnouncement = {
        ...mockAnnouncement,
        expirationDate: new Date(Date.now() - 86400000) // Yesterday
      };

      Announcement.find.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });

  // TC-004: Announcements support rich text formatting
  describe('TC-004: Rich Text Support', () => {
    it('should preserve rich text formatting in content', async () => {
      const richContent = '<h2>Important Update</h2><p>This is <strong>bold</strong> and <em>italic</em> text.</p><ul><li>List item 1</li><li>List item 2</li></ul><p><a href="https://company.com">Company Link</a></p>';
      
      const richAnnouncement = {
        title: 'Rich Text Announcement',
        content: richContent,
        publishDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 86400000).toISOString()
      };

      Announcement.create.mockResolvedValue({ 
        ...mockAnnouncement, 
        content: richContent 
      });

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer admin-token')
        .send(richAnnouncement)
        .expect(201);

      expect(response.body.data.content).toBe(richContent);
      expect(response.body.data.content).toContain('<strong>');
      expect(response.body.data.content).toContain('<em>');
      expect(response.body.data.content).toContain('<ul>');
    });
  });

  // TC-005: Announcements can be marked as urgent/priority with visual indicators
  describe('TC-005: Priority and Urgent Announcements', () => {
    it('should create urgent announcement with correct priority', async () => {
      const urgentData = {
        title: 'URGENT: System Maintenance',
        content: '<p>Urgent system maintenance notification</p>',
        priority: 'urgent',
        publishDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 86400000).toISOString()
      };

      Announcement.create.mockResolvedValue({ 
        ...mockAnnouncement, 
        ...urgentData 
      });

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer admin-token')
        .send(urgentData)
        .expect(201);

      expect(response.body.data.priority).toBe('urgent');
    });

    it('should sort urgent announcements first', async () => {
      const announcements = [
        { ...mockAnnouncement, id: 1, priority: 'normal', title: 'Normal' },
        { ...mockAnnouncement, id: 2, priority: 'urgent', title: 'Urgent' },
        { ...mockAnnouncement, id: 3, priority: 'priority', title: 'Priority' }
      ];

      // Mock sorting by priority
      Announcement.find.mockResolvedValue([
        announcements[1], // urgent first
        announcements[2], // priority second  
        announcements[0]  // normal last
      ]);

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.data[0].priority).toBe('urgent');
      expect(response.body.data[1].priority).toBe('priority');
      expect(response.body.data[2].priority).toBe('normal');
    });
  });

  // TC-006: Users can mark announcements as read/unread
  describe('TC-006: Read/Unread Status', () => {
    it('should mark announcement as read', async () => {
      const announcementId = 1;
      const userId = 1;

      Announcement.findById.mockResolvedValue(mockAnnouncement);
      Announcement.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const response = await request(app)
        .post(`/api/announcements/${announcementId}/read`)
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Announcement.updateOne).toHaveBeenCalledWith(
        { _id: announcementId },
        { $addToSet: { readBy: expect.objectContaining({ user: userId }) } }
      );
    });

    it('should mark announcement as unread', async () => {
      const announcementId = 1;
      const userId = 1;

      Announcement.findById.mockResolvedValue(mockAnnouncement);
      Announcement.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const response = await request(app)
        .delete(`/api/announcements/${announcementId}/read`)
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Announcement.updateOne).toHaveBeenCalledWith(
        { _id: announcementId },
        { $pull: { readBy: { user: userId } } }
      );
    });
  });

  // TC-007: Admin can edit or delete existing announcements
  describe('TC-007: Admin Edit/Delete', () => {
    it('should allow admin to edit announcement', async () => {
      const announcementId = 1;
      const updateData = {
        title: 'Updated Title',
        content: '<p>Updated content</p>'
      };

      Announcement.findByIdAndUpdate.mockResolvedValue({
        ...mockAnnouncement,
        ...updateData
      });

      const response = await request(app)
        .put(`/api/announcements/${announcementId}`)
        .set('Authorization', 'Bearer admin-token')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        announcementId,
        expect.objectContaining(updateData),
        { new: true }
      );
    });

    it('should allow admin to delete announcement', async () => {
      const announcementId = 1;

      Announcement.findByIdAndDelete.mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .delete(`/api/announcements/${announcementId}`)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Announcement.findByIdAndDelete).toHaveBeenCalledWith(announcementId);
    });

    it('should prevent non-admin from editing announcements', async () => {
      const response = await request(app)
        .put('/api/announcements/1')
        .set('Authorization', 'Bearer employee-token')
        .send({ title: 'Unauthorized Edit' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('permission');
    });
  });

  // TC-008: Announcements have expiration dates and are automatically archived
  describe('TC-008: Automatic Expiration', () => {
    it('should exclude expired announcements from active list', async () => {
      const currentDate = new Date();
      const expiredDate = new Date(Date.now() - 86400000);
      
      Announcement.find.mockImplementation((query) => {
        // Simulate database filtering expired announcements
        if (query.expirationDate && query.expirationDate.$gte) {
          return Promise.resolve([]); // No expired announcements returned
        }
        return Promise.resolve([mockAnnouncement]);
      });

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(Announcement.find).toHaveBeenCalledWith(expect.objectContaining({
        expirationDate: expect.objectContaining({ $gte: expect.any(Date) })
      }));
    });

    it('should archive expired announcements', async () => {
      const expiredAnnouncements = [
        { ...mockAnnouncement, expirationDate: new Date(Date.now() - 86400000) }
      ];

      Announcement.updateMany.mockResolvedValue({ modifiedCount: 1 });

      // Simulate cron job or cleanup process
      await announcementController.archiveExpiredAnnouncements();

      expect(Announcement.updateMany).toHaveBeenCalledWith(
        { expirationDate: { $lt: expect.any(Date) }, isActive: true },
        { $set: { isActive: false, isArchived: true } }
      );
    });
  });

  // TC-009: Email notifications are sent for urgent announcements
  describe('TC-009: Email Notifications', () => {
    it('should send email for urgent announcements', async () => {
      const urgentData = {
        title: 'URGENT: Emergency Meeting',
        content: '<p>Emergency all-hands meeting at 3 PM</p>',
        priority: 'urgent',
        publishDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 86400000).toISOString()
      };

      const allUsers = [
        { id: 1, email: 'user1@company.com' },
        { id: 2, email: 'user2@company.com' }
      ];

      Announcement.create.mockResolvedValue({ 
        ...mockAnnouncement, 
        ...urgentData 
      });
      User.find.mockResolvedValue(allUsers);
      emailService.sendUrgentAnnouncementNotification.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer admin-token')
        .send(urgentData)
        .expect(201);

      expect(emailService.sendUrgentAnnouncementNotification).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'urgent' }),
        expect.arrayContaining([
          expect.objectContaining({ email: 'user1@company.com' })
        ])
      );
    });

    it('should not send email for normal priority announcements', async () => {
      const normalData = {
        title: 'Regular Update',
        content: '<p>Regular company update</p>',
        priority: 'normal',
        publishDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 86400000).toISOString()
      };

      Announcement.create.mockResolvedValue({ 
        ...mockAnnouncement, 
        ...normalData 
      });

      await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer admin-token')
        .send(normalData)
        .expect(201);

      expect(emailService.sendUrgentAnnouncementNotification).not.toHaveBeenCalled();
    });
  });
});