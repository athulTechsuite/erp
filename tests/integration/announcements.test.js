const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Announcement = require('../../src/models/Announcement');
const jwt = require('jsonwebtoken');

describe('Announcements API Integration Tests', () => {
  let mongoServer;
  let adminUser;
  let managerUser;
  let employeeUser;
  let adminToken;
  let managerToken;
  let employeeToken;
  let testAnnouncement;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test users
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });

    managerUser = await User.create({
      name: 'Manager User',
      email: 'manager@test.com',
      password: 'password123',
      role: 'manager'
    });

    employeeUser = await User.create({
      name: 'Employee User',
      email: 'employee@test.com',
      password: 'password123',
      role: 'employee'
    });

    // Generate tokens
    adminToken = jwt.sign({ userId: adminUser._id, role: 'admin' }, process.env.JWT_SECRET || 'test-secret');
    managerToken = jwt.sign({ userId: managerUser._id, role: 'manager' }, process.env.JWT_SECRET || 'test-secret');
    employeeToken = jwt.sign({ userId: employeeUser._id, role: 'employee' }, process.env.JWT_SECRET || 'test-secret');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Announcement.deleteMany({});
    
    // Create a test announcement
    testAnnouncement = await Announcement.create({
      title: 'Test Announcement',
      content: 'This is a test announcement for integration testing.',
      createdBy: adminUser._id
    });
  });

  describe('GET /api/announcements', () => {
    // Test Case 4: Dashboard widget displays announcements for all authenticated users
    it('should return announcements for authenticated admin user', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Test Announcement');
    });

    it('should return announcements for authenticated manager user', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return announcements for authenticated employee user', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/announcements');

      expect(response.status).toBe(401);
    });

    it('should return announcements in chronological order (newest first)', async () => {
      // Create additional announcements with different timestamps
      const olderAnnouncement = await Announcement.create({
        title: 'Older Announcement',
        content: 'This is an older announcement.',
        createdBy: adminUser._id,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      });

      const newerAnnouncement = await Announcement.create({
        title: 'Newer Announcement',
        content: 'This is a newer announcement.',
        createdBy: adminUser._id
      });

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].title).toBe('Newer Announcement');
      expect(response.body.data[2].title).toBe('Older Announcement');
    });

    it('should only return active announcements', async () => {
      // Create an inactive announcement
      await Announcement.create({
        title: 'Inactive Announcement',
        content: 'This announcement is inactive.',
        createdBy: adminUser._id,
        isActive: false
      });

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1); // Should only return the active one
      expect(response.body.data[0].title).toBe('Test Announcement');
    });
  });

  describe('POST /api/announcements', () => {
    const validAnnouncementData = {
      title: 'New Test Announcement',
      content: 'This is a new announcement created via API testing.'
    };

    // Test Case 1: Admin can create announcements
    // Test Case 2: Announcement is saved and displayed
    it('should allow admin to create new announcement', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validAnnouncementData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(validAnnouncementData.title);
      expect(response.body.data.content).toBe(validAnnouncementData.content);
      expect(response.body.data.createdBy).toBe(adminUser._id.toString());

      // Verify announcement was saved in database
      const savedAnnouncement = await Announcement.findById(response.body.data._id);
      expect(savedAnnouncement).toBeTruthy();
      expect(savedAnnouncement.title).toBe(validAnnouncementData.title);
    });

    // Test Case 6: Non-admin users cannot create announcements
    it('should deny manager user from creating announcements', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validAnnouncementData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });

    it('should deny employee user from creating announcements', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(validAnnouncementData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
    });

    // Test Case 7: Form validation errors
    it('should return validation error for missing title', async () => {
      const invalidData = {
        content: 'This announcement has no title.'
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          path: 'title',
          msg: expect.stringContaining('required')
        })
      );
    });

    it('should return validation error for missing content', async () => {
      const invalidData = {
        title: 'Title without content'
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          path: 'content',
          msg: expect.stringContaining('required')
        })
      );
    });

    it('should return validation error for title too short', async () => {
      const invalidData = {
        title: 'AB', // Less than 3 characters
        content: 'This title is too short for validation.'
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          path: 'title',
          msg: expect.stringContaining('3 and 200 characters')
        })
      );
    });

    it('should return validation error for content too short', async () => {
      const invalidData = {
        title: 'Valid Title',
        content: 'Short' // Less than 10 characters
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          path: 'content',
          msg: expect.stringContaining('10 and 5000 characters')
        })
      );
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .send(validAnnouncementData);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/announcements/:id', () => {
    // Test Case 1: Admin can delete announcements
    // Test Case 5: Announcement is permanently removed
    it('should allow admin to delete announcement', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify announcement was removed from database
      const deletedAnnouncement = await Announcement.findById(testAnnouncement._id);
      expect(deletedAnnouncement).toBeFalsy();
    });

    // Test Case 6: Non-admin users cannot delete announcements
    it('should deny manager user from deleting announcements', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');

      // Verify announcement still exists
      const existingAnnouncement = await Announcement.findById(testAnnouncement._id);
      expect(existingAnnouncement).toBeTruthy();
    });

    it('should deny employee user from deleting announcements', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');

      // Verify announcement still exists
      const existingAnnouncement = await Announcement.findById(testAnnouncement._id);
      expect(existingAnnouncement).toBeTruthy();
    });

    it('should return 404 for non-existent announcement', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/announcements/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid announcement ID', async () => {
      const response = await request(app)
        .delete('/api/announcements/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/announcements/recent', () => {
    it('should return recent announcements with limit', async () => {
      // Create multiple announcements
      await Announcement.create({
        title: 'Announcement 1',
        content: 'Content 1',
        createdBy: adminUser._id
      });
      await Announcement.create({
        title: 'Announcement 2',
        content: 'Content 2',
        createdBy: adminUser._id
      });

      const response = await request(app)
        .get('/api/announcements/recent?limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });
  });
});