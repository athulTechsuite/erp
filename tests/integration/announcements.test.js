const request = require('supertest');
const app = require('../../server');
const db = require('../../src/config/database');
const User = require('../../src/models/User');
const Announcement = require('../../src/models/Announcement');

describe('Company Announcements System Integration Tests', () => {
  let adminToken, employeeToken, managerToken;
  let adminUser, employeeUser, managerUser;
  let testAnnouncement;

  beforeAll(async () => {
    // Setup test users
    adminUser = await User.create({
      username: 'admin_test',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });

    employeeUser = await User.create({
      username: 'employee_test',
      email: 'employee@test.com',
      password: 'password123',
      role: 'employee'
    });

    managerUser = await User.create({
      username: 'manager_test',
      email: 'manager@test.com',
      password: 'password123',
      role: 'manager'
    });

    // Generate tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    adminToken = adminLogin.body.token;

    const employeeLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@test.com', password: 'password123' });
    employeeToken = employeeLogin.body.token;

    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: 'password123' });
    managerToken = managerLogin.body.token;
  });

  afterAll(async () => {
    await Announcement.deleteMany({});
    await User.deleteMany({ username: { $in: ['admin_test', 'employee_test', 'manager_test'] } });
  });

  beforeEach(async () => {
    await Announcement.deleteMany({});
  });

  describe('PRD Test Case 1: Admin user navigates to announcements management', () => {
    test('should show announcement creation form for admin user', async () => {
      const response = await request(app)
        .get('/api/announcements/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.arrayContaining([]));
    });

    test('should allow admin to access announcement creation endpoint', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test Announcement',
          content: 'This is a test announcement content'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Announcement');
    });
  });

  describe('PRD Test Case 2: Admin creates and publishes new announcement', () => {
    test('should save announcement to database and make it visible immediately', async () => {
      const announcementData = {
        title: 'Company Update',
        content: 'Important company-wide update for all employees'
      };

      // Create announcement
      const createResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(announcementData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);
      testAnnouncement = createResponse.body.data;

      // Verify it's immediately visible to employees
      const dashboardResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(dashboardResponse.status).toBe(200);
      const announcements = dashboardResponse.body;
      expect(announcements).toHaveLength(1);
      expect(announcements[0].title).toBe('Company Update');
      expect(announcements[0].content).toBe('Important company-wide update for all employees');
    });

    test('should validate required fields when creating announcement', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation errors');
    });
  });

  describe('PRD Test Case 3: Employee views announcements on dashboard', () => {
    beforeEach(async () => {
      // Create test announcements
      await Announcement.create({
        title: 'First Announcement',
        content: 'First announcement content',
        createdBy: adminUser._id,
        isActive: true
      });

      await Announcement.create({
        title: 'Second Announcement',
        content: 'Second announcement content',
        createdBy: adminUser._id,
        isActive: true
      });
    });

    test('should display all active announcements with title, content, and publish date', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      
      response.body.forEach(announcement => {
        expect(announcement).toHaveProperty('title');
        expect(announcement).toHaveProperty('content');
        expect(announcement).toHaveProperty('created_at');
        expect(announcement.title).toBeTruthy();
        expect(announcement.content).toBeTruthy();
      });
    });

    test('should sort announcements by creation date (newest first)', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      const announcements = response.body;
      
      for (let i = 0; i < announcements.length - 1; i++) {
        const current = new Date(announcements[i].created_at);
        const next = new Date(announcements[i + 1].created_at);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });
  });

  describe('PRD Test Case 4: Non-admin user access restrictions', () => {
    test('should deny employee access to announcement creation interface', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Unauthorized Announcement',
          content: 'This should not be allowed'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. Admin privileges required.');
    });

    test('should deny manager access to announcement creation interface', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Manager Announcement',
          content: 'Manager trying to create announcement'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. Admin privileges required.');
    });

    test('should deny employee access to admin announcement management', async () => {
      const response = await request(app)
        .get('/api/announcements/admin')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied. Admin privileges required.');
    });
  });

  describe('PRD Test Case 5: Admin edits and deletes announcements', () => {
    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'Original Title',
        content: 'Original content',
        createdBy: adminUser._id,
        isActive: true
      });
    });

    test('should allow admin to edit announcement content', async () => {
      const updatedData = {
        title: 'Updated Title',
        content: 'Updated content with new information'
      };

      const response = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify changes are reflected immediately
      const dashboardResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(dashboardResponse.body[0].title).toBe('Updated Title');
      expect(dashboardResponse.body[0].content).toBe('Updated content with new information');
    });

    test('should allow admin to delete announcement', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify announcement is no longer visible
      const dashboardResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(dashboardResponse.body).toHaveLength(0);
    });

    test('should return 404 when trying to edit non-existent announcement', async () => {
      const response = await request(app)
        .put('/api/announcements/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated', content: 'Updated content' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PRD Test Case 6: No announcements scenario', () => {
    test('should return empty array when no active announcements exist', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('should not display inactive announcements to employees', async () => {
      await Announcement.create({
        title: 'Inactive Announcement',
        content: 'This should not be visible',
        createdBy: adminUser._id,
        isActive: false
      });

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('Authentication and Authorization Edge Cases', () => {
    test('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/announcements');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    test('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('Data Validation Tests', () => {
    test('should validate announcement title length', async () => {
      const longTitle = 'A'.repeat(201);
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: longTitle,
          content: 'Valid content'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should validate announcement content length', async () => {
      const longContent = 'A'.repeat(5001);
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Valid title',
          content: longContent
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});