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

  // TC-002: CRUD operations for announcements - Comprehensive test coverage
  describe('[TC-002] CRUD Operations for Announcements', () => {
    describe('[TC-002-CREATE] Create Announcement Operations', () => {
      test('[TC-002-CREATE-HP] should successfully create announcement with valid data', async () => {
        const announcementData = {
          title: 'New Company Policy',
          content: 'Important policy update for all employees regarding remote work guidelines'
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

        // Verify announcement is saved in database
        const savedAnnouncement = await Announcement.findById(response.body.data._id);
        expect(savedAnnouncement).toBeTruthy();
        expect(savedAnnouncement.title).toBe(announcementData.title);
      });

      test('[TC-002-CREATE-EP] should fail to create announcement with missing title', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ content: 'Content without title' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('title');
      });

      test('[TC-002-CREATE-EP] should fail to create announcement with missing content', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Title without content' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('content');
      });

      test('[TC-002-CREATE-EP] should reject creation by non-admin users', async () => {
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

      test('[TC-002-CREATE-EP] should handle database errors during creation', async () => {
        const originalCreate = Announcement.create;
        Announcement.create = jest.fn().mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Test', content: 'Test content' });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);

        Announcement.create = originalCreate;
      });
    });

    describe('[TC-002-READ] Read Announcement Operations', () => {
      beforeEach(async () => {
        // Create test announcements for read operations
        testAnnouncement = await Announcement.create({
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

        await Announcement.create({
          title: 'Inactive Announcement',
          content: 'This should not appear for regular users',
          createdBy: adminUser._id,
          isActive: false
        });
      });

      test('[TC-002-READ-HP] should retrieve all active announcements for employees', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(2); // Only active announcements
        
        response.body.forEach(announcement => {
          expect(announcement).toHaveProperty('_id');
          expect(announcement).toHaveProperty('title');
          expect(announcement).toHaveProperty('content');
          expect(announcement).toHaveProperty('created_at');
          expect(announcement.isActive).toBe(true);
        });
      });

      test('[TC-002-READ-HP] should retrieve specific announcement by ID', async () => {
        const response = await request(app)
          .get(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body._id).toBe(testAnnouncement._id.toString());
        expect(response.body.title).toBe('Test Announcement 1');
        expect(response.body.content).toBe('First test announcement content');
      });

      test('[TC-002-READ-HP] should retrieve all announcements for admin including inactive ones', async () => {
        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(3); // Including inactive announcements
      });

      test('[TC-002-READ-EP] should return 404 for non-existent announcement', async () => {
        const response = await request(app)
          .get('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      test('[TC-002-READ-EP] should handle database query errors', async () => {
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

        Announcement.find = originalFind;
      });

      test('[TC-002-READ-EP] should deny admin endpoints access to non-admin users', async () => {
        const response = await request(app)
          .get('/api/announcements/admin')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Access denied. Admin privileges required.');
      });
    });

    describe('[TC-002-UPDATE] Update Announcement Operations', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Original Title',
          content: 'Original content that will be updated',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-002-UPDATE-HP] should successfully update announcement title and content', async () => {
        const updateData = {
          title: 'Updated Title',
          content: 'Updated content with new information'
        };

        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe(updateData.title);
        expect(response.body.data.content).toBe(updateData.content);

        // Verify update in database
        const updatedAnnouncement = await Announcement.findById(testAnnouncement._id);
        expect(updatedAnnouncement.title).toBe(updateData.title);
        expect(updatedAnnouncement.content).toBe(updateData.content);
      });

      test('[TC-002-UPDATE-HP] should update only specified fields', async () => {
        const originalContent = testAnnouncement.content;
        const updateData = { title: 'Only Title Updated' };

        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.data.title).toBe(updateData.title);
        expect(response.body.data.content).toBe(originalContent); // Should remain unchanged
      });

      test('[TC-002-UPDATE-HP] should update announcement status (active/inactive)', async () => {
        const updateData = { isActive: false };

        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.data.isActive).toBe(false);

        // Verify announcement no longer appears for employees
        const employeeResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);
        
        expect(employeeResponse.body).toHaveLength(0);
      });

      test('[TC-002-UPDATE-EP] should return 404 for non-existent announcement', async () => {
        const response = await request(app)
          .put('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated Title' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      test('[TC-002-UPDATE-EP] should reject updates by non-admin users', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ title: 'Unauthorized Update' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-002-UPDATE-EP] should validate update data', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: '' }); // Empty title

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      test('[TC-002-UPDATE-EP] should handle database update errors', async () => {
        const originalFindByIdAndUpdate = Announcement.findByIdAndUpdate;
        Announcement.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database update failed'));

        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated Title' });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);

        Announcement.findByIdAndUpdate = originalFindByIdAndUpdate;
      });
    });

    describe('[TC-002-DELETE] Delete Announcement Operations', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Announcement to Delete',
          content: 'This announcement will be deleted',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-002-DELETE-HP] should successfully delete announcement', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted');

        // Verify announcement is removed from database
        const deletedAnnouncement = await Announcement.findById(testAnnouncement._id);
        expect(deletedAnnouncement).toBeNull();
      });

      test('[TC-002-DELETE-HP] should immediately remove deleted announcement from employee view', async () => {
        // First verify announcement is visible
        const beforeResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);
        expect(beforeResponse.body).toHaveLength(1);

        // Delete announcement
        await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Verify it's no longer visible
        const afterResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);
        expect(afterResponse.body).toHaveLength(0);
      });

      test('[TC-002-DELETE-EP] should return 404 for non-existent announcement', async () => {
        const response = await request(app)
          .delete('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      test('[TC-002-DELETE-EP] should reject deletion by non-admin users', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });

      test('[TC-002-DELETE-EP] should handle database deletion errors', async () => {
        const originalFindByIdAndDelete = Announcement.findByIdAndDelete;
        Announcement.findByIdAndDelete = jest.fn().mockRejectedValue(new Error('Database deletion failed'));

        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);

        Announcement.findByIdAndDelete = originalFindByIdAndDelete;
      });

      test('[TC-002-DELETE-EP] should handle invalid ObjectId format', async () => {
        const response = await request(app)
          .delete('/api/announcements/invalid-id-format')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid');
      });
    });

    describe('[TC-002-INTEGRATION] CRUD Integration Scenarios', () => {
      test('[TC-002-INTEGRATION-HP] should perform complete CRUD lifecycle', async () => {
        // CREATE
        const createResponse = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Lifecycle Test Announcement',
            content: 'Testing complete CRUD lifecycle'
          });
        
        expect(createResponse.status).toBe(201);
        const announcementId = createResponse.body.data._id;

        // READ
        const readResponse = await request(app)
          .get(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${employeeToken}`);
        
        expect(readResponse.status).toBe(200);
        expect(readResponse.body.title).toBe('Lifecycle Test Announcement');

        // UPDATE
        const updateResponse = await request(app)
          .put(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Updated Lifecycle Test',
            content: 'Updated content for lifecycle test'
          });
        
        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.data.title).toBe('Updated Lifecycle Test');

        // DELETE
        const deleteResponse = await request(app)
          .delete(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        
        expect(deleteResponse.status).toBe(200);

        // VERIFY DELETION
        const finalReadResponse = await request(app)
          .get(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${employeeToken}`);
        
        expect(finalReadResponse.status).toBe(404);
      });

      test('[TC-002-INTEGRATION-EP] should maintain data consistency across concurrent operations', async () => {
        // Create initial announcement
        const createResponse = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Concurrent Test',
            content: 'Testing concurrent operations'
          });
        
        const announcementId = createResponse.body.data._id;

        // Attempt concurrent updates
        const updatePromises = [
          request(app)
            .put(`/api/announcements/${announcementId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ title: 'Update 1' }),
          request(app)
            .put(`/api/announcements/${announcementId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ title: 'Update 2' })
        ];

        const updateResults = await Promise.all(updatePromises);
        
        // At least one update should succeed
        const successfulUpdates = updateResults.filter(result => result.status === 200);
        expect(successfulUpdates.length).toBeGreaterThan(0);

        // Verify final state is consistent
        const finalState = await request(app)
          .get(`/api/announcements/${announcementId}`)
          .set('Authorization', `Bearer ${employeeToken}`);
        
        expect(finalState.status).toBe(200);
        expect(['Update 1', 'Update 2']).toContain(finalState.body.title);
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