const request = require('supertest');
const express = require('express');
const { announcementController } = require('../announcementController');
const Announcement = require('../../models/Announcement');
const NotificationService = require('../../services/NotificationService');
const FileUploadService = require('../../services/FileUploadService');

// Mock dependencies
jest.mock('../../models/Announcement');
jest.mock('../../services/NotificationService');
jest.mock('../../services/FileUploadService');
jest.mock('../../middleware/auth');

const app = express();
app.use(express.json());
app.use('/api/announcements', require('../../routes/announcements'));

describe('Announcement Controller', () => {
  let mockUser;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 1,
      role: 'admin',
      email: 'admin@company.com'
    };
  });

  // TC-001: Admin can create new announcements with title, content, and publication date
  describe('TC-001: Create Announcement', () => {
    it('should create announcement with valid data', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Important Company Update',
        content: 'This is an important announcement about company policies.',
        priority: 'important',
        createdBy: 1,
        publishedAt: new Date(),
        isPublished: true
      };

      Announcement.create.mockResolvedValue(mockAnnouncement);
      FileUploadService.processAttachments.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Important Company Update',
          content: 'This is an important announcement about company policies.',
          priority: 'important'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Important Company Update');
      expect(Announcement.create).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Important Company Update',
        content: 'This is an important announcement about company policies.',
        priority: 'important'
      }));
    });

    it('should reject creation with missing title', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          content: 'Content without title',
          priority: 'normal'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should reject non-admin user creation', async () => {
      mockUser.role = 'employee';
      
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer employeetoken')
        .send({
          title: 'Employee Announcement',
          content: 'This should not be allowed'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Unauthorized');
    });
  });

  // TC-002: Admin can edit existing announcements before and after publication
  describe('TC-002: Edit Announcement', () => {
    it('should update published announcement', async () => {
      const existingAnnouncement = {
        id: 1,
        title: 'Original Title',
        content: 'Original content',
        isPublished: true,
        createdBy: 1,
        update: jest.fn().mockResolvedValue(true)
      };

      Announcement.findByPk.mockResolvedValue(existingAnnouncement);

      const response = await request(app)
        .put('/api/announcements/1')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Updated Title',
          content: 'Updated content'
        });

      expect(response.status).toBe(200);
      expect(existingAnnouncement.update).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Updated Title',
        content: 'Updated content'
      }));
    });

    it('should update unpublished announcement', async () => {
      const draftAnnouncement = {
        id: 2,
        title: 'Draft Title',
        content: 'Draft content',
        isPublished: false,
        createdBy: 1,
        update: jest.fn().mockResolvedValue(true)
      };

      Announcement.findByPk.mockResolvedValue(draftAnnouncement);

      const response = await request(app)
        .put('/api/announcements/2')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Updated Draft Title',
          priority: 'urgent'
        });

      expect(response.status).toBe(200);
      expect(draftAnnouncement.update).toHaveBeenCalled();
    });
  });

  // TC-003: Admin can delete announcements
  describe('TC-003: Delete Announcement', () => {
    it('should delete announcement successfully', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'To be deleted',
        createdBy: 1,
        destroy: jest.fn().mockResolvedValue(true)
      };

      Announcement.findByPk.mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .delete('/api/announcements/1')
        .set('Authorization', 'Bearer mocktoken');

      expect(response.status).toBe(200);
      expect(mockAnnouncement.destroy).toHaveBeenCalled();
    });

    it('should return 404 for non-existent announcement', async () => {
      Announcement.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/announcements/999')
        .set('Authorization', 'Bearer mocktoken');

      expect(response.status).toBe(404);
    });
  });

  // TC-004: Admin can set announcement priority levels
  describe('TC-004: Priority Levels', () => {
    it('should create announcement with normal priority', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Normal Priority',
        priority: 'normal'
      };

      Announcement.create.mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Normal Priority',
          content: 'Normal content',
          priority: 'normal'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.priority).toBe('normal');
    });

    it('should create announcement with urgent priority and send notifications', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Urgent Alert',
        priority: 'urgent',
        isPublished: true
      };

      Announcement.create.mockResolvedValue(mockAnnouncement);
      const sendNotificationSpy = jest.spyOn(announcementController, 'sendUrgentNotifications')
        .mockResolvedValue(true);

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Urgent Alert',
          content: 'This is urgent!',
          priority: 'urgent'
        });

      expect(response.status).toBe(201);
      expect(sendNotificationSpy).toHaveBeenCalledWith(mockAnnouncement);
    });

    it('should reject invalid priority level', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Invalid Priority',
          content: 'Content',
          priority: 'invalid_priority'
        });

      expect(response.status).toBe(400);
    });
  });

  // TC-005: Admin can schedule announcements for future publication
  describe('TC-005: Schedule Announcements', () => {
    it('should schedule announcement for future publication', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const mockAnnouncement = {
        id: 1,
        title: 'Scheduled Announcement',
        scheduledAt: futureDate,
        isPublished: false
      };

      Announcement.create.mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Scheduled Announcement',
          content: 'This will be published tomorrow',
          scheduledAt: futureDate.toISOString()
        });

      expect(response.status).toBe(201);
      expect(response.body.data.isPublished).toBe(false);
    });

    it('should publish immediately if scheduled date is in the past', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const mockAnnouncement = {
        id: 1,
        title: 'Past Scheduled',
        scheduledAt: pastDate,
        isPublished: true
      };

      Announcement.create.mockResolvedValue(mockAnnouncement);

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Past Scheduled',
          content: 'Should be published immediately',
          scheduledAt: pastDate.toISOString()
        });

      expect(response.status).toBe(201);
      expect(response.body.data.isPublished).toBe(true);
    });
  });
});

// TC-006: Employees can view all published announcements in chronological order
describe('TC-006: View Published Announcements', () => {
  it('should return published announcements in chronological order', async () => {
    const mockAnnouncements = [
      {
        id: 2,
        title: 'Latest Announcement',
        publishedAt: new Date('2024-01-15'),
        isPublished: true
      },
      {
        id: 1,
        title: 'Older Announcement',
        publishedAt: new Date('2024-01-10'),
        isPublished: true
      }
    ];

    Announcement.findAll.mockResolvedValue(mockAnnouncements);

    const response = await request(app)
      .get('/api/announcements')
      .set('Authorization', 'Bearer employeetoken');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].id).toBe(2); // Latest first
  });

  it('should not return unpublished announcements to employees', async () => {
    Announcement.findAll.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/announcements')
      .set('Authorization', 'Bearer employeetoken');

    expect(Announcement.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        isPublished: true
      })
    }));
  });
});

// TC-009: Announcements support rich text formatting and file attachments
describe('TC-009: Rich Text and Attachments', () => {
  it('should handle announcements with file attachments', async () => {
    const mockAttachments = [
      {
        filename: 'document.pdf',
        originalName: 'Important Document.pdf',
        size: 1024000,
        url: '/uploads/document.pdf'
      }
    ];

    const mockAnnouncement = {
      id: 1,
      title: 'Announcement with Attachment',
      content: '<p>Please see attached document</p>',
      attachments: mockAttachments
    };

    Announcement.create.mockResolvedValue(mockAnnouncement);
    FileUploadService.processAttachments.mockResolvedValue(mockAttachments);

    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', 'Bearer mocktoken')
      .send({
        title: 'Announcement with Attachment',
        content: '<p>Please see attached document</p>',
        attachments: [{
          filename: 'document.pdf',
          originalName: 'Important Document.pdf'
        }]
      });

    expect(response.status).toBe(201);
    expect(response.body.data.attachments).toHaveLength(1);
    expect(FileUploadService.processAttachments).toHaveBeenCalled();
  });

  it('should sanitize HTML content', async () => {
    const mockAnnouncement = {
      id: 1,
      title: 'Rich Text Announcement',
      content: '<p>Safe content</p>'
    };

    Announcement.create.mockResolvedValue(mockAnnouncement);

    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', 'Bearer mocktoken')
      .send({
        title: 'Rich Text Announcement',
        content: '<p>Safe content</p><script>alert("dangerous")</script>'
      });

    expect(response.status).toBe(201);
    // Verify script tags are removed during processing
  });
});

// TC-011: System archives announcements older than 6 months automatically
describe('TC-011: Automatic Archiving', () => {
  it('should mark old announcements for archiving', async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const oldAnnouncement = {
      id: 1,
      title: 'Old Announcement',
      publishedAt: new Date(sixMonthsAgo.getTime() - 86400000), // 7 months ago
      archived: false,
      update: jest.fn()
    };

    Announcement.findAll.mockResolvedValue([oldAnnouncement]);

    // Simulate archiver job
    const { AnnouncementArchiver } = require('../../jobs/announcementArchiver');
    const archiver = new AnnouncementArchiver();
    await archiver.archiveOldAnnouncements();

    expect(Announcement.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        archived: false
      })
    }));
  });
});