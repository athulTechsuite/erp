const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Announcement = require('../../src/models/Announcement');
const jwt = require('jsonwebtoken');

describe('Company Announcements System - Integration Tests', () => {
  let adminToken, userToken, managerToken;
  let adminUser, normalUser, managerUser;
  let testAnnouncement;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.TEST_DB_URL || 'mongodb://localhost:27017/erp_test');
    
    // Create test users
    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });

    normalUser = await User.create({
      firstName: 'Normal',
      lastName: 'User',
      email: 'user@test.com',
      password: 'password123',
      role: 'employee'
    });

    managerUser = await User.create({
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@test.com',
      password: 'password123',
      role: 'manager'
    });

    // Generate tokens
    adminToken = jwt.sign({ _id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET || 'testsecret');
    userToken = jwt.sign({ _id: normalUser._id, role: 'employee' }, process.env.JWT_SECRET || 'testsecret');
    managerToken = jwt.sign({ _id: managerUser._id, role: 'manager' }, process.env.JWT_SECRET || 'testsecret');
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Announcement.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Announcement.deleteMany({});
  });

  describe('PRD Test Case 1: Admin can see Add Announcement button on dashboard', () => {
    it('should show Add Announcement functionality for admin users', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('announcements');
      // The presence of announcement creation endpoint indicates button availability
    });

    it('should allow admin to access announcement creation endpoint', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test Announcement',
          content: 'This is a test announcement content'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PRD Test Case 2: Admin can create announcements that display for all users', () => {
    it('should allow admin to create announcement and make it visible to all users', async () => {
      // Admin creates announcement
      const createResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Company Policy Update',
          content: 'New remote work policy effective immediately'
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);
      
      const announcementId = createResponse.body.data._id;

      // Verify admin can see the announcement
      const adminResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body).toHaveLength(1);
      expect(adminResponse.body[0].title).toBe('Company Policy Update');

      // Verify normal user can see the announcement
      const userResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${userToken}`);

      expect(userResponse.status).toBe(200);
      expect(userResponse.body).toHaveLength(1);
      expect(userResponse.body[0].title).toBe('Company Policy Update');
      expect(userResponse.body[0]._id).toBe(announcementId);
    });
  });

  describe('PRD Test Case 3: Non-admin users see read-only announcements', () => {
    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'Test Announcement',
        content: 'Test content for read-only verification',
        author: adminUser._id,
        status: 'active'
      });
    });

    it('should allow non-admin users to view announcements in read-only mode', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Test Announcement');
    });

    it('should deny non-admin users from creating announcements', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Unauthorized Announcement',
          content: 'This should not be created'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin privileges required');
    });

    it('should deny non-admin users from editing announcements', async () => {
      const response = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Modified Title',
          content: 'Modified content'
        });

      expect(response.status).toBe(403);
    });

    it('should deny non-admin users from deleting announcements', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny manager users from creating announcements', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Manager Announcement',
          content: 'Manager should not create this'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Admin privileges required');
    });
  });

  describe('PRD Test Case 4: Announcements display prominently in chronological order', () => {
    it('should display announcements in chronological order (newest first)', async () => {
      // Create multiple announcements with different timestamps
      const announcement1 = await Announcement.create({
        title: 'First Announcement',
        content: 'First content',
        author: adminUser._id,
        status: 'active',
        createdAt: new Date('2024-01-01')
      });

      const announcement2 = await Announcement.create({
        title: 'Second Announcement',
        content: 'Second content',
        author: adminUser._id,
        status: 'active',
        createdAt: new Date('2024-01-02')
      });

      const announcement3 = await Announcement.create({
        title: 'Third Announcement',
        content: 'Third content',
        author: adminUser._id,
        status: 'active',
        createdAt: new Date('2024-01-03')
      });

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      
      // Verify chronological order (newest first)
      expect(response.body[0].title).toBe('Third Announcement');
      expect(response.body[1].title).toBe('Second Announcement');
      expect(response.body[2].title).toBe('First Announcement');
      
      // Verify timestamps are in descending order
      const dates = response.body.map(a => new Date(a.createdAt));
      expect(dates[0]).toBeGreaterThan(dates[1]);
      expect(dates[1]).toBeGreaterThan(dates[2]);
    });

    it('should display announcements on dashboard for all user types', async () => {
      await Announcement.create({
        title: 'Dashboard Test',
        content: 'This should appear on dashboard',
        author: adminUser._id,
        status: 'active'
      });

      // Test admin dashboard
      const adminDashboard = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminDashboard.status).toBe(200);
      expect(adminDashboard.body.announcements).toHaveLength(1);

      // Test user dashboard (if endpoint exists)
      const userDashboard = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${userToken}`);
      expect(userDashboard.status).toBe(200);
      expect(userDashboard.body.announcements).toHaveLength(1);
    });
  });

  // TC-005: Permission/Authorization Tests - Comprehensive coverage for all user roles and endpoints
  describe('TC-005: Permission/Authorization Tests - Complete security validation', () => {
    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'Test Announcement for Authorization',
        content: 'Content for permission testing',
        author: adminUser._id,
        status: 'active'
      });
    });

    describe('TC-005 Happy Path: Authorized admin operations', () => {
      it('TC-005.1: Admin should successfully create announcements with proper authorization', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Admin Created Announcement',
            content: 'This announcement was created by admin with proper authorization'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Admin Created Announcement');
      });

      it('TC-005.2: Admin should successfully read all announcements with proper authorization', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(1);
      });

      it('TC-005.3: Admin should successfully update announcements with proper authorization', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Updated by Admin',
            content: 'Content updated with admin authorization'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Updated by Admin');
      });

      it('TC-005.4: Admin should successfully delete announcements with proper authorization', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('TC-005.5: All authenticated users should successfully read announcements', async () => {
        // Test employee access
        const employeeResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${userToken}`);

        expect(employeeResponse.status).toBe(200);
        expect(Array.isArray(employeeResponse.body)).toBe(true);

        // Test manager access
        const managerResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${managerToken}`);

        expect(managerResponse.status).toBe(200);
        expect(Array.isArray(managerResponse.body)).toBe(true);
      });
    });

    describe('TC-005 Error Path: Unauthorized access attempts', () => {
      it('TC-005.6: Should reject unauthenticated access to announcements list', async () => {
        const response = await request(app)
          .get('/api/announcements');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/unauthorized|authentication|token/i);
      });

      it('TC-005.7: Should reject unauthenticated announcement creation', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .send({
            title: 'Unauthorized Creation',
            content: 'This should be rejected'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('TC-005.8: Should reject employee attempts to create announcements', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            title: 'Employee Unauthorized',
            content: 'Employee should not create announcements'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/admin|forbidden|privilege/i);
      });

      it('TC-005.9: Should reject manager attempts to create announcements', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            title: 'Manager Unauthorized',
            content: 'Manager should not create announcements'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/admin|forbidden|privilege/i);
      });

      it('TC-005.10: Should reject employee attempts to update announcements', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            title: 'Employee Update Attempt',
            content: 'This update should be rejected'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      it('TC-005.11: Should reject manager attempts to update announcements', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            title: 'Manager Update Attempt',
            content: 'This update should be rejected'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      it('TC-005.12: Should reject employee attempts to delete announcements', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      it('TC-005.13: Should reject manager attempts to delete announcements', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${managerToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      it('TC-005.14: Should reject requests with invalid JWT tokens', async () => {
        const invalidToken = 'invalid.jwt.token';
        
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${invalidToken}`);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('TC-005.15: Should reject requests with expired JWT tokens', async () => {
        const expiredToken = jwt.sign(
          { _id: adminUser._id, role: 'admin', exp: Math.floor(Date.now() / 1000) - 3600 },
          process.env.JWT_SECRET || 'testsecret'
        );
        
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('TC-005.16: Should reject requests with malformed Authorization header', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', 'InvalidFormat');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('TC-005.17: Should prevent privilege escalation attempts', async () => {
        // Try to manipulate token payload (this should fail due to signature verification)
        const manipulatedToken = jwt.sign(
          { _id: normalUser._id, role: 'admin' }, // Employee trying to claim admin role
          'wrongsecret'
        );
        
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${manipulatedToken}`)
          .send({
            title: 'Privilege Escalation Attempt',
            content: 'This should be blocked'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('TC-005.18: Should validate role consistency in operations', async () => {
        // Create a user with undefined/null role
        const noRoleUser = await User.create({
          firstName: 'NoRole',
          lastName: 'User',
          email: 'norole@test.com',
          password: 'password123',
          role: undefined
        });

        const noRoleToken = jwt.sign({ _id: noRoleUser._id }, process.env.JWT_SECRET || 'testsecret');
        
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${noRoleToken}`)
          .send({
            title: 'No Role Test',
            content: 'Should be rejected'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        
        await User.findByIdAndDelete(noRoleUser._id);
      });
    });
  });

  describe('PRD Test Case 5: Admin can edit existing announcements', () => {
    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'Original Title',
        content: 'Original content',
        author: adminUser._id,
        status: 'active'
      });
    });

    it('should allow admin to edit announcement title and content', async () => {
      const response = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Title',
          content: 'Updated content with new information'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
      expect(response.body.data.content).toBe('Updated content with new information');

      // Verify changes are persisted
      const getResponse = await request(app)
        .get(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getResponse.body.title).toBe('Updated Title');
      expect(getResponse.body.content).toBe('Updated content with new information');
    });

    it('should update announcement and reflect changes for all users immediately', async () => {
      // Update announcement
      await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Globally Updated Title',
          content: 'This update should be visible to all users'
        });

      // Verify normal user sees the update
      const userResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${userToken}`);

      expect(userResponse.body[0].title).toBe('Globally Updated Title');
      expect(userResponse.body[0].content).toBe('This update should be visible to all users');
    });
  });

  describe('PRD Test Case 6: Admin can delete announcements', () => {
    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'To Be Deleted',
        content: 'This announcement will be deleted',
        author: adminUser._id,
        status: 'active'
      });
    });

    it('should allow admin to delete announcements', async () => {
      const deleteResponse = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);

      // Verify announcement is no longer accessible
      const getResponse = await request(app)
        .get(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should remove deleted announcements from all user views immediately', async () => {
      // Verify announcement exists before deletion
      const beforeResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${userToken}`);
      expect(beforeResponse.body).toHaveLength(1);

      // Delete announcement
      await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify announcement is removed from user view
      const afterResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${userToken}`);
      expect(afterResponse.body).toHaveLength(0);
    });
  });

  describe('PRD Test Case 7: Validation errors for empty title or content', () => {
    it('should return validation error for empty title', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '',
          content: 'Valid content'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Title and content cannot be empty');
    });

    it('should return validation error for empty content', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Valid Title',
          content: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Title and content cannot be empty');
    });

    it('should return validation error for both empty title and content', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '',
          content: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Title and content are required');
    });

    it('should return validation error for whitespace-only title and content', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '   ',
          content: '   '
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Title and content cannot be empty');
    });

    it('should not create announcement with validation errors', async () => {
      await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '',
          content: 'Some content'
        });

      // Verify no announcement was created
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.body).toHaveLength(0);
    });

    it('should return validation error for title exceeding character limit', async () => {
      const longTitle = 'A'.repeat(201); // Exceeds 200 character limit
      
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: longTitle,
          content: 'Valid content'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Validation failed');
    });

    it('should return validation error for content exceeding character limit', async () => {
      const longContent = 'A'.repeat(5001); // Exceeds 5000 character limit
      
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Valid Title',
          content: longContent
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('Additional Security and Edge Cases', () => {
    it('should require authentication to access announcements', async () => {
      const response = await request(app)
        .get('/api/announcements');

      expect(response.status).toBe(401);
    });

    it('should handle non-existent announcement ID gracefully', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/announcements/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should handle invalid announcement ID format', async () => {
      const response = await request(app)
        .get('/api/announcements/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
    });

    it('should only display active announcements to users', async () => {
      // Create active and inactive announcements
      await Announcement.create({
        title: 'Active Announcement',
        content: 'This is active',
        author: adminUser._id,
        status: 'active'
      });

      await Announcement.create({
        title: 'Inactive Announcement',
        content: 'This is inactive',
        author: adminUser._id,
        status: 'inactive'
      });

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Active Announcement');
    });
  });
});