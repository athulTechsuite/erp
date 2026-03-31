const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/database');
const jwt = require('jsonwebtoken');

describe('Company Announcements System - Integration Tests', () => {
  let adminToken, employeeToken, testAnnouncement;
  
  beforeAll(async () => {
    // Setup test database
    await db.run(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create test tokens
    adminToken = jwt.sign(
      { id: 1, role: 'admin', email: 'admin@test.com' },
      process.env.JWT_SECRET || 'test-secret'
    );
    
    employeeToken = jwt.sign(
      { id: 2, role: 'employee', email: 'employee@test.com' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });
  
  beforeEach(async () => {
    // Clear announcements table
    await db.run('DELETE FROM announcements');
    
    // Create test announcement
    const result = await db.run(
      'INSERT INTO announcements (title, message) VALUES (?, ?)',
      ['Test Announcement', 'This is a test message']
    );
    testAnnouncement = { id: result.lastID, title: 'Test Announcement', message: 'This is a test message' };
  });
  
  afterAll(async () => {
    await db.run('DROP TABLE IF EXISTS announcements');
  });

  describe('PRD Test Case 1: Admin can see announcements management section', () => {
    test('Given I am logged in as an admin user When I navigate to the announcements management section Then I can see a list of all existing announcements with options to create, edit, and delete them', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0]).toMatchObject({
        id: testAnnouncement.id,
        title: 'Test Announcement',
        message: 'This is a test message'
      });
    });
  });

  describe('PRD Test Case 2: Admin creating new announcement', () => {
    test('Given I am an admin creating a new announcement When I submit a text-only announcement with a title and message Then The announcement is saved to the database and immediately appears on all employee dashboards', async () => {
      const newAnnouncement = {
        title: 'New Company Policy',
        message: 'We are implementing new remote work policies effective immediately.'
      };
      
      const createResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAnnouncement);
        
      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.message).toBe('Announcement created successfully');
      
      // Verify it appears on dashboard for employee
      const dashboardResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);
        
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body.data.length).toBe(2);
      
      const createdAnnouncement = dashboardResponse.body.data.find(
        a => a.title === 'New Company Policy'
      );
      expect(createdAnnouncement).toBeDefined();
      expect(createdAnnouncement.message).toBe(newAnnouncement.message);
    });
    
    test('Should reject announcement creation with missing title', async () => {
      const invalidAnnouncement = {
        message: 'This has no title'
      };
      
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidAnnouncement);
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Title and message are required');
    });
    
    test('Should reject announcement creation with title exceeding 255 characters', async () => {
      const invalidAnnouncement = {
        title: 'A'.repeat(256),
        message: 'Valid message'
      };
      
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidAnnouncement);
        
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Title must be 255 characters or less');
    });
  });

  describe('PRD Test Case 3: Users viewing dashboard announcements', () => {
    test('Given I am any authenticated user (admin or employee) When I view my dashboard Then I can see all active company announcements displayed in chronological order with the newest first', async () => {
      // Create additional announcement to test ordering
      await db.run(
        'INSERT INTO announcements (title, message, created_at) VALUES (?, ?, ?)',
        ['Older Announcement', 'This is older', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]
      );
      
      const employeeResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);
        
      expect(employeeResponse.status).toBe(200);
      expect(employeeResponse.body.data.length).toBe(2);
      
      // Verify chronological order (newest first)
      expect(employeeResponse.body.data[0].title).toBe('Test Announcement');
      expect(employeeResponse.body.data[1].title).toBe('Older Announcement');
      
      // Test same for admin
      const adminResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`);
        
      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.data).toEqual(employeeResponse.body.data);
    });
  });

  describe('PRD Test Case 4: Admin editing existing announcement', () => {
    test('Given I am an admin editing an existing announcement When I update the title or message content Then The changes are saved and immediately reflected on all employee dashboards', async () => {
      const updatedData = {
        title: 'Updated Test Announcement',
        message: 'This message has been updated'
      };
      
      const updateResponse = await request(app)
        .put(`/api/announcements/${testAnnouncement.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatedData);
        
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.message).toBe('Announcement updated successfully');
      
      // Verify changes are reflected for employees
      const employeeResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);
        
      expect(employeeResponse.status).toBe(200);
      const updatedAnnouncement = employeeResponse.body.data.find(
        a => a.id === testAnnouncement.id
      );
      expect(updatedAnnouncement.title).toBe('Updated Test Announcement');
      expect(updatedAnnouncement.message).toBe('This message has been updated');
    });
    
    test('Should return 404 when trying to update non-existent announcement', async () => {
      const response = await request(app)
        .put('/api/announcements/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'New Title', message: 'New Message' });
        
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Announcement not found');
    });
  });

  describe('PRD Test Case 5: Admin deleting announcement', () => {
    test('Given I am an admin deleting an announcement When I confirm the deletion Then The announcement is removed from the database and no longer appears on any dashboards', async () => {
      const deleteResponse = await request(app)
        .delete(`/api/announcements/${testAnnouncement.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
        
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.message).toBe('Announcement deleted successfully');
      
      // Verify it no longer appears on employee dashboard
      const employeeResponse = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);
        
      expect(employeeResponse.status).toBe(200);
      expect(employeeResponse.body.data.length).toBe(0);
      
      // Verify it's actually removed from database
      const dbCheck = await db.get(
        'SELECT * FROM announcements WHERE id = ?',
        [testAnnouncement.id]
      );
      expect(dbCheck).toBeUndefined();
    });
    
    test('Should return 404 when trying to delete non-existent announcement', async () => {
      const response = await request(app)
        .delete('/api/announcements/9999')
        .set('Authorization', `Bearer ${adminToken}`);
        
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Announcement not found');
    });
  });

  describe('PRD Test Case 6: Error handling', () => {
    test('Given The system encounters an error while loading announcements When A user views their dashboard Then The dashboard displays gracefully without announcements and logs the error appropriately', async () => {
      // Simulate database error by corrupting the table temporarily
      await db.run('DROP TABLE announcements');
      
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);
        
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch announcements');
      
      // Restore table for cleanup
      await db.run(`
        CREATE TABLE announcements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });
  });

  describe('Authorization Tests', () => {
    test('Should deny access to non-admin users for creating announcements', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ title: 'Test', message: 'Test' });
        
      expect(response.status).toBe(403);
    });
    
    test('Should deny access to non-admin users for updating announcements', async () => {
      const response = await request(app)
        .put(`/api/announcements/${testAnnouncement.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ title: 'Updated', message: 'Updated' });
        
      expect(response.status).toBe(403);
    });
    
    test('Should deny access to non-admin users for deleting announcements', async () => {
      const response = await request(app)
        .delete(`/api/announcements/${testAnnouncement.id}`)
        .set('Authorization', `Bearer ${employeeToken}`);
        
      expect(response.status).toBe(403);
    });
    
    test('Should deny access to unauthenticated users', async () => {
      const response = await request(app)
        .get('/api/announcements');
        
      expect(response.status).toBe(401);
    });
  });
});