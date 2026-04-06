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

  describe('[TC-AN-001] Admin user navigates to announcements management', () => {
    test('[TC-AN-001-HP] should show announcement creation form for admin user', async () => {
      const response = await request(app)
        .get('/api/announcements/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.arrayContaining([]));
    });

    test('[TC-AN-001-HP] should allow admin to access announcement creation endpoint', async () => {
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

    test('[TC-AN-001-EP] should handle admin access when database is unavailable', async () => {
      // Mock database connection failure
      const originalFind = Announcement.find;
      Announcement.find = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/announcements/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');

      // Restore original method
      Announcement.find = originalFind;
    });
  });

  describe('[TC-AN-002] Admin creates and publishes new announcement', () => {
    test('[TC-AN-002-HP] should save announcement to database and make it visible immediately', async () => {
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

    test('[TC-AN-002-EP] should validate required fields when creating announcement', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation errors');
    });

    test('[TC-AN-002-EP] should handle database save failures during announcement creation', async () => {
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

      // Restore original method
      Announcement.create = originalCreate;
    });
  });

  describe('[TC-AN-003] Employee views announcements on dashboard', () => {
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

    test('[TC-AN-003-HP] should display all active announcements with title, content, and publish date', async () => {
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

    test('[TC-AN-003-HP] should sort announcements by creation date (newest first)', async () => {
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

    test('[TC-AN-003-EP] should handle empty announcements list gracefully', async () => {
      await Announcement.deleteMany({});

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('[TC-AN-003-EP] should handle database query failures when fetching announcements', async () => {
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

      // Restore original method
      Announcement.find = originalFind;
    });
  });

  describe('[TC-AN-004] Non-admin user access restrictions', () => {
    test('[TC-AN-004-EP] should deny employee access to announcement creation interface', async () => {
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

    test('[TC-AN-004-EP] should deny manager access to announcement creation interface', async () => {
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

    test('[TC-AN-004-EP] should deny employee access to admin announcement management', async () => {
      const response = await request(app)
        .get('/api/announcements/admin')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied. Admin privileges required.');
    });

    test('[TC-AN-004-HP] should allow employee to view public announcements despite creation restrictions', async () => {
      // Create announcement as admin
      await Announcement.create({
        title: 'Public Announcement',
        content: 'This should be visible to employees',
        createdBy: adminUser._id,
        isActive: true
      });

      // Employee should still be able to view
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Public Announcement');
    });
  });

  describe('[TC-AN-005] Admin edits and deletes announcements', () => {
    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'Original Title',
        content: 'Original content',
        createdBy: adminUser._id,
        isActive: true
      });
    });

    test('[TC-AN-005-HP] should allow admin to edit announcement content', async () => {
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

    test('[TC-AN-005-HP] should allow admin to delete announcement', async () => {
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

    test('[TC-AN-005-EP] should return 404 when trying to edit non-existent announcement', async () => {
      const response = await request(app)
        .put('/api/announcements/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated', content: 'Updated content' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('[TC-AN-005-EP] should handle database update failures during announcement edit', async () => {
      const originalFindByIdAndUpdate = Announcement.findByIdAndUpdate;
      Announcement.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database update failed'));

      const response = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated', content: 'Updated content' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to update announcement');

      // Restore original method
      Announcement.findByIdAndUpdate = originalFindByIdAndUpdate;
    });

    test('[TC-AN-005-EP] should prevent non-admin users from editing announcements', async () => {
      const response = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ title: 'Unauthorized Update' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied. Admin privileges required.');
    });
  });

  describe('[TC-AN-006] No announcements scenario', () => {
    test('[TC-AN-006-HP] should return empty array when no active announcements exist', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('[TC-AN-006-HP] should not display inactive announcements to employees', async () => {
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

    test('[TC-AN-006-EP] should handle system state with no announcements gracefully', async () => {
      // Ensure clean slate
      await Announcement.deleteMany({});

      // Test multiple user types
      const responses = await Promise.all([
        request(app).get('/api/announcements').set('Authorization', `Bearer ${employeeToken}`),
        request(app).get('/api/announcements').set('Authorization', `Bearer ${managerToken}`),
        request(app).get('/api/announcements/admin').set('Authorization', `Bearer ${adminToken}`)
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
    });
  });

  describe('[TC-AN-007] Authentication and Authorization Edge Cases', () => {
    test('[TC-AN-007-EP] should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/announcements');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    test('[TC-AN-007-EP] should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    test('[TC-AN-007-EP] should reject malformed authorization headers', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'InvalidFormat token_here');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid authorization format');
    });

    test('[TC-AN-007-HP] should successfully authenticate with valid admin token', async () => {
      const response = await request(app)
        .get('/api/announcements/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('[TC-AN-008] Data Validation Tests', () => {
    test('[TC-AN-008-EP] should validate announcement title length', async () => {
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

    test('[TC-AN-008-EP] should validate announcement content length', async () => {
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

    test('[TC-AN-008-EP] should reject announcements with special characters injection', async () => {
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

    test('[TC-AN-008-HP] should accept valid announcement data with proper formatting', async () => {
      const validData = {
        title: 'Valid Announcement Title',
        content: 'This is a valid announcement content with proper formatting and length.'
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(validData.title);
      expect(response.body.data.content).toBe(validData.content);
    });
  });

  describe('[TC-AN-009] Performance and Pagination Tests', () => {
    test('[TC-AN-009-HP] should handle large number of announcements efficiently', async () => {
      // Create multiple announcements
      const announcements = Array.from({ length: 50 }, (_, i) => ({
        title: `Announcement ${i + 1}`,
        content: `Content for announcement ${i + 1}`,
        createdBy: adminUser._id,
        isActive: true
      }));

      await Announcement.insertMany(announcements);

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(50);
      expect(endTime - startTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('[TC-AN-009-EP] should handle pagination parameters correctly', async () => {
      // Create test announcements
      await Announcement.insertMany([
        { title: 'Ann 1', content: 'Content 1', createdBy: adminUser._id, isActive: true },
        { title: 'Ann 2', content: 'Content 2', createdBy: adminUser._id, isActive: true },
        { title: 'Ann 3', content: 'Content 3', createdBy: adminUser._id, isActive: true }
      ]);

      const response = await request(app)
        .get('/api/announcements?page=1&limit=2')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeLessThanOrEqual(2);
    });
  });

  describe('[TC-AN-010] Real-time Updates and Notifications', () => {
    test('[TC-AN-010-HP] should immediately reflect new announcements to all users', async () => {
      // Create announcement
      const createResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Breaking News',
          content: 'Important update for all staff'
        });

      expect(createResponse.status).toBe(201);

      // Verify immediate visibility across different user types
      const [employeeView, managerView] = await Promise.all([
        request(app).get('/api/announcements').set('Authorization', `Bearer ${employeeToken}`),
        request(app).get('/api/announcements').set('Authorization', `Bearer ${managerToken}`)
      ]);

      expect(employeeView.status).toBe(200);
      expect(employeeView.body).toHaveLength(1);
      expect(employeeView.body[0].title).toBe('Breaking News');

      expect(managerView.status).toBe(200);
      expect(managerView.body).toHaveLength(1);
      expect(managerView.body[0].title).toBe('Breaking News');
    });

    test('[TC-AN-010-EP] should handle concurrent announcement creation attempts', async () => {
      const announcementPromises = Array.from({ length: 3 }, (_, i) =>
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

      // Verify all announcements are created
      const allAnnouncements = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(allAnnouncements.body).toHaveLength(3);
    });
  });

  describe('[TC-AN-011] Announcement Lifecycle Management', () => {
    test('[TC-AN-011-HP] should track announcement creation and modification timestamps', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Timestamped Announcement',
          content: 'Testing timestamp functionality'
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('created_at');
      expect(response.body.data).toHaveProperty('updated_at');
      expect(new Date(response.body.data.created_at)).toBeInstanceOf(Date);
    });

    test('[TC-AN-011-EP] should handle announcement status transitions correctly', async () => {
      // Create active announcement
      const createResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Status Test',
          content: 'Testing status transitions'
        });

      const announcementId = createResponse.body.data._id;

      // Deactivate announcement
      const deactivateResponse = await request(app)
        .put(`/api/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(deactivateResponse.status).toBe(200);

      // Verify it's no longer visible to employees
      const employeeView = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(employeeView.body).toHaveLength(0);
    });
  });

  describe('[TC-AN-012] Content Filtering and Search', () => {
    beforeEach(async () => {
      await Announcement.insertMany([
        { title: 'HR Policy Update', content: 'New HR policies effective next month', createdBy: adminUser._id, isActive: true },
        { title: 'IT Maintenance', content: 'System maintenance scheduled for weekend', createdBy: adminUser._id, isActive: true },
        { title: 'Company Event', content: 'Annual company picnic announcement', createdBy: adminUser._id, isActive: true }
      ]);
    });

    test('[TC-AN-012-HP] should filter announcements by search term', async () => {
      const response = await request(app)
        .get('/api/announcements?search=HR')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toContain('HR');
    });

    test('[TC-AN-012-EP] should handle empty search results gracefully', async () => {
      const response = await request(app)
        .get('/api/announcements?search=NonExistentTerm')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('[TC-AN-012-HP] should support case-insensitive search', async () => {
      const response = await request(app)
        .get('/api/announcements?search=company')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.some(ann => ann.title.toLowerCase().includes('company'))).toBe(true);
    });
  });

  describe('[TC-AN-013] Announcement Analytics and Metrics', () => {
    test('[TC-AN-013-HP] should track announcement view statistics for admin users', async () => {
      // Create announcement
      const createResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Analytics Test',
          content: 'Testing analytics functionality'
        });

      const announcementId = createResponse.body.data._id;

      // Simulate employee viewing announcement
      await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      // Admin should be able to view analytics
      const analyticsResponse = await request(app)
        .get(`/api/announcements/${announcementId}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.body).toHaveProperty('viewCount');
    });

    test('[TC-AN-013-EP] should deny analytics access to non-admin users', async () => {
      const response = await request(app)
        .get('/api/announcements/507f1f77bcf86cd799439011/analytics')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied. Admin privileges required.');
    });
  });

  describe('[TC-AN-014] Bulk Operations', () => {
    test('[TC-AN-014-HP] should allow admin to perform bulk announcement operations', async () => {
      // Create multiple announcements
      const announcements = await Announcement.insertMany([
        { title: 'Bulk Test 1', content: 'Content 1', createdBy: adminUser._id, isActive: true },
        { title: 'Bulk Test 2', content: 'Content 2', createdBy: adminUser._id, isActive: true },
        { title: 'Bulk Test 3', content: 'Content 3', createdBy: adminUser._id, isActive: true }
      ]);

      const announcementIds = announcements.map(ann => ann._id.toString());

      // Bulk deactivate
      const bulkResponse = await request(app)
        .put('/api/announcements/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ids: announcementIds,
          action: 'deactivate'
        });

      expect(bulkResponse.status).toBe(200);
      expect(bulkResponse.body.success).toBe(true);

      // Verify all announcements are deactivated
      const employeeView = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(employeeView.body).toHaveLength(0);
    });

    test('[TC-AN-014-EP] should validate bulk operation parameters', async () => {
      const response = await request(app)
        .put('/api/announcements/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ids: [],
          action: 'invalid_action'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid bulk operation');
    });

    test('[TC-AN-014-EP] should handle partial failures in bulk operations gracefully', async () => {
      const response = await request(app)
        .put('/api/announcements/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
          action: 'delete'
        });

      expect(response.status).toBe(207); // Multi-status for partial success
      expect(response.body.results).toHaveProperty('failed');
      expect(response.body.results).toHaveProperty('succeeded');
    });
  });

  describe('[TC-AN-015] Integration with External Systems', () => {
    test('[TC-AN-015-HP] should trigger notification system when announcement is created', async () => {
      // Mock notification service
      const mockNotificationService = jest.fn();
      const originalNotify = require('../../src/services/notificationService');
      require('../../src/services/notificationService').sendAnnouncement = mockNotificationService;

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Notification Test',
          content: 'Testing notification integration'
        });

      expect(response.status).toBe(201);
      expect(mockNotificationService).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Notification Test',
          content: 'Testing notification integration'
        })
      );

      // Restore original service
      require('../../src/services/notificationService').sendAnnouncement = originalNotify.sendAnnouncement;
    });

    test('[TC-AN-015-EP] should handle notification service failures gracefully', async () => {
      // Mock notification service to fail
      const mockNotificationService = jest.fn().mockRejectedValue(new Error('Notification service down'));
      require('../../src/services/notificationService').sendAnnouncement = mockNotificationService;

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Failure Test',
          content: 'Testing notification failure handling'
        });

      // Announcement should still be created despite notification failure
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.warnings).toContain('Notification delivery failed');
    });

    test('[TC-AN-015-HP] should integrate with audit logging system', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Audit Test',
          content: 'Testing audit log integration'
        });

      expect(response.status).toBe(201);

      // Verify audit log entry
      const auditResponse = await request(app)
        .get('/api/audit/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditResponse.status).toBe(200);
      expect(auditResponse.body.some(log => 
        log.action === 'CREATE_ANNOUNCEMENT' && 
        log.details.title === 'Audit Test'
      )).toBe(true);
    });
  });
});