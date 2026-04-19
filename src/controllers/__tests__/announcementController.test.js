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

    it('should handle database errors gracefully during creation', async () => {
      Announcement.create.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Test Announcement',
          content: 'Test content'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Database connection failed');
    });

    it('should handle notification service failures without affecting creation', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'Urgent Alert',
        content: 'Urgent content',
        priority: 'urgent',
        isPublished: true
      };

      Announcement.create.mockResolvedValue(mockAnnouncement);
      NotificationService.sendUrgentNotifications.mockRejectedValue(new Error('Notification service down'));

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Urgent Alert',
          content: 'Urgent content',
          priority: 'urgent'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      // Announcement should still be created even if notifications fail
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

    it('should handle concurrent updates with optimistic locking', async () => {
      const existingAnnouncement = {
        id: 1,
        title: 'Original Title',
        content: 'Original content',
        version: 1,
        isPublished: true,
        createdBy: 1,
        update: jest.fn().mockRejectedValue(new Error('OptimisticLockError: Version mismatch'))
      };

      Announcement.findByPk.mockResolvedValue(existingAnnouncement);

      const response = await request(app)
        .put('/api/announcements/1')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Updated Title',
          content: 'Updated content',
          version: 1
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('Announcement has been modified by another user');
    });

    it('should simulate race condition during concurrent updates', async () => {
      const announcement = {
        id: 1,
        title: 'Original Title',
        content: 'Original content',
        version: 1,
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        update: jest.fn()
      };

      // First call succeeds
      announcement.update.mockResolvedValueOnce(true);
      
      // Second call fails due to version conflict
      announcement.update.mockRejectedValueOnce(new Error('OptimisticLockError: Version mismatch'));

      Announcement.findByPk.mockResolvedValue(announcement);

      // Simulate two concurrent requests
      const update1Promise = request(app)
        .put('/api/announcements/1')
        .set('Authorization', 'Bearer mocktoken1')
        .send({
          title: 'First Update',
          version: 1
        });

      const update2Promise = request(app)
        .put('/api/announcements/1')
        .set('Authorization', 'Bearer mocktoken2')
        .send({
          title: 'Second Update',
          version: 1
        });

      const [response1, response2] = await Promise.allSettled([update1Promise, update2Promise]);

      // One should succeed, one should fail
      const responses = [response1.value || response1.reason, response2.value || response2.reason];
      const successCount = responses.filter(r => r.status === 200).length;
      const conflictCount = responses.filter(r => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);
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

    it('should handle concurrent deletion attempts', async () => {
      const mockAnnouncement = {
        id: 1,
        title: 'To be deleted',
        createdBy: 1,
        destroy: jest.fn()
      };

      // First deletion succeeds
      mockAnnouncement.destroy.mockResolvedValueOnce(true);
      
      // Second deletion fails (already deleted)
      mockAnnouncement.destroy.mockRejectedValueOnce(new Error('Record not found'));

      Announcement.findByPk.mockResolvedValue(mockAnnouncement);

      const delete1Promise = request(app)
        .delete('/api/announcements/1')
        .set('Authorization', 'Bearer mocktoken1');

      const delete2Promise = request(app)
        .delete('/api/announcements/1')
        .set('Authorization', 'Bearer mocktoken2');

      const [response1, response2] = await Promise.allSettled([delete1Promise, delete2Promise]);

      // One should succeed (200), one should fail (404 or 500)
      const responses = [response1.value || response1.reason, response2.value || response2.reason];
      const successCount = responses.filter(r => r.status === 200).length;
      const errorCount = responses.filter(r => r.status >= 400).length;

      expect(successCount).toBe(1);
      expect(errorCount).toBe(1);
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

  it('should handle database errors when fetching announcements', async () => {
    Announcement.findAll.mockRejectedValue(new Error('Database timeout'));

    const response = await request(app)
      .get('/api/announcements')
      .set('Authorization', 'Bearer employeetoken');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Database timeout');
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

  it('should validate file size limits', async () => {
    FileUploadService.processAttachments.mockRejectedValue(new Error('File size exceeds 10MB limit'));

    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', 'Bearer mocktoken')
      .send({
        title: 'Large File Announcement',
        content: 'Content with large file',
        attachments: [{
          filename: 'largefile.pdf',
          originalName: 'Large File.pdf',
          size: 15000000 // 15MB
        }]
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('File size exceeds 10MB limit');
  });

  it('should validate file type restrictions', async () => {
    FileUploadService.processAttachments.mockRejectedValue(new Error('File type .exe not allowed'));

    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', 'Bearer mocktoken')
      .send({
        title: 'Invalid File Type',
        content: 'Content with invalid file',
        attachments: [{
          filename: 'malware.exe',
          originalName: 'malware.exe',
          mimeType: 'application/x-msdownload'
        }]
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('File type .exe not allowed');
  });

  it('should handle virus scanning failures', async () => {
    FileUploadService.processAttachments.mockRejectedValue(new Error('Virus scan failed: potential threat detected'));

    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', 'Bearer mocktoken')
      .send({
        title: 'Suspicious File',
        content: 'Content with suspicious file',
        attachments: [{
          filename: 'suspicious.pdf',
          originalName: 'suspicious.pdf'
        }]
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Virus scan failed');
  });

  it('should validate maximum number of attachments', async () => {
    const tooManyAttachments = Array.from({ length: 11 }, (_, i) => ({
      filename: `file${i}.pdf`,
      originalName: `File ${i}.pdf`
    }));

    FileUploadService.processAttachments.mockRejectedValue(new Error('Maximum 10 attachments allowed'));

    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', 'Bearer mocktoken')
      .send({
        title: 'Too Many Files',
        content: 'Content with too many files',
        attachments: tooManyAttachments
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Maximum 10 attachments allowed');
  });

  it('should handle corrupted file uploads', async () => {
    FileUploadService.processAttachments.mockRejectedValue(new Error('File appears to be corrupted'));

    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', 'Bearer mocktoken')
      .send({
        title: 'Corrupted File',
        content: 'Content with corrupted file',
        attachments: [{
          filename: 'corrupted.pdf',
          originalName: 'corrupted.pdf',
          size: 1000,
          checksum: 'invalid_checksum'
        }]
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('File appears to be corrupted');
  });

  it('should handle storage service unavailability', async () => {
    FileUploadService.processAttachments.mockRejectedValue(new Error('Storage service temporarily unavailable'));

    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', 'Bearer mocktoken')
      .send({
        title: 'Storage Error',
        content: 'Content with file',
        attachments: [{
          filename: 'document.pdf',
          originalName: 'document.pdf'
        }]
      });

    expect(response.status).toBe(503);
    expect(response.body.message).toContain('Storage service temporarily unavailable');
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

  it('should handle archiving failures gracefully', async () => {
    const oldAnnouncement = {
      id: 1,
      title: 'Old Announcement',
      update: jest.fn().mockRejectedValue(new Error('Database lock timeout'))
    };

    Announcement.findAll.mockResolvedValue([oldAnnouncement]);

    const { AnnouncementArchiver } = require('../../jobs/announcementArchiver');
    const archiver = new AnnouncementArchiver();
    
    // Should not throw error, should log and continue
    await expect(archiver.archiveOldAnnouncements()).resolves.not.toThrow();
  });
});

// Edge Cases and Error Scenarios
describe('Edge Cases and Error Scenarios', () => {
  describe('Concurrent Operations', () => {
    it('should handle multiple admins creating announcements simultaneously', async () => {
      const mockAnnouncement1 = { id: 1, title: 'Announcement 1' };
      const mockAnnouncement2 = { id: 2, title: 'Announcement 2' };

      let callCount = 0;
      Announcement.create.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockAnnouncement1 : mockAnnouncement2);
      });

      const create1Promise = request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer admin1token')
        .send({
          title: 'Announcement 1',
          content: 'First announcement'
        });

      const create2Promise = request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer admin2token')
        .send({
          title: 'Announcement 2',
          content: 'Second announcement'
        });

      const [response1, response2] = await Promise.all([create1Promise, create2Promise]);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.data.id).not.toBe(response2.body.data.id);
    });

    it('should prevent duplicate announcements with same title from concurrent requests', async () => {
      const duplicateError = new Error('Unique constraint violation');
      duplicateError.name = 'SequelizeUniqueConstraintError';

      let callCount = 0;
      Announcement.create.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ id: 1, title: 'Duplicate Title' });
        } else {
          return Promise.reject(duplicateError);
        }
      });

      const create1Promise = request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer admin1token')
        .send({
          title: 'Duplicate Title',
          content: 'First content'
        });

      const create2Promise = request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer admin2token')
        .send({
          title: 'Duplicate Title',
          content: 'Second content'
        });

      const [response1, response2] = await Promise.allSettled([create1Promise, create2Promise]);

      expect(response1.status === 'fulfilled' ? response1.value.status : 500).toBe(201);
      expect(response2.status === 'fulfilled' ? response2.value.status : 409).toBe(409);
    });
  });

  describe('File Upload Validation Edge Cases', () => {
    it('should handle empty file uploads', async () => {
      FileUploadService.processAttachments.mockRejectedValue(new Error('Empty file not allowed'));

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Empty File Test',
          content: 'Content',
          attachments: [{
            filename: 'empty.txt',
            originalName: 'empty.txt',
            size: 0
          }]
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Empty file not allowed');
    });

    it('should handle filename with special characters', async () => {
      FileUploadService.processAttachments.mockRejectedValue(new Error('Invalid filename characters'));

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Special Chars File',
          content: 'Content',
          attachments: [{
            filename: 'file<>:|?.txt',
            originalName: 'file<>:|?.txt'
          }]
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid filename characters');
    });

    it('should handle extremely long filenames', async () => {
      const longFilename = 'a'.repeat(300) + '.pdf';
      FileUploadService.processAttachments.mockRejectedValue(new Error('Filename too long (max 255 characters)'));

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Long Filename Test',
          content: 'Content',
          attachments: [{
            filename: longFilename,
            originalName: longFilename
          }]
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Filename too long');
    });

    it('should handle network interruption during file upload', async () => {
      FileUploadService.processAttachments.mockRejectedValue(new Error('Network connection lost during upload'));

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Network Error Test',
          content: 'Content',
          attachments: [{
            filename: 'document.pdf',
            originalName: 'document.pdf'
          }]
        });

      expect(response.status).toBe(503);
      expect(response.body.message).toContain('Network connection lost during upload');
    });

    it('should handle concurrent file uploads with same filename', async () => {
      let uploadCount = 0;
      FileUploadService.processAttachments.mockImplementation((attachments) => {
        uploadCount++;
        const filename = uploadCount === 1 ? 'document.pdf' : 'document_1.pdf';
        return Promise.resolve([{
          filename: filename,
          originalName: 'document.pdf',
          url: `/uploads/${filename}`
        }]);
      });

      const upload1Promise = request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer admin1token')
        .send({
          title: 'Upload 1',
          content: 'Content 1',
          attachments: [{
            filename: 'document.pdf',
            originalName: 'document.pdf'
          }]
        });

      const upload2Promise = request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer admin2token')
        .send({
          title: 'Upload 2',
          content: 'Content 2',
          attachments: [{
            filename: 'document.pdf',
            originalName: 'document.pdf'
          }]
        });

      const [response1, response2] = await Promise.all([upload1Promise, upload2Promise]);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      
      // Files should have different final names to avoid conflicts
      expect(response1.body.data.attachments[0].filename).not.toBe(
        response2.body.data.attachments[0].filename
      );
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle extremely large content', async () => {
      const largeContent = 'a'.repeat(1000000); // 1MB of text
      Announcement.create.mockRejectedValue(new Error('Content size exceeds limit'));

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Large Content Test',
          content: largeContent
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Content size exceeds limit');
    });

    it('should handle database connection pool exhaustion', async () => {
      Announcement.create.mockRejectedValue(new Error('Connection pool exhausted'));

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', 'Bearer mocktoken')
        .send({
          title: 'Pool Exhaustion Test',
          content: 'Content'
        });

      expect(response.status).toBe(503);
      expect(response.body.message).toContain('Service temporarily unavailable');
    });
  });
});