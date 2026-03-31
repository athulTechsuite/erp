const mongoose = require('mongoose');
const Announcement = require('../../../src/models/Announcement');
const User = require('../../../src/models/User');

describe('Announcement Model Unit Tests', () => {
  let testUser;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_DB_URL || 'mongodb://localhost:27017/erp_test');
    
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin'
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Announcement.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Announcement.deleteMany({});
  });

  describe('Model Validation', () => {
    it('should create a valid announcement with required fields', async () => {
      const validAnnouncement = {
        title: 'Test Announcement',
        content: 'This is a test announcement content',
        author: testUser._id
      };

      const announcement = new Announcement(validAnnouncement);
      const savedAnnouncement = await announcement.save();

      expect(savedAnnouncement._id).toBeDefined();
      expect(savedAnnouncement.title).toBe('Test Announcement');
      expect(savedAnnouncement.content).toBe('This is a test announcement content');
      expect(savedAnnouncement.status).toBe('active'); // default value
      expect(savedAnnouncement.isActive).toBe(true); // default value
      expect(savedAnnouncement.priority).toBe('medium'); // default value
    });

    it('should require title field', async () => {
      const announcementWithoutTitle = {
        content: 'Content without title',
        author: testUser._id
      };

      const announcement = new Announcement(announcementWithoutTitle);
      
      await expect(announcement.save()).rejects.toThrow('Announcement title is required');
    });

    it('should require content field', async () => {
      const announcementWithoutContent = {
        title: 'Title without content',
        author: testUser._id
      };

      const announcement = new Announcement(announcementWithoutContent);
      
      await expect(announcement.save()).rejects.toThrow('Announcement content is required');
    });

    it('should require author field', async () => {
      const announcementWithoutAuthor = {
        title: 'Test Title',
        content: 'Test Content'
      };

      const announcement = new Announcement(announcementWithoutAuthor);
      
      await expect(announcement.save()).rejects.toThrow();
    });

    it('should trim whitespace from title and content', async () => {
      const announcementWithWhitespace = {
        title: '  Test Announcement  ',
        content: '  This is test content  ',
        author: testUser._id
      };

      const announcement = new Announcement(announcementWithWhitespace);
      const savedAnnouncement = await announcement.save();

      expect(savedAnnouncement.title).toBe('Test Announcement');
      expect(savedAnnouncement.content).toBe('This is test content');
    });

    it('should enforce title character limit', async () => {
      const longTitle = 'A'.repeat(201); // Exceeds 200 character limit
      
      const announcementWithLongTitle = {
        title: longTitle,
        content: 'Valid content',
        author: testUser._id
      };

      const announcement = new Announcement(announcementWithLongTitle);
      
      await expect(announcement.save()).rejects.toThrow('Title cannot exceed 200 characters');
    });

    it('should enforce content character limit', async () => {
      const longContent = 'A'.repeat(5001); // Exceeds 5000 character limit
      
      const announcementWithLongContent = {
        title: 'Valid Title',
        content: longContent,
        author: testUser._id
      };

      const announcement = new Announcement(announcementWithLongContent);
      
      await expect(announcement.save()).rejects.toThrow('Content cannot exceed 5000 characters');
    });

    it('should only allow valid status values', async () => {
      const announcementWithInvalidStatus = {
        title: 'Test Title',
        content: 'Test Content',
        author: testUser._id,
        status: 'invalid_status'
      };

      const announcement = new Announcement(announcementWithInvalidStatus);
      
      await expect(announcement.save()).rejects.toThrow();
    });

    it('should only allow valid priority values', async () => {
      const announcementWithInvalidPriority = {
        title: 'Test Title',
        content: 'Test Content',
        author: testUser._id,
        priority: 'invalid_priority'
      };

      const announcement = new Announcement(announcementWithInvalidPriority);
      
      await expect(announcement.save()).rejects.toThrow();
    });

    it('should set default values correctly', async () => {
      const minimalAnnouncement = {
        title: 'Minimal Announcement',
        content: 'Minimal content',
        author: testUser._id
      };

      const announcement = new Announcement(minimalAnnouncement);
      const savedAnnouncement = await announcement.save();

      expect(savedAnnouncement.status).toBe('active');
      expect(savedAnnouncement.priority).toBe('medium');
      expect(savedAnnouncement.isActive).toBe(true);
      expect(savedAnnouncement.createdAt).toBeDefined();
      expect(savedAnnouncement.updatedAt).toBeDefined();
    });
  });

  describe('Virtual Properties', () => {
    it('should provide formatted date virtual property', async () => {
      const announcement = await Announcement.create({
        title: 'Date Test',
        content: 'Testing formatted date',
        author: testUser._id
      });

      expect(announcement.formattedDate).toBeDefined();
      expect(typeof announcement.formattedDate).toBe('string');
      expect(announcement.formattedDate).toContain('2024'); // Current year
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test announcements with different statuses
      await Announcement.create({
        title: 'Active Announcement 1',
        content: 'Active content 1',
        author: testUser._id,
        status: 'active',
        isActive: true
      });

      await Announcement.create({
        title: 'Active Announcement 2',
        content: 'Active content 2',
        author: testUser._id,
        status: 'active',
        isActive: true,
        priority: 'high'
      });

      await Announcement.create({
        title: 'Inactive Announcement',
        content: 'Inactive content',
        author: testUser._id,
        status: 'inactive',
        isActive: false
      });

      await Announcement.create({
        title: 'Draft Announcement',
        content: 'Draft content',
        author: testUser._id,
        status: 'draft',
        isActive: true
      });
    });

    it('should get only active announcements with getActive method', async () => {
      const activeAnnouncements = await Announcement.getActive();

      expect(activeAnnouncements).toHaveLength(2);
      activeAnnouncements.forEach(announcement => {
        expect(announcement.status).toBe('active');
        expect(announcement.isActive).toBe(true);
      });
    });

    it('should return announcements in chronological order (newest first)', async () => {
      const activeAnnouncements = await Announcement.getActive();

      expect(activeAnnouncements).toHaveLength(2);
      
      // Check if sorted by createdAt descending
      for (let i = 0; i < activeAnnouncements.length - 1; i++) {
        expect(activeAnnouncements[i].createdAt.getTime())
          .toBeGreaterThanOrEqual(activeAnnouncements[i + 1].createdAt.getTime());
      }
    });

    it('should populate author information in getActive method', async () => {
      const activeAnnouncements = await Announcement.getActive();

      expect(activeAnnouncements[0].author).toBeDefined();
      expect(activeAnnouncements[0].author.name || activeAnnouncements[0].author.email).toBeDefined();
    });

    it('should get announcements by priority with getByPriority method', async () => {
      const highPriorityAnnouncements = await Announcement.getByPriority('high');

      expect(highPriorityAnnouncements).toHaveLength(1);
      expect(highPriorityAnnouncements[0].priority).toBe('high');
      expect(highPriorityAnnouncements[0].status).toBe('active');
      expect(highPriorityAnnouncements[0].isActive).toBe(true);
    });

    it('should return empty array for non-existent priority', async () => {
      const urgentAnnouncements = await Announcement.getByPriority('urgent');

      expect(urgentAnnouncements).toHaveLength(0);
    });
  });

  describe('Instance Methods', () => {
    it('should deactivate announcement with deactivate method', async () => {
      const announcement = await Announcement.create({
        title: 'To Deactivate',
        content: 'This will be deactivated',
        author: testUser._id,
        status: 'active',
        isActive: true
      });

      expect(announcement.isActive).toBe(true);
      expect(announcement.status).toBe('active');

      await announcement.deactivate();

      expect(announcement.isActive).toBe(false);
      expect(announcement.status).toBe('inactive');

      // Verify changes are persisted
      const updatedAnnouncement = await Announcement.findById(announcement._id);
      expect(updatedAnnouncement.isActive).toBe(false);
      expect(updatedAnnouncement.status).toBe('inactive');
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes for efficient querying', async () => {
      const indexes = await Announcement.collection.getIndexes();
      
      // Check if required indexes exist
      const indexKeys = Object.keys(indexes);
      
      expect(indexKeys.some(key => key.includes('createdAt'))).toBe(true);
      expect(indexKeys.some(key => key.includes('status') && key.includes('isActive'))).toBe(true);
    });
  });

  describe('Timestamps', () => {
    it('should automatically set createdAt and updatedAt timestamps', async () => {
      const beforeCreate = new Date();
      
      const announcement = await Announcement.create({
        title: 'Timestamp Test',
        content: 'Testing timestamps',
        author: testUser._id
      });

      const afterCreate = new Date();

      expect(announcement.createdAt).toBeDefined();
      expect(announcement.updatedAt).toBeDefined();
      expect(announcement.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(announcement.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(announcement.updatedAt.getTime()).toBeGreaterThanOrEqual(announcement.createdAt.getTime());
    });

    it('should update updatedAt timestamp on modification', async () => {
      const announcement = await Announcement.create({
        title: 'Original Title',
        content: 'Original content',
        author: testUser._id
      });

      const originalUpdatedAt = announcement.updatedAt;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      announcement.title = 'Updated Title';
      await announcement.save();

      expect(announcement.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});