const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Announcement = require('../../src/models/Announcement');
const User = require('../../src/models/User');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

describe('Company Announcements System - Integration Tests', () => {
  let adminUser, managerUser, employeeUser;
  let adminToken, managerToken, employeeToken;
  let testImagePath;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.TEST_DB_URL || 'mongodb://localhost:27017/erp_test');
    
    // Create test users
    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      role: 'admin',
      password: 'hashedpassword'
    });

    managerUser = await User.create({
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@test.com',
      role: 'manager',
      password: 'hashedpassword'
    });

    employeeUser = await User.create({
      firstName: 'Employee',
      lastName: 'User',
      email: 'employee@test.com',
      role: 'employee',
      password: 'hashedpassword'
    });

    // Generate JWT tokens
    adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET || 'test-secret');
    managerToken = jwt.sign({ id: managerUser._id, role: 'manager' }, process.env.JWT_SECRET || 'test-secret');
    employeeToken = jwt.sign({ id: employeeUser._id, role: 'employee' }, process.env.JWT_SECRET || 'test-secret');

    // Create test image file
    testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');
    if (!fs.existsSync(testImagePath)) {
      // Create a minimal test image file
      fs.writeFileSync(testImagePath, Buffer.from('fake-image-data'));
    }
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Announcement.deleteMany({});
    await mongoose.connection.close();
    
    // Clean up test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  beforeEach(async () => {
    // Clean announcements before each test
    await Announcement.deleteMany({});
  });

  // TC-001: Integration tests for announcement CRUD operations
  describe('TC-001: Announcement CRUD Operations Integration Tests', () => {
    describe('CREATE operations - Happy Path', () => {
      test('should successfully create announcement with valid data', async () => {
        const announcementData = {
          title: 'Company Meeting',
          content: 'All staff meeting scheduled for tomorrow at 10 AM'
        };

        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(announcementData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('title', announcementData.title);
        expect(response.body.data).toHaveProperty('content', announcementData.content);
        expect(response.body.data).toHaveProperty('createdBy');

        // Verify in database
        const savedAnnouncement = await Announcement.findById(response.body.data._id);
        expect(savedAnnouncement).toBeTruthy();
        expect(savedAnnouncement.title).toBe(announcementData.title);
      });

      test('should successfully create announcement with image attachment', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .field('title', 'Holiday Notice')
          .field('content', 'Office will be closed next Friday')
          .attach('image', testImagePath);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('title', 'Holiday Notice');
        expect(response.body.data).toHaveProperty('imageUrl');
        expect(response.body.data.imageUrl).toContain('announcement-');
      });
    });

    describe('CREATE operations - Error Path', () => {
      test('should fail to create announcement with missing required fields', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Only Title' }); // Missing content

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body).toHaveProperty('message');
      });

      test('should fail to create announcement with unauthorized user', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            title: 'Unauthorized Attempt',
            content: 'This should fail'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      test('should fail to create announcement with invalid image format', async () => {
        const textFilePath = path.join(__dirname, '../fixtures/test.txt');
        fs.writeFileSync(textFilePath, 'This is not an image');

        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .field('title', 'Test')
          .field('content', 'Test content')
          .attach('image', textFilePath);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
        
        fs.unlinkSync(textFilePath);
      });
    });

    describe('READ operations - Happy Path', () => {
      beforeEach(async () => {
        await Announcement.create([
          {
            title: 'Test Announcement 1',
            content: 'Content 1',
            createdBy: adminUser._id
          },
          {
            title: 'Test Announcement 2',
            content: 'Content 2',
            createdBy: adminUser._id
          }
        ]);
      });

      test('should successfully retrieve all announcements for admin', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0]).toHaveProperty('title');
        expect(response.body.data[0]).toHaveProperty('content');
      });

      test('should successfully retrieve announcements for employee', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
      });

      test('should return empty array when no announcements exist', async () => {
        await Announcement.deleteMany({});

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(0);
      });
    });

    describe('READ operations - Error Path', () => {
      test('should fail to retrieve announcements without authentication', async () => {
        const response = await request(app)
          .get('/api/announcements');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      });

      test('should fail to retrieve announcements with invalid token', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('DELETE operations - Happy Path', () => {
      let testAnnouncement;

      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Test Announcement',
          content: 'This will be deleted',
          createdBy: adminUser._id
        });
      });

      test('should successfully delete announcement as admin', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('message');

        // Verify deletion in database
        const deletedAnnouncement = await Announcement.findById(testAnnouncement._id);
        expect(deletedAnnouncement).toBeNull();
      });
    });

    describe('DELETE operations - Error Path', () => {
      let testAnnouncement;

      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Protected Announcement',
          content: 'Cannot be deleted by non-admin',
          createdBy: adminUser._id
        });
      });

      test('should fail to delete announcement with non-admin user', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);

        // Verify announcement still exists
        const stillExists = await Announcement.findById(testAnnouncement._id);
        expect(stillExists).toBeTruthy();
      });

      test('should fail to delete non-existent announcement', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const response = await request(app)
          .delete(`/api/announcements/${fakeId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      test('should fail to delete announcement with invalid ID format', async () => {
        const response = await request(app)
          .delete('/api/announcements/invalid-id')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('AC1: Admin can see Create Announcement button and list existing announcements', () => {
    test('should display Create Announcement button for admin users', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should return empty list when no announcements exist', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    test('should return list of existing announcements', async () => {
      // Create test announcements
      await Announcement.create([
        {
          title: 'Test Announcement 1',
          content: 'Content 1',
          createdBy: adminUser._id
        },
        {
          title: 'Test Announcement 2',
          content: 'Content 2',
          createdBy: adminUser._id
        }
      ]);

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('title');
      expect(response.body.data[0]).toHaveProperty('content');
      expect(response.body.data[0]).toHaveProperty('createdBy');
    });
  });

  describe('AC2: Admin can create announcements with text and image', () => {
    test('should create announcement with text only', async () => {
      const announcementData = {
        title: 'Company Meeting',
        content: 'All staff meeting scheduled for tomorrow at 10 AM'
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(announcementData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('title', announcementData.title);
      expect(response.body.data).toHaveProperty('content', announcementData.content);
      expect(response.body.data).toHaveProperty('createdBy');

      // Verify in database
      const savedAnnouncement = await Announcement.findById(response.body.data._id);
      expect(savedAnnouncement).toBeTruthy();
      expect(savedAnnouncement.title).toBe(announcementData.title);
    });

    test('should create announcement with text and image', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Holiday Notice')
        .field('content', 'Office will be closed next Friday')
        .attach('image', testImagePath);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('title', 'Holiday Notice');
      expect(response.body.data).toHaveProperty('imageUrl');
      expect(response.body.data.imageUrl).toContain('announcement-');
    });

    test('should reject creation with missing required fields', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Only Title' }); // Missing content

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('message');
    });

    test('should reject invalid image formats', async () => {
      const textFilePath = path.join(__dirname, '../fixtures/test.txt');
      fs.writeFileSync(textFilePath, 'This is not an image');

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Test')
        .field('content', 'Test content')
        .attach('image', textFilePath);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      
      fs.unlinkSync(textFilePath);
    });
  });

  describe('AC3: All authenticated users can view announcements on dashboard', () => {
    beforeEach(async () => {
      await Announcement.create({
        title: 'Company Update',
        content: 'Important company announcement',
        createdBy: adminUser._id
      });
    });

    test('should allow admin to view announcements', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('title', 'Company Update');
    });

    test('should allow manager to view announcements', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('title', 'Company Update');
    });

    test('should allow employee to view announcements', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('title', 'Company Update');
    });

    test('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/announcements');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('AC4: Admin can delete announcements', () => {
    let testAnnouncement;

    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'Test Announcement',
        content: 'This will be deleted',
        createdBy: adminUser._id
      });
    });

    test('should allow admin to delete announcement', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('message');

      // Verify deletion in database
      const deletedAnnouncement = await Announcement.findById(testAnnouncement._id);
      expect(deletedAnnouncement).toBeNull();
    });

    test('should return 404 for non-existent announcement', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/announcements/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 for invalid announcement ID', async () => {
      const response = await request(app)
        .delete('/api/announcements/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('AC5: Non-admin users cannot access management features', () => {
    test('should prevent manager from creating announcements', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Unauthorized Attempt',
          content: 'This should fail'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('message');
    });

    test('should prevent employee from creating announcements', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Unauthorized Attempt',
          content: 'This should fail'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('should prevent non-admin from deleting announcements', async () => {
      const testAnnouncement = await Announcement.create({
        title: 'Protected Announcement',
        content: 'Cannot be deleted by non-admin',
        createdBy: adminUser._id
      });

      const managerResponse = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(managerResponse.status).toBe(403);

      const employeeResponse = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(employeeResponse.status).toBe(403);

      // Verify announcement still exists
      const stillExists = await Announcement.findById(testAnnouncement._id);
      expect(stillExists).toBeTruthy();
    });
  });

  describe('AC6: Announcements with text and image render properly', () => {
    test('should return announcement with image URL when image exists', async () => {
      // Create announcement with image
      const createResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Visual Announcement')
        .field('content', 'This has an image attachment')
        .attach('image', testImagePath);

      expect(createResponse.status).toBe(201);

      // Fetch announcements
      const getResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(200);
      const announcement = getResponse.body.data[0];
      expect(announcement).toHaveProperty('title', 'Visual Announcement');
      expect(announcement).toHaveProperty('content', 'This has an image attachment');
      expect(announcement).toHaveProperty('imageUrl');
      expect(announcement.imageUrl).toMatch(/\/uploads\/announcement-.*\.(jpg|jpeg|png|gif)$/i);
    });

    test('should return announcement with null imageUrl when no image', async () => {
      const createResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Text Only Announcement',
          content: 'This has no image'
        });

      expect(createResponse.status).toBe(201);

      const getResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      const announcement = getResponse.body.data[0];
      expect(announcement).toHaveProperty('title', 'Text Only Announcement');
      expect(announcement).toHaveProperty('content', 'This has no image');
      expect(announcement.imageUrl).toBeNull();
    });
  });

  describe('AC7: Error handling and system stability', () => {
    test('should handle database connection errors gracefully', async () => {
      // Temporarily close database connection
      await mongoose.connection.close();

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      // Reconnect for other tests
      await mongoose.connect(process.env.TEST_DB_URL || 'mongodb://localhost:27017/erp_test');
    });

    test('should handle file upload errors gracefully', async () => {
      // Try to upload oversized file (simulate by sending large data)
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Large File Test')
        .field('content', 'Testing large file upload')
        .attach('image', Buffer.alloc(6 * 1024 * 1024), 'large-file.jpg'); // 6MB file

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should validate input data and return clear error messages', async () => {
      // Test with empty title
      const response1 = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '',
          content: 'Valid content'
        });

      expect(response1.status).toBe(400);
      expect(response1.body).toHaveProperty('message');

      // Test with extremely long title
      const response2 = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'x'.repeat(201), // Exceeds 200 character limit
          content: 'Valid content'
        });

      expect(response2.status).toBe(400);
      expect(response2.body).toHaveProperty('message');
    });

    test('should maintain system stability during concurrent operations', async () => {
      const concurrentRequests = [];
      
      // Create multiple announcements concurrently
      for (let i = 0; i < 5; i++) {
        concurrentRequests.push(
          request(app)
            .post('/api/announcements')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              title: `Concurrent Announcement ${i}`,
              content: `Content for announcement ${i}`
            })
        );
      }

      const responses = await Promise.all(concurrentRequests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all announcements were created
      const allAnnouncements = await Announcement.find({});
      expect(allAnnouncements).toHaveLength(5);
    });
  });

  describe('Dashboard Integration', () => {
    test('should include announcements in dashboard data', async () => {
      // Create test announcement
      await Announcement.create({
        title: 'Dashboard Announcement',
        content: 'Should appear on dashboard',
        createdBy: adminUser._id
      });

      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('announcements');
      expect(response.body.announcements).toHaveLength(1);
      expect(response.body.announcements[0]).toHaveProperty('title', 'Dashboard Announcement');
    });

    test('should order announcements by creation date (newest first)', async () => {
      // Create multiple announcements with slight delay
      await Announcement.create({
        title: 'First Announcement',
        content: 'Created first',
        createdBy: adminUser._id
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await Announcement.create({
        title: 'Second Announcement',
        content: 'Created second',
        createdBy: adminUser._id
      });

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].title).toBe('Second Announcement');
      expect(response.body.data[1].title).toBe('First Announcement');
    });
  });
});