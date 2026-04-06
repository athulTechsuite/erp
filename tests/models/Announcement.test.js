const mongoose = require('mongoose');
const Announcement = require('../../src/models/Announcement');
const User = require('../../src/models/User');

describe('Announcement Model', () => {
  let testUser;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_announcements');
    
    testUser = new User({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });
    await testUser.save();
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Announcement.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Announcement.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create announcement with valid data', async () => {
      const announcementData = {
        title: 'Test Announcement',
        content: 'This is a test announcement content',
        author: testUser._id
      };

      const announcement = new Announcement(announcementData);
      const savedAnnouncement = await announcement.save();

      expect(savedAnnouncement.title).toBe('Test Announcement');
      expect(savedAnnouncement.content).toBe('This is a test announcement content');
      expect(savedAnnouncement.author.toString()).toBe(testUser._id.toString());
      expect(savedAnnouncement.isActive).toBe(true);
    });

    it('should fail validation when title is missing', async () => {
      const announcementData = {
        content: 'This is a test announcement content',
        author: testUser._id
      };

      const announcement = new Announcement(announcementData);
      
      await expect(announcement.save()).rejects.toThrow('title');
    });

    it('should fail validation when content is missing', async () => {
      const announcementData = {
        title: 'Test Announcement',
        author: testUser._id
      };

      const announcement = new Announcement(announcementData);
      
      await expect(announcement.save()).rejects.toThrow('content');
    });

    it('should fail validation when author is missing', async () => {
      const announcementData = {
        title: 'Test Announcement',
        content: 'This is a test announcement content'
      };

      const announcement = new Announcement(announcementData);
      
      await expect(announcement.save()).rejects.toThrow('author');
    });

    it('should enforce title max length', async () => {
      const longTitle = 'A'.repeat(201);
      const announcementData = {
        title: longTitle,
        content: 'This is a test announcement content',
        author: testUser._id
      };

      const announcement = new Announcement(announcementData);
      
      await expect(announcement.save()).rejects.toThrow();
    });

    it('should enforce content max length', async () => {
      const longContent = 'A'.repeat(2001);
      const announcementData = {
        title: 'Test Announcement',
        content: longContent,
        author: testUser._id
      };

      const announcement = new Announcement(announcementData);
      
      await expect(announcement.save()).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    it('should get active announcements ordered by creation date', async () => {
      const announcement1 = new Announcement({
        title: 'First Announcement',
        content: 'First content',
        author: testUser._id
      });
      await announcement1.save();

      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const announcement2 = new Announcement({
        title: 'Second Announcement',
        content: 'Second content',
        author: testUser._id
      });
      await announcement2.save();

      const activeAnnouncements = await Announcement.getActiveAnnouncements();

      expect(activeAnnouncements).toHaveLength(2);
      expect(activeAnnouncements[0].title).toBe('Second Announcement');
      expect(activeAnnouncements[1].title).toBe('First Announcement');
    });

    it('should exclude inactive announcements', async () => {
      const activeAnnouncement = new Announcement({
        title: 'Active Announcement',
        content: 'Active content',
        author: testUser._id,
        isActive: true
      });
      await activeAnnouncement.save();

      const inactiveAnnouncement = new Announcement({
        title: 'Inactive Announcement',
        content: 'Inactive content',
        author: testUser._id,
        isActive: false
      });
      await inactiveAnnouncement.save();

      const activeAnnouncements = await Announcement.getActiveAnnouncements();

      expect(activeAnnouncements).toHaveLength(1);
      expect(activeAnnouncements[0].title).toBe('Active Announcement');
    });

    it('should exclude expired announcements', async () => {
      const activeAnnouncement = new Announcement({
        title: 'Active Announcement',
        content: 'Active content',
        author: testUser._id,
        expiresAt: null
      });
      await activeAnnouncement.save();

      const expiredAnnouncement = new Announcement({
        title: 'Expired Announcement',
        content: 'Expired content',
        author: testUser._id,
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      });
      await expiredAnnouncement.save();

      const activeAnnouncements = await Announcement.getActiveAnnouncements();

      expect(activeAnnouncements).toHaveLength(1);
      expect(activeAnnouncements[0].title).toBe('Active Announcement');
    });
  });

  describe('Instance Methods', () => {
    it('should soft delete announcement', async () => {
      const announcement = new Announcement({
        title: 'Test Announcement',
        content: 'Test content',
        author: testUser._id
      });
      await announcement.save();

      expect(announcement.isActive).toBe(true);

      await announcement.softDelete();

      expect(announcement.isActive).toBe(false);
    });

    it('should update announcement', async () => {
      const announcement = new Announcement({
        title: 'Original Title',
        content: 'Original content',
        author: testUser._id
      });
      await announcement.save();

      const updateData = {
        title: 'Updated Title',
        content: 'Updated content'
      };

      await announcement.updateAnnouncement(updateData);

      expect(announcement.title).toBe('Updated Title');
      expect(announcement.content).toBe('Updated content');
      expect(announcement.author.toString()).toBe(testUser._id.toString());
    });

    it('should not update author field', async () => {
      const announcement = new Announcement({
        title: 'Test Title',
        content: 'Test content',
        author: testUser._id
      });
      await announcement.save();

      const originalAuthor = announcement.author;
      const fakeUserId = new mongoose.Types.ObjectId();

      const updateData = {
        title: 'Updated Title',
        author: fakeUserId
      };

      await announcement.updateAnnouncement(updateData);

      expect(announcement.title).toBe('Updated Title');
      expect(announcement.author.toString()).toBe(originalAuthor.toString());
    });
  });

  describe('Virtual Properties', () => {
    it('should correctly identify expired announcements', async () => {
      const expiredAnnouncement = new Announcement({
        title: 'Expired Announcement',
        content: 'Expired content',
        author: testUser._id,
        expiresAt: new Date(Date.now() - 1000)
      });

      expect(expiredAnnouncement.isExpired).toBe(true);
    });

    it('should correctly identify non-expired announcements', async () => {
      const futureAnnouncement = new Announcement({
        title: 'Future Announcement',
        content: 'Future content',
        author: testUser._id,
        expiresAt: new Date(Date.now() + 1000)
      });

      expect(futureAnnouncement.isExpired).toBe(false);
    });

    it('should handle announcements without expiration', async () => {
      const permanentAnnouncement = new Announcement({
        title: 'Permanent Announcement',
        content: 'Permanent content',
        author: testUser._id
      });

      expect(permanentAnnouncement.isExpired).toBe(false);
    });
  });
});