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
      role: 'admin',
      password: 'hashedpassword'
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

  describe('Schema Validation', () => {
    test('should create valid announcement with required fields', async () => {
      const announcementData = {
        title: 'Test Announcement',
        content: 'This is a test announcement content',
        createdBy: testUser._id
      };

      const announcement = new Announcement(announcementData);
      await announcement.save();

      expect(announcement._id).toBeDefined();
      expect(announcement.title).toBe(announcementData.title);
      expect(announcement.content).toBe(announcementData.content);
      expect(announcement.createdBy.toString()).toBe(testUser._id.toString());
      expect(announcement.isActive).toBe(true); // default value
      expect(announcement.priority).toBe('medium'); // default value
      expect(announcement.targetAudience).toEqual(['all']); // default value
    });

    test('should fail validation when title is missing', async () => {
      const announcement = new Announcement({
        content: 'Content without title',
        createdBy: testUser._id
      });

      await expect(announcement.save()).rejects.toThrow('Path `title` is required');
    });

    test('should fail validation when content is missing', async () => {
      const announcement = new Announcement({
        title: 'Title without content',
        createdBy: testUser._id
      });

      await expect(announcement.save()).rejects.toThrow('Path `content` is required');
    });

    test('should fail validation when createdBy is missing', async () => {
      const announcement = new Announcement({
        title: 'Test Title',
        content: 'Test content'
      });

      await expect(announcement.save()).rejects.toThrow('Path `createdBy` is required');
    });

    test('should fail validation when title exceeds maximum length', async () => {
      const longTitle = 'x'.repeat(201); // Exceeds 200 character limit
      const announcement = new Announcement({
        title: longTitle,
        content: 'Valid content',
        createdBy: testUser._id
      });

      await expect(announcement.save()).rejects.toThrow();
    });

    test('should fail validation when content exceeds maximum length', async () => {
      const longContent = 'x'.repeat(2001); // Exceeds 2000 character limit
      const announcement = new Announcement({
        title: 'Valid title',
        content: longContent,
        createdBy: testUser._id
      });

      await expect(announcement.save()).rejects.toThrow();
    });

    test('should validate imageUrl format', async () => {
      const validImageUrls = [
        'https://example.com/image.jpg',
        'http://example.com/photo.jpeg',
        'https://cdn.example.com/pic.png',
        'https://example.com/animated.gif',
        'https://example.com/modern.webp'
      ];

      for (const url of validImageUrls) {
        const announcement = new Announcement({
          title: 'Test with Image',
          content: 'Content with image',
          imageUrl: url,
          createdBy: testUser._id
        });

        await expect(announcement.save()).resolves.toBeDefined();
        await announcement.deleteOne();
      }
    });

    test('should reject invalid imageUrl formats', async () => {
      const invalidImageUrls = [
        'not-a-url',
        'https://example.com/file.pdf',
        'ftp://example.com/image.jpg',
        'https://example.com/image.txt',
        'javascript:alert("xss")'
      ];

      for (const url of invalidImageUrls) {
        const announcement = new Announcement({
          title: 'Test with Invalid Image',
          content: 'Content with invalid image',
          imageUrl: url,
          createdBy: testUser._id
        });

        await expect(announcement.save()).rejects.toThrow('Invalid image URL format');
      }
    });

    test('should accept valid priority values', async () => {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];

      for (const priority of validPriorities) {
        const announcement = new Announcement({
          title: 'Test Priority',
          content: 'Testing priority field',
          priority: priority,
          createdBy: testUser._id
        });

        await announcement.save();
        expect(announcement.priority).toBe(priority);
        await announcement.deleteOne();
      }
    });

    test('should reject invalid priority values', async () => {
      const announcement = new Announcement({
        title: 'Test Invalid Priority',
        content: 'Testing invalid priority',
        priority: 'invalid-priority',
        createdBy: testUser._id
      });

      await expect(announcement.save()).rejects.toThrow();
    });

    test('should accept valid targetAudience values', async () => {
      const validAudiences = [
        ['all'],
        ['admin'],
        ['manager'],
        ['employee'],
        ['admin', 'manager'],
        ['all', 'admin', 'manager', 'employee']
      ];

      for (const audience of validAudiences) {
        const announcement = new Announcement({
          title: 'Test Audience',
          content: 'Testing audience field',
          targetAudience: audience,
          createdBy: testUser._id
        });

        await announcement.save();
        expect(announcement.targetAudience).toEqual(audience);
        await announcement.deleteOne();
      }
    });
  });

  describe('Virtual Properties', () => {
    test('should calculate isExpired virtual property correctly', async () => {
      // Create announcement that expires in future
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const futureAnnouncement = new Announcement({
        title: 'Future Expiry',
        content: 'This expires in the future',
        expiresAt: futureDate,
        createdBy: testUser._id
      });
      await futureAnnouncement.save();

      expect(futureAnnouncement.isExpired).toBe(false);

      // Create announcement that expired in past
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const pastAnnouncement = new Announcement({
        title: 'Past Expiry',
        content: 'This expired in the past',
        expiresAt: pastDate,
        createdBy: testUser._id
      });
      await pastAnnouncement.save();

      expect(pastAnnouncement.isExpired).toBe(true);

      // Create announcement with no expiry
      const noExpiryAnnouncement = new Announcement({
        title: 'No Expiry',
        content: 'This never expires',
        createdBy: testUser._id
      });
      await noExpiryAnnouncement.save();

      expect(noExpiryAnnouncement.isExpired).toBe(false);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test announcements
      await Announcement.create([
        {
          title: 'Active All Audiences',
          content: 'Active for all',
          isActive: true,
          targetAudience: ['all'],
          priority: 'high',
          createdBy: testUser._id
        },
        {
          title: 'Active Admin Only',
          content: 'Active for admins',
          isActive: true,
          targetAudience: ['admin'],
          priority: 'medium',
          createdBy: testUser._id
        },
        {
          title: 'Inactive Announcement',
          content: 'This is inactive',
          isActive: false,
          targetAudience: ['all'],
          createdBy: testUser._id
        },
        {
          title: 'Expired Announcement',
          content: 'This is expired',
          isActive: true,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired
          targetAudience: ['all'],
          createdBy: testUser._id
        },
        {
          title: 'Future Expiry',
          content: 'This expires in future',
          isActive: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // future
          targetAudience: ['manager'],
          priority: 'low',
          createdBy: testUser._id
        }
      ]);
    });

    test('should get all active announcements for all users', async () => {
      const activeAnnouncements = await Announcement.getActiveAnnouncements();
      
      expect(activeAnnouncements).toHaveLength(3); // Active + not expired
      
      const titles = activeAnnouncements.map(a => a.title);
      expect(titles).toContain('Active All Audiences');
      expect(titles).toContain('Active Admin Only');
      expect(titles).toContain('Future Expiry');
      expect(titles).not.toContain('Inactive Announcement');
      expect(titles).not.toContain('Expired Announcement');
    });

    test('should filter announcements by user role', async () => {
      const adminAnnouncements = await Announcement.getActiveAnnouncements('admin');
      const managerAnnouncements = await Announcement.getActiveAnnouncements('manager');
      
      // Admin should see all + admin-specific
      expect(adminAnnouncements).toHaveLength(2);
      const adminTitles = adminAnnouncements.map(a => a.title);
      expect(adminTitles).toContain('Active All Audiences');
      expect(adminTitles).toContain('Active Admin Only');
      
      // Manager should see all + manager-specific
      expect(managerAnnouncements).toHaveLength(2);
      const managerTitles = managerAnnouncements.map(a => a.title);
      expect(managerTitles).toContain('Active All Audiences');
      expect(managerTitles).toContain('Future Expiry');
    });

    test('should sort announcements by priority and creation date', async () => {
      const announcements = await Announcement.getActiveAnnouncements();
      
      // Should be sorted by priority (high > medium > low) then by creation date
      expect(announcements[0].priority).toBe('high');
      expect(announcements[0].title).toBe('Active All Audiences');
    });

    test('should populate createdBy field', async () => {
      const announcements = await Announcement.getActiveAnnouncements();
      
      expect(announcements[0].createdBy).toBeDefined();
      expect(announcements[0].createdBy.firstName).toBe('Test');
      expect(announcements[0].createdBy.lastName).toBe('User');
      expect(announcements[0].createdBy.email).toBe('test@example.com');
    });
  });

  describe('Indexing', () => {
    test('should have proper indexes for performance', async () => {
      const indexes = await Announcement.collection.getIndexes();
      
      // Check for compound index on isActive and createdAt
      const isActiveIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => 
          field[0] === 'isActive' && field[1] === 1
        )
      );
      expect(isActiveIndex).toBeDefined();

      // Check for index on expiresAt
      const expiresAtIndex = Object.keys(indexes).find(key => 
        indexes[key].some(field => field[0] === 'expiresAt')
      );
      expect(expiresAtIndex).toBeDefined();
    });
  });

  describe('Timestamps', () => {
    test('should automatically set createdAt and updatedAt', async () => {
      const announcement = new Announcement({
        title: 'Timestamp Test',
        content: 'Testing timestamps',
        createdBy: testUser._id
      });

      const beforeSave = new Date();
      await announcement.save();
      const afterSave = new Date();

      expect(announcement.createdAt).toBeDefined();
      expect(announcement.updatedAt).toBeDefined();
      expect(announcement.createdAt.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
      expect(announcement.createdAt.getTime()).toBeLessThanOrEqual(afterSave.getTime());
    });

    test('should update updatedAt on document update', async () => {
      const announcement = await Announcement.create({
        title: 'Update Test',
        content: 'Testing updates',
        createdBy: testUser._id
      });

      const originalUpdatedAt = announcement.updatedAt;
      
      // Wait a moment then update
      await new Promise(resolve => setTimeout(resolve, 10));
      
      announcement.title = 'Updated Title';
      await announcement.save();

      expect(announcement.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('JSON Serialization', () => {
    test('should include virtual fields in JSON output', async () => {
      const announcement = await Announcement.create({
        title: 'JSON Test',
        content: 'Testing JSON serialization',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: testUser._id
      });

      const json = announcement.toJSON();
      expect(json).toHaveProperty('isExpired');
      expect(json.isExpired).toBe(false);
    });
  });
});