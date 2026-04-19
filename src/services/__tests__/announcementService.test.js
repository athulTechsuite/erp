const announcementService = require('../announcementService');
const Announcement = require('../../models/Announcement');
const AnnouncementRead = require('../../models/AnnouncementRead');
const User = require('../../models/User');
const NotificationService = require('../notificationService');

// Mock dependencies
jest.mock('../../models/Announcement');
jest.mock('../../models/AnnouncementRead');
jest.mock('../../models/User');
jest.mock('../notificationService');

describe('Announcement Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-007: Employees can mark announcements as read/unread
  describe('TC-007: Mark Announcements Read/Unread', () => {
    const mockUser = { id: 1, email: 'user@company.com' };
    const mockAnnouncement = { id: 1, title: 'Test Announcement' };

    it('should mark announcement as read for user', async () => {
      const mockReadRecord = {
        id: 1,
        announcementId: 1,
        userId: 1,
        isRead: true,
        readAt: new Date()
      };

      AnnouncementRead.markAsRead.mockResolvedValue(mockReadRecord);
      Announcement.findByPk.mockResolvedValue(mockAnnouncement);

      const result = await announcementService.markAsRead(1, 1);

      expect(result.success).toBe(true);
      expect(AnnouncementRead.markAsRead).toHaveBeenCalledWith(1, 1);
    });

    it('should mark announcement as unread for user', async () => {
      const mockUnreadRecord = {
        id: 1,
        announcementId: 1,
        userId: 1,
        isRead: false,
        readAt: new Date()
      };

      AnnouncementRead.markAsUnread.mockResolvedValue(mockUnreadRecord);
      Announcement.findByPk.mockResolvedValue(mockAnnouncement);

      const result = await announcementService.markAsUnread(1, 1);

      expect(result.success).toBe(true);
      expect(AnnouncementRead.markAsUnread).toHaveBeenCalledWith(1, 1);
    });

    it('should return error when announcement not found', async () => {
      Announcement.findByPk.mockResolvedValue(null);

      await expect(announcementService.markAsRead(999, 1))
        .rejects.toThrow('Announcement not found');
    });

    it('should get read status for multiple announcements', async () => {
      const mockReadStatuses = {
        1: { isRead: true, readAt: new Date() },
        2: { isRead: false, readAt: null }
      };

      AnnouncementRead.getReadStatusForUser.mockResolvedValue(mockReadStatuses);

      const result = await announcementService.getReadStatusForUser(1, [1, 2]);

      expect(result).toEqual(mockReadStatuses);
      expect(AnnouncementRead.getReadStatusForUser).toHaveBeenCalledWith(1, [1, 2]);
    });
  });

  // TC-008: System sends notifications for new urgent announcements
  describe('TC-008: Urgent Notifications', () => {
    it('should send notifications for urgent announcements', async () => {
      const urgentAnnouncement = {
        id: 1,
        title: 'Urgent: System Maintenance',
        content: 'Emergency maintenance tonight',
        priority: 'urgent',
        isPublished: true
      };

      const mockUsers = [
        { id: 1, email: 'user1@company.com', name: 'User 1' },
        { id: 2, email: 'user2@company.com', name: 'User 2' }
      ];

      User.findAll.mockResolvedValue(mockUsers);
      NotificationService.sendAnnouncementNotification.mockResolvedValue(true);

      await announcementService.sendUrgentNotifications(urgentAnnouncement);

      expect(NotificationService.sendAnnouncementNotification)
        .toHaveBeenCalledWith(
          urgentAnnouncement,
          mockUsers,
          expect.objectContaining({
            priority: 'urgent',
            immediate: true
          })
        );
    });

    it('should not send notifications for non-urgent announcements', async () => {
      const normalAnnouncement = {
        id: 1,
        title: 'Regular Update',
        priority: 'normal',
        isPublished: true
      };

      await announcementService.sendUrgentNotifications(normalAnnouncement);

      expect(NotificationService.sendAnnouncementNotification)
        .not.toHaveBeenCalled();
    });

    it('should not send notifications for unpublished urgent announcements', async () => {
      const unpublishedUrgent = {
        id: 1,
        title: 'Draft Urgent',
        priority: 'urgent',
        isPublished: false
      };

      await announcementService.sendUrgentNotifications(unpublishedUrgent);

      expect(NotificationService.sendAnnouncementNotification)
        .not.toHaveBeenCalled();
    });
  });

  // TC-010: Admin can see read/unread statistics for each announcement
  describe('TC-010: Read/Unread Statistics', () => {
    it('should return read statistics for announcement', async () => {
      const mockStats = {
        announcementId: 1,
        totalUsers: 10,
        totalReads: 7,
        unreadCount: 3,
        readPercentage: 70,
        readUsers: [
          { userId: 1, userName: 'User 1', readAt: new Date() },
          { userId: 2, userName: 'User 2', readAt: new Date() }
        ],
        unreadUsers: [
          { userId: 3, userName: 'User 3' },
          { userId: 4, userName: 'User 4' }
        ]
      };

      AnnouncementRead.getStatistics = jest.fn().mockResolvedValue(mockStats);

      const result = await announcementService.getAnnouncementStatistics(1);

      expect(result).toEqual(mockStats);
      expect(result.readPercentage).toBe(70);
      expect(result.unreadCount).toBe(3);
    });

    it('should handle announcement with no reads', async () => {
      const mockStats = {
        announcementId: 1,
        totalUsers: 5,
        totalReads: 0,
        unreadCount: 5,
        readPercentage: 0,
        readUsers: [],
        unreadUsers: [
          { userId: 1, userName: 'User 1' },
          { userId: 2, userName: 'User 2' },
          { userId: 3, userName: 'User 3' },
          { userId: 4, userName: 'User 4' },
          { userId: 5, userName: 'User 5' }
        ]
      };

      AnnouncementRead.getStatistics = jest.fn().mockResolvedValue(mockStats);

      const result = await announcementService.getAnnouncementStatistics(1);

      expect(result.readPercentage).toBe(0);
      expect(result.totalReads).toBe(0);
      expect(result.unreadCount).toBe(5);
    });

    it('should handle announcement with 100% read rate', async () => {
      const mockStats = {
        announcementId: 1,
        totalUsers: 3,
        totalReads: 3,
        unreadCount: 0,
        readPercentage: 100,
        readUsers: [
          { userId: 1, userName: 'User 1', readAt: new Date() },
          { userId: 2, userName: 'User 2', readAt: new Date() },
          { userId: 3, userName: 'User 3', readAt: new Date() }
        ],
        unreadUsers: []
      };

      AnnouncementRead.getStatistics = jest.fn().mockResolvedValue(mockStats);

      const result = await announcementService.getAnnouncementStatistics(1);

      expect(result.readPercentage).toBe(100);
      expect(result.unreadCount).toBe(0);
    });
  });

  describe('Announcement Filtering and Pagination', () => {
    it('should filter announcements by priority', async () => {
      const urgentAnnouncements = [
        { id: 1, title: 'Urgent 1', priority: 'urgent' },
        { id: 2, title: 'Urgent 2', priority: 'urgent' }
      ];

      Announcement.findAll.mockResolvedValue(urgentAnnouncements);

      const result = await announcementService.getAnnouncementsForUser(1, {
        priority: 'urgent'
      });

      expect(Announcement.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          priority: 'urgent'
        })
      }));
    });

    it('should paginate announcements correctly', async () => {
      const mockAnnouncements = [
        { id: 1, title: 'Announcement 1' },
        { id: 2, title: 'Announcement 2' }
      ];

      Announcement.findAndCountAll.mockResolvedValue({
        rows: mockAnnouncements,
        count: 10
      });

      const result = await announcementService.getAnnouncementsForUser(1, {
        page: 2,
        limit: 2
      });

      expect(Announcement.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        limit: 2,
        offset: 2
      }));
    });

    it('should exclude archived announcements by default', async () => {
      await announcementService.getAnnouncementsForUser(1);

      expect(Announcement.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          archived: false
        })
      }));
    });

    it('should include archived announcements when requested', async () => {
      await announcementService.getAnnouncementsForUser(1, {
        archived: true
      });

      expect(Announcement.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.not.objectContaining({
          archived: false
        })
      }));
    });
  });

  describe('Scheduled Announcements Processing', () => {
    it('should publish scheduled announcements when due', async () => {
      const scheduledAnnouncements = [
        {
          id: 1,
          title: 'Scheduled Announcement',
          scheduledAt: new Date(Date.now() - 1000), // 1 second ago
          isPublished: false,
          update: jest.fn().mockResolvedValue(true)
        }
      ];

      Announcement.findAll.mockResolvedValue(scheduledAnnouncements);

      await announcementService.processScheduledAnnouncements();

      expect(scheduledAnnouncements[0].update).toHaveBeenCalledWith({
        isPublished: true,
        publishedAt: expect.any(Date)
      });
    });

    it('should not publish future scheduled announcements', async () => {
      const futureAnnouncements = [
        {
          id: 1,
          title: 'Future Announcement',
          scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
          isPublished: false,
          update: jest.fn()
        }
      ];

      Announcement.findAll.mockResolvedValue(futureAnnouncements);

      await announcementService.processScheduledAnnouncements();

      expect(futureAnnouncements[0].update).not.toHaveBeenCalled();
    });
  });

  describe('File Attachment Handling', () => {
    it('should validate file types for attachments', () => {
      const validFiles = [
        { mimetype: 'application/pdf', size: 1000000 },
        { mimetype: 'image/jpeg', size: 500000 },
        { mimetype: 'application/msword', size: 2000000 }
      ];

      validFiles.forEach(file => {
        expect(announcementService.isValidAttachment(file)).toBe(true);
      });
    });

    it('should reject invalid file types', () => {
      const invalidFiles = [
        { mimetype: 'application/x-executable', size: 1000000 },
        { mimetype: 'video/mp4', size: 5000000 }
      ];

      invalidFiles.forEach(file => {
        expect(announcementService.isValidAttachment(file)).toBe(false);
      });
    });

    it('should reject files exceeding size limit', () => {
      const oversizedFile = {
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024 // 11MB (over 10MB limit)
      };

      expect(announcementService.isValidAttachment(oversizedFile)).toBe(false);
    });
  });
});