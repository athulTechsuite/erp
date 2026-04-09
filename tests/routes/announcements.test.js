const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const Announcement = require('../../src/models/Announcement');
const announcementRoutes = require('../../src/routes/announcements');
const authMiddleware = require('../../src/middleware/authMiddleware');
const adminMiddleware = require('../../src/middleware/adminMiddleware');

const app = express();
app.use(express.json());
app.use('/api/announcements', announcementRoutes);

describe('Announcement Routes', () => {
  let adminUser, employeeUser, adminToken, employeeToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_announcements');
    
    // Create test users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    adminUser = new User({
      name: 'Admin User',
      email: 'admin@test.com',
      password: hashedPassword,
      role: 'admin'
    });
    await adminUser.save();

    employeeUser = new User({
      name: 'Employee User',
      email: 'employee@test.com',
      password: hashedPassword,
      role: 'employee'
    });
    await employeeUser.save();

    // Generate tokens
    adminToken = jwt.sign(
      { userId: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    employeeToken = jwt.sign(
      { userId: employeeUser._id, role: employeeUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Announcement.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Announcement.deleteMany({});
  });

  describe('GET /api/announcements', () => {
    it('should return announcements for authenticated users', async () => {
      // Create test announcements
      const announcement1 = new Announcement({
        title: 'First Announcement',
        content: 'First content',
        author: adminUser._id
      });
      await announcement1.save();

      const announcement2 = new Announcement({
        title: 'Second Announcement',
        content: 'Second content',
        author: adminUser._id
      });
      await announcement2.save();

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].title).toBe('Second Announcement');
      expect(response.body[1].title).toBe('First Announcement');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/announcements');

      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should only return active announcements', async () => {
      const activeAnnouncement = new Announcement({
        title: 'Active Announcement',
        content: 'Active content',
        author: adminUser._id,
        isActive: true
      });
      await activeAnnouncement.save();

      const inactiveAnnouncement = new Announcement({
        title: 'Inactive Announcement',
        content: 'Inactive content',
        author: adminUser._id,
        isActive: false
      });
      await inactiveAnnouncement.save();

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Active Announcement');
    });

    it('should return empty array when no announcements exist', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });

    it('should order announcements by creation date (newest first)', async () => {
      const announcement1 = new Announcement({
        title: 'First Announcement',
        content: 'First content',
        author: adminUser._id
      });
      await announcement1.save();

      await new Promise(resolve => setTimeout(resolve, 10));

      const announcement2 = new Announcement({
        title: 'Second Announcement',
        content: 'Second content',
        author: adminUser._id
      });
      await announcement2.save();

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(new Date(response.body[0].createdAt)).toBeAfter(new Date(response.body[1].createdAt));
    });
  });

  describe('POST /api/announcements', () => {
    it('should allow admin to create announcements', async () => {
      const announcementData = {
        title: 'New Announcement',
        content: 'This is a new announcement'
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(announcementData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Announcement');
      expect(response.body.data.content).toBe('This is a new announcement');
      expect(response.body.data.author).toBe(adminUser._id.toString());
    });

    it('should deny access to non-admin users', async () => {
      const announcementData = {
        title: 'Employee Announcement',
        content: 'This should not be allowed'
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(announcementData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const announcementData = {
        title: 'Unauthorized Announcement',
        content: 'This should not be allowed'
      };

      const response = await request(app)
        .post('/api/announcements')
        .send(announcementData);

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Title and content are required');
    });

    it('should validate title length', async () => {
      const longTitle = 'A'.repeat(201);
      const announcementData = {
        title: longTitle,
        content: 'Valid content'
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(announcementData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Title must be 200 characters or less');
    });

    it('should validate content length', async () => {
      const longContent = 'A'.repeat(2001);
      const announcementData = {
        title: 'Valid title',
        content: longContent
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(announcementData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Content must be 2000 characters or less');
    });
  });

  describe('PUT /api/announcements/:id', () => {
    let testAnnouncement;

    beforeEach(async () => {
      testAnnouncement = new Announcement({
        title: 'Test Announcement',
        content: 'Test content',
        author: adminUser._id
      });
      await testAnnouncement.save();
    });

    it('should allow admin to update announcements', async () => {
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content'
      };

      const response = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
      expect(response.body.data.content).toBe('Updated content');
    });

    it('should deny access to non-admin users', async () => {
      const updateData = {
        title: 'Employee Update',
        content: 'This should not be allowed'
      };

      const response = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent announcement', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content'
      };

      const response = await request(app)
        .put(`/api/announcements/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Announcement not found');
    });
  });

  describe('DELETE /api/announcements/:id', () => {
    let testAnnouncement;

    beforeEach(async () => {
      testAnnouncement = new Announcement({
        title: 'Test Announcement',
        content: 'Test content',
        author: adminUser._id
      });
      await testAnnouncement.save();
    });

    it('should allow admin to delete announcements', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Announcement deleted successfully');

      // Verify soft delete
      const updatedAnnouncement = await Announcement.findById(testAnnouncement._id);
      expect(updatedAnnouncement.isActive).toBe(false);
    });

    it('should deny access to non-admin users', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent announcement', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/announcements/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Announcement not found');
    });
  });
});