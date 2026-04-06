const request = require('supertest');
const app = require('../../server');
const db = require('../../src/config/database');
const User = require('../../src/models/User');
const Announcement = require('../../src/models/Announcement');

describe('TC-006: Integration tests for announcement endpoints', () => {
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

  describe('TC-006-HP-001: GET /api/announcements - Happy Path', () => {
    test('should return all active announcements for authenticated users', async () => {
      // Create test announcements
      await Announcement.create({
        title: 'Active Announcement',
        content: 'This is active content',
        createdBy: adminUser._id,
        isActive: true
      });

      await Announcement.create({
        title: 'Inactive Announcement',
        content: 'This is inactive content',
        createdBy: adminUser._id,
        isActive: false
      });

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Active Announcement');
      expect(response.body[0].isActive).toBe(true);
    });

    test('should return announcements sorted by creation date (newest first)', async () => {
      // Create announcements with slight delay to ensure different timestamps
      const first = await Announcement.create({
        title: 'First Announcement',
        content: 'First content',
        createdBy: adminUser._id,
        isActive: true
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const second = await Announcement.create({
        title: 'Second Announcement',
        content: 'Second content',
        createdBy: adminUser._id,
        isActive: true
      });

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].title).toBe('Second Announcement');
      expect(response.body[1].title).toBe('First Announcement');
    });

    test('should return empty array when no active announcements exist', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('TC-006-EP-001: GET /api/announcements - Error Path', () => {
    test('should return 401 when no authentication token provided', async () => {
      const response = await request(app)
        .get('/api/announcements');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    test('should return 403 when invalid token provided', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    test('should handle database query failures gracefully', async () => {
      const originalFind = Announcement.find;
      Announcement.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockRejectedValue(new Error('Database query failed'))
        })
      });

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to fetch announcements');

      Announcement.find = originalFind;
    });
  });

  describe('TC-006-HP-002: POST /api/announcements - Happy Path', () => {
    test('should create new announcement with valid data and admin token', async () => {
      const announcementData = {
        title: 'New Company Policy',
        content: 'Please review the updated company policy effective immediately'
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(announcementData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(announcementData.title);
      expect(response.body.data.content).toBe(announcementData.content);
      expect(response.body.data.createdBy).toBe(adminUser._id.toString());
      expect(response.body.data.isActive).toBe(true);
    });

    test('should make newly created announcement immediately visible to all users', async () => {
      const announcementData = {
        title: 'Urgent Update',
        content: 'Important information for all staff members'
      };

      const createResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(announcementData);

      expect(createResponse.status).toBe(201);

      const viewResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(viewResponse.status).toBe(200);
      expect(viewResponse.body).toHaveLength(1);
      expect(viewResponse.body[0].title).toBe('Urgent Update');
    });
  });

  describe('TC-006-EP-002: POST /api/announcements - Error Path', () => {
    test('should return 403 when non-admin user attempts to create announcement', async () => {
      const announcementData = {
        title: 'Unauthorized Announcement',
        content: 'This should not be allowed'
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(announcementData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. Admin privileges required.');
    });

    test('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation errors');
    });

    test('should return 400 when title exceeds maximum length', async () => {
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

    test('should handle database save failures during creation', async () => {
      const originalCreate = Announcement.create;
      Announcement.create = jest.fn().mockRejectedValue(new Error('Database save failed'));

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test Announcement',
          content: 'Test content'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to create announcement');

      Announcement.create = originalCreate;
    });
  });

  describe('TC-006-HP-003: PUT /api/announcements/:id - Happy Path', () => {
    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'Original Title',
        content: 'Original content',
        createdBy: adminUser._id,
        isActive: true
      });
    });

    test('should update announcement with valid data and admin token', async () => {
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
      expect(response.body.data.title).toBe(updatedData.title);
      expect(response.body.data.content).toBe(updatedData.content);
    });

    test('should immediately reflect changes to all users after update', async () => {
      const updatedData = {
        title: 'Immediately Updated',
        content: 'This change should be visible right away'
      };

      await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedData);

      const viewResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(viewResponse.body[0].title).toBe('Immediately Updated');
    });
  });

  describe('TC-006-EP-003: PUT /api/announcements/:id - Error Path', () => {
    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'Test Title',
        content: 'Test content',
        createdBy: adminUser._id,
        isActive: true
      });
    });

    test('should return 403 when non-admin user attempts to update announcement', async () => {
      const response = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ title: 'Unauthorized Update' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. Admin privileges required.');
    });

    test('should return 404 when trying to update non-existent announcement', async () => {
      const response = await request(app)
        .put('/api/announcements/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated', content: 'Updated content' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('should handle database update failures', async () => {
      const originalFindByIdAndUpdate = Announcement.findByIdAndUpdate;
      Announcement.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database update failed'));

      const response = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated', content: 'Updated content' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to update announcement');

      Announcement.findByIdAndUpdate = originalFindByIdAndUpdate;
    });
  });

  describe('TC-006-HP-004: DELETE /api/announcements/:id - Happy Path', () => {
    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'To Be Deleted',
        content: 'This announcement will be deleted',
        createdBy: adminUser._id,
        isActive: true
      });
    });

    test('should delete announcement with valid ID and admin token', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should immediately remove deleted announcement from user view', async () => {
      await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const viewResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(viewResponse.body).toHaveLength(0);
    });
  });

  describe('TC-006-EP-004: DELETE /api/announcements/:id - Error Path', () => {
    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'Test Title',
        content: 'Test content',
        createdBy: adminUser._id,
        isActive: true
      });
    });

    test('should return 403 when non-admin user attempts to delete announcement', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. Admin privileges required.');
    });

    test('should return 404 when trying to delete non-existent announcement', async () => {
      const response = await request(app)
        .delete('/api/announcements/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('should handle database delete failures', async () => {
      const originalFindByIdAndDelete = Announcement.findByIdAndDelete;
      Announcement.findByIdAndDelete = jest.fn().mockRejectedValue(new Error('Database delete failed'));

      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to delete announcement');

      Announcement.findByIdAndDelete = originalFindByIdAndDelete;
    });
  });

  describe('TC-006-HP-005: GET /api/announcements/admin - Happy Path', () => {
    test('should return all announcements (active and inactive) for admin user', async () => {
      await Announcement.create({
        title: 'Active Admin View',
        content: 'Active content',
        createdBy: adminUser._id,
        isActive: true
      });

      await Announcement.create({
        title: 'Inactive Admin View',
        content: 'Inactive content',
        createdBy: adminUser._id,
        isActive: false
      });

      const response = await request(app)
        .get('/api/announcements/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    test('should return empty array when no announcements exist for admin view', async () => {
      const response = await request(app)
        .get('/api/announcements/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('TC-006-EP-005: GET /api/announcements/admin - Error Path', () => {
    test('should return 403 when non-admin user attempts to access admin endpoint', async () => {
      const response = await request(app)
        .get('/api/announcements/admin')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied. Admin privileges required.');
    });

    test('should handle database query failures for admin endpoint', async () => {
      const originalFind = Announcement.find;
      Announcement.find = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/announcements/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');

      Announcement.find = originalFind;
    });
  });

  describe('TC-006-EP-006: Authentication Edge Cases', () => {
    test('should reject malformed authorization headers', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'InvalidFormat token_here');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid authorization format');
    });

    test('should handle expired tokens appropriately', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYxMjM0NTY3ODlhYmNkZWYwMTIzNDU2NyIsInJvbGUiOiJlbXBsb3llZSIsImV4cCI6MTYyMzQ1Njc4OX0.expired';
      
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  describe('TC-006-EP-007: Data Validation Edge Cases', () => {
    test('should reject announcements with XSS content', async () => {
      const maliciousContent = '<script>alert("xss")</script>';
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test Title',
          content: maliciousContent
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid content format');
    });

    test('should reject announcements with content exceeding maximum length', async () => {
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

  describe('TC-006-HP-006: Concurrent Operations', () => {
    test('should handle concurrent announcement creation without data corruption', async () => {
      const announcementPromises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: `Concurrent Announcement ${i + 1}`,
            content: `Content ${i + 1}`
          })
      );

      const responses = await Promise.all(announcementPromises);

      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      const allAnnouncements = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(allAnnouncements.body).toHaveLength(5);
    });
  });
});