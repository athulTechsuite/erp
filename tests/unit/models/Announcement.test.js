const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Announcement = require('../../../src/models/Announcement');
const User = require('../../../src/models/User');

describe('Announcement Model', () => {
  let mongoServer;
  let mockUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create mock user
    mockUser = new User({
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'admin'
    });
    await mockUser.save();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Announcement.deleteMany({});
  });

  describe('Validation', () => {
    it('should create announcement with valid required fields', async () => {
      const announcementData = {
        title: 'Test Announcement',
        content: 'This is a test announcement content that is long enough.',
        createdBy: mockUser._id
      };

      const announcement = new Announcement(announcementData);
      const savedAnnouncement = await announcement.save();

      expect(savedAnnouncement.title).toBe(announcementData.title);
      expect(savedAnnouncement.content).toBe(announcementData.content);
      expect(savedAnnouncement.createdBy).toEqual(mockUser._id);
      expect(savedAnnouncement.isActive).toBe(true);
      expect(savedAnnouncement.priority).toBe('medium');
    });

    it('should fail validation when title is missing', async () => {
      const announcementData = {
        content: 'This is a test announcement content.',
        createdBy: mockUser._id
      };

      const announcement = new Announcement(announcementData);
      
      await expect(announcement.save()).rejects.toMatchObject({
        errors: {
          title: expect.objectContaining({
            message: 'Announcement title is required'
          })
        }
      });
    });

    it('should fail validation when content is missing', async () => {
      const announcementData = {
        title: 'Test Announcement',
        createdBy: mockUser._id
      };

      const announcement = new Announcement(announcementData);
      
      await expect(announcement.save()).rejects.toMatchObject({
        errors: {
          content: expect.objectContaining({
            message: 'Announcement content is required'
          })
        }
      });
    });

    it('should fail validation when title exceeds max length', async () => {
      const announcementData = {
        title: 'A'.repeat(201), // Exceeds 200 character limit
        content: 'This is a test announcement content.',
        createdBy: mockUser._id
      };

      const announcement = new Announcement(announcementData);
      
      await expect(announcement.save()).rejects.toMatchObject({
        errors: {
          title: expect.objectContaining({
            message: 'Title cannot exceed 200 characters'
          })
        }
      });
    });

    it('should fail validation when content exceeds max length', async () => {
      const announcementData = {
        title: 'Test Announcement',
        content: 'A'.repeat(2001), // Exceeds 2000 character limit
        createdBy: mockUser._id
      };

      const announcement = new Announcement(announcementData);
      
      await expect(announcement.save()).rejects.toMatchObject({
        errors: {
          content: expect.objectContaining({
            message: 'Content cannot exceed 2000 characters'
          })
        }
      });
    });

    it('should fail validation with invalid priority', async () => {
      const announcementData = {
        title: 'Test Announcement',
        content: 'This is a test announcement content.',
        createdBy: mockUser._id,
        priority: 'invalid'
      };

      const announcement = new Announcement(announcementData);
      
      await expect(announcement.save()).rejects.toMatchObject({
        errors: {
          priority: expect.objectContaining({
            message: expect.stringContaining('is not a valid enum value')
          })
        }
      });
    });

    it('should fail validation when createdBy is missing', async () => {
      const announcementData = {
        title: 'Test Announcement',
        content: 'This is a test announcement content.'
      };

      const announcement = new Announcement(announcementData);
      
      await expect(announcement.save()).rejects.toMatchObject({
        errors: {
          createdBy: expect.objectContaining({
            message: 'Creator is required'
          })
        }
      });
    });
  });

  describe('Virtuals', () => {
    it('should calculate isExpired virtual correctly', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

      const expiredAnnouncement = new Announcement({
        title: 'Expired Announcement',
        content: 'This announcement has expired.',
        createdBy: mockUser._id,
        expiresAt: pastDate
      });

      const activeAnnouncement = new Announcement({
        title: 'Active Announcement',
        content: 'This announcement is still active.',
        createdBy: mockUser._id,
        expiresAt: futureDate
      });

      expect(expiredAnnouncement.isExpired).toBe(true);
      expect(activeAnnouncement.isExpired).toBe(false);
    });

    it('should calculate readCount virtual correctly', async () => {
      const announcement = new Announcement({
        title: 'Test Announcement',
        content: 'This is a test announcement.',
        createdBy: mockUser._id,
        readBy: [
          { user: mockUser._id },
          { user: new mongoose.Types.ObjectId() }
        ]
      });

      expect(announcement.readCount).toBe(2);
    });
  });

  describe('Pre-save middleware', () => {
    it('should set isActive to false when announcement is expired', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const announcement = new Announcement({
        title: 'Expired Announcement',
        content: 'This announcement should become inactive.',
        createdBy: mockUser._id,
        expiresAt: pastDate
      });

      const savedAnnouncement = await announcement.save();
      expect(savedAnnouncement.isActive).toBe(false);
    });
  });
});