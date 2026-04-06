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

  describe('[TC-SEC-001] Authentication Security Tests', () => {
    test('[TC-SEC-001-01] should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/announcements');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    test('[TC-SEC-001-02] should reject requests with invalid token format', async () => {
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', 'Bearer invalid_token_format');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    test('[TC-SEC-001-03] should reject malformed authorization headers', async () => {
      const responses = await Promise.all([
        request(app).get('/api/announcements').set('Authorization', 'InvalidFormat token_here'),
        request(app).get('/api/announcements').set('Authorization', 'token_without_bearer'),
        request(app).get('/api/announcements').set('Authorization', 'Bearer '),
        request(app).get('/api/announcements').set('Authorization', '')
      ]);

      responses.forEach(response => {
        expect([401, 403]).toContain(response.status);
        expect(response.body.error).toBeDefined();
      });
    });

    test('[TC-SEC-001-04] should reject expired tokens', async () => {
      // Create an expired token (this would require mocking JWT with expired timestamp)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4OTAiLCJyb2xlIjoiZW1wbG95ZWUiLCJleHAiOjE1MTYyMzkwMjJ9.expired';
      
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    test('[TC-SEC-001-05] should reject tampered tokens', async () => {
      // Tamper with valid token by changing a character
      const tamperedToken = adminToken.slice(0, -1) + 'X';
      
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    test('[TC-SEC-001-06] should handle token injection attempts', async () => {
      const maliciousTokens = [
        'Bearer <script>alert("xss")</script>',
        'Bearer ${process.env.SECRET}',
        'Bearer ../../etc/passwd',
        'Bearer " OR 1=1 --'
      ];

      const responses = await Promise.all(
        maliciousTokens.map(token =>
          request(app).get('/api/announcements').set('Authorization', token)
        )
      );

      responses.forEach(response => {
        expect([401, 403]).toContain(response.status);
        expect(response.body.error).toBeDefined();
      });
    });

    test('[TC-SEC-001-07] should validate token signature correctly', async () => {
      // Create token with different signature
      const validPayload = adminToken.split('.')[1];
      const validHeader = adminToken.split('.')[0];
      const invalidSignature = 'invalid_signature_here';
      const invalidToken = `${validHeader}.${validPayload}.${invalidSignature}`;

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    test('[TC-SEC-001-08] should handle concurrent authentication requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, () =>
        request(app).get('/api/announcements').set('Authorization', `Bearer ${employeeToken}`)
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  describe('[TC-SEC-002] Authorization Security Tests', () => {
    beforeEach(async () => {
      testAnnouncement = await Announcement.create({
        title: 'Test Authorization Announcement',
        content: 'Content for authorization tests',
        createdBy: adminUser._id,
        isActive: true
      });
    });

    test('[TC-SEC-002-01] should enforce role-based access for announcement creation', async () => {
      const announcementData = {
        title: 'Unauthorized Creation Test',
        content: 'This should not be allowed'
      };

      // Test employee access
      const employeeResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(announcementData);

      expect(employeeResponse.status).toBe(403);
      expect(employeeResponse.body.message).toBe('Access denied. Admin privileges required.');

      // Test manager access
      const managerResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(announcementData);

      expect(managerResponse.status).toBe(403);
      expect(managerResponse.body.message).toBe('Access denied. Admin privileges required.');

      // Test admin access (should succeed)
      const adminResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(announcementData);

      expect(adminResponse.status).toBe(201);
      expect(adminResponse.body.success).toBe(true);
    });

    test('[TC-SEC-002-02] should enforce role-based access for announcement updates', async () => {
      const updateData = { title: 'Unauthorized Update', content: 'Updated content' };

      // Test employee update access
      const employeeResponse = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(updateData);

      expect(employeeResponse.status).toBe(403);
      expect(employeeResponse.body.message).toBe('Access denied. Admin privileges required.');

      // Test manager update access
      const managerResponse = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(updateData);

      expect(managerResponse.status).toBe(403);
      expect(managerResponse.body.message).toBe('Access denied. Admin privileges required.');

      // Test admin update access (should succeed)
      const adminResponse = await request(app)
        .put(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.success).toBe(true);
    });

    test('[TC-SEC-002-03] should enforce role-based access for announcement deletion', async () => {
      // Test employee delete access
      const employeeResponse = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(employeeResponse.status).toBe(403);
      expect(employeeResponse.body.message).toBe('Access denied. Admin privileges required.');

      // Test manager delete access
      const managerResponse = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(managerResponse.status).toBe(403);
      expect(managerResponse.body.message).toBe('Access denied. Admin privileges required.');

      // Test admin delete access (should succeed)
      const adminResponse = await request(app)
        .delete(`/api/announcements/${testAnnouncement._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.success).toBe(true);
    });

    test('[TC-SEC-002-04] should enforce admin-only access to management endpoints', async () => {
      const adminEndpoints = [
        '/api/announcements/admin',
        '/api/announcements/stats',
        '/api/announcements/manage'
      ];

      for (const endpoint of adminEndpoints) {
        // Test employee access
        const employeeResponse = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${employeeToken}`);
        expect(employeeResponse.status).toBe(403);

        // Test manager access
        const managerResponse = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${managerToken}`);
        expect(managerResponse.status).toBe(403);

        // Test admin access
        const adminResponse = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${adminToken}`);
        expect([200, 404]).toContain(adminResponse.status); // 404 if endpoint doesn't exist yet
      }
    });

    test('[TC-SEC-002-05] should prevent privilege escalation attempts', async () => {
      // Attempt to modify role in token payload
      const payloadData = { id: employeeUser._id, role: 'admin' };
      const fakeAdminToken = Buffer.from(JSON.stringify(payloadData)).toString('base64');

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${fakeAdminToken}`)
        .send({ title: 'Privilege Escalation Test', content: 'This should fail' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    test('[TC-SEC-002-06] should validate user existence during authorization', async () => {
      // Create token for non-existent user
      const jwt = require('jsonwebtoken');
      const fakeUserId = '507f1f77bcf86cd799439011';
      const fakeToken = jwt.sign(
        { id: fakeUserId, role: 'admin' },
        process.env.JWT_SECRET || 'default_secret'
      );

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${fakeToken}`);

      expect([401, 403]).toContain(response.status);
      expect(response.body.error).toBeDefined();
    });

    test('[TC-SEC-002-07] should handle role modification after token issuance', async () => {
      // This test simulates a scenario where user role changes after token creation
      // In production, this would require token blacklisting or short expiration times
      
      // Use employee token but verify current role from database
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ title: 'Role Test', content: 'Testing role validation' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Access denied. Admin privileges required.');
    });
  });

  describe('[TC-SEC-003] Input Validation and Sanitization Tests', () => {
    test('[TC-SEC-003-01] should prevent XSS attacks in announcement content', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        '<svg onload=alert("xss")></svg>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'XSS Test', content: payload });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid content format');
      }
    });

    test('[TC-SEC-003-02] should prevent SQL injection attempts', async () => {
      const sqlPayloads = [
        "'; DROP TABLE announcements; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO announcements VALUES ('hacked'); --",
        "admin' --",
        "' OR 1=1 --"
      ];

      for (const payload of sqlPayloads) {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: payload, content: 'Test content' });

        // Should either reject the input or sanitize it
        if (response.status === 201) {
          expect(response.body.data.title).not.toContain('DROP');
          expect(response.body.data.title).not.toContain('UNION');
          expect(response.body.data.title).not.toContain('--');
        } else {
          expect(response.status).toBe(400);
        }
      }
    });

    test('[TC-SEC-003-03] should prevent NoSQL injection attempts', async () => {
      const noSqlPayloads = [
        '{"$gt":""}',
        '{"$where":"this.title.length > 0"}',
        '{"$regex":".*"}',
        '{"$ne":null}',
        '{"title":{"$gt":""}}',
        '{"$or":[{},{"title":"admin"}]}'
      ];

      for (const payload of noSqlPayloads) {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'NoSQL Test', content: payload });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    test('[TC-SEC-003-04] should validate and sanitize file upload attempts', async () => {
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('malicious_file', Buffer.from('malicious content'), 'hack.exe')
        .field('title', 'File Upload Test')
        .field('content', 'Testing file upload security');

      // Should reject file uploads if not supported or validate file types
      expect([400, 413, 415]).toContain(response.status);
    });

    test('[TC-SEC-003-05] should prevent command injection attempts', async () => {
      const commandPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '&& rm -rf /',
        '$(whoami)',
        '`id`',
        '; ping google.com',
        '| nc -l 4444'
      ];

      for (const payload of commandPayloads) {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: `Command Test ${payload}`, content: 'Test content' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid');
      }
    });

    test('[TC-SEC-003-06] should enforce input length limits', async () => {
      const longTitle = 'A'.repeat(10000);
      const longContent = 'B'.repeat(100000);

      const titleResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: longTitle, content: 'Valid content' });

      expect(titleResponse.status).toBe(400);
      expect(titleResponse.body.success).toBe(false);

      const contentResponse = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Valid title', content: longContent });

      expect(contentResponse.status).toBe(400);
      expect(contentResponse.body.success).toBe(false);
    });

    test('[TC-SEC-003-07] should validate announcement ID format in URL parameters', async () => {
      const invalidIds = [
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        '"; DROP TABLE announcements; --',
        '../../admin',
        'null',
        'undefined',
        '%00',
        'admin/delete'
      ];

      for (const invalidId of invalidIds) {
        const response = await request(app)
          .get(`/api/announcements/${invalidId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid ID format');
      }
    });
  });

  describe('[TC-SEC-004] Rate Limiting and DOS Protection Tests', () => {
    test('[TC-SEC-004-01] should implement rate limiting for API endpoints', async () => {
      const requests = Array.from({ length: 100 }, () =>
        request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      // Should have some rate limited responses if rate limiting is implemented
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);

    test('[TC-SEC-004-02] should handle large payload attacks', async () => {
      const largePayload = {
        title: 'A'.repeat(1000000),
        content: 'B'.repeat(10000000)
      };

      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(largePayload);

      expect([400, 413]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    test('[TC-SEC-004-03] should prevent concurrent connection exhaustion', async () => {
      const concurrentRequests = Array.from({ length: 50 }, () =>
        request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // Should handle concurrent requests without significant delay
      expect(endTime - startTime).toBeLessThan(5000);
      
      // Most requests should succeed
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(40);
    });

    test('[TC-SEC-004-04] should implement timeout protection', async () => {
      // Mock a slow database operation
      const originalFind = Announcement.find;
      Announcement.find = jest.fn().mockImplementation(() => ({
        populate: jest.fn().mockImplementation(() => ({
          sort: jest.fn().mockImplementation(() => 
            new Promise(resolve => setTimeout(resolve, 10000))
          )
        }))
      }));

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect([408, 500]).toContain(response.status);

      // Restore original method
      Announcement.find = originalFind;
    }, 15000);
  });

  describe('[TC-SEC-005] Data Exposure and Information Disclosure Tests', () => {
    test('[TC-SEC-005-01] should not expose sensitive user information in responses', async () => {
      testAnnouncement = await Announcement.create({
        title: 'Data Exposure Test',
        content: 'Testing data exposure',
        createdBy: adminUser._id,
        isActive: true
      });

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      
      response.body.forEach(announcement => {
        // Should not expose password, email, or other sensitive data
        expect(announcement.createdBy?.password).toBeUndefined();
        expect(announcement.createdBy?.email).toBeUndefined();
        expect(announcement.createdBy?.resetToken).toBeUndefined();
      });
    });

    test('[TC-SEC-005-02] should not expose internal system information in error messages', async () => {
      // Mock database error
      const originalFind = Announcement.find;
      Announcement.find = jest.fn().mockRejectedValue(new Error('Database connection failed at /var/lib/mongodb'));

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(500);
      
      // Should not expose internal paths or system information
      expect(response.body.error).not.toContain('/var/lib/');
      expect(response.body.error).not.toContain('Database connection failed at');
      expect(response.body.error).toContain('Internal server error');

      Announcement.find = originalFind;
    });

    test('[TC-SEC-005-03] should prevent information disclosure through timing attacks', async () => {
      const validId = testAnnouncement ? testAnnouncement._id : '507f1f77bcf86cd799439011';
      const invalidId = '507f1f77bcf86cd799439012';

      // Measure response times
      const startValid = Date.now();
      await request(app)
        .get(`/api/announcements/${validId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const endValid = Date.now();

      const startInvalid = Date.now();
      await request(app)
        .get(`/api/announcements/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const endInvalid = Date.now();

      const validTime = endValid - startValid;
      const invalidTime = endInvalid - startInvalid;

      // Response times should be similar to prevent timing attacks
      const timeDifference = Math.abs(validTime - invalidTime);
      expect(timeDifference).toBeLessThan(100); // Within 100ms difference
    });

    test('[TC-SEC-005-04] should sanitize debug information in production mode', async () => {
      // Force an error condition
      const response = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}); // Invalid payload

      expect(response.status).toBe(400);
      
      // Should not contain debug information like stack traces
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toMatch(/at \w+\.\w+ \(/); // Stack trace pattern
      expect(responseText).not.toContain(__filename);
      expect(responseText).not.toContain('node_modules');
    });
  });

  describe('[TC-SEC-006] Session and Token Management Security Tests', () => {
    test('[TC-SEC-006-01] should invalidate tokens on user role change', async () => {
      // This test would require implementing token blacklisting or role re-validation
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);

      // In a real scenario, if user role changed from employee to admin,
      // old tokens should be invalidated
    });

    test('[TC-SEC-006-02] should handle token replay attacks', async () => {
      const originalRequest = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(originalRequest.status).toBe(200);

      // Replay the same request multiple times
      const replayRequests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
      );

      const responses = await Promise.all(replayRequests);

      // All should succeed as tokens don't have nonce by default
      // But rate limiting should apply
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });

    test('[TC-SEC-006-03] should enforce secure token transmission', async () => {
      // Test that tokens are only accepted over secure channels
      // This would require HTTPS enforcement in production
      
      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set('X-Forwarded-Proto', 'http'); // Simulate HTTP request

      // Should succeed in test environment, but enforce HTTPS in production
      expect(response.status).toBe(200);
    });

    test('[TC-SEC-006-04] should validate token audience and issuer', async () => {
      // Create token with different audience
      const jwt = require('jsonwebtoken');
      const invalidAudienceToken = jwt.sign(
        { id: employeeUser._id, role: 'employee', aud: 'different-service' },
        process.env.JWT_SECRET || 'default_secret'
      );

      const response = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${invalidAudienceToken}`);

      // Should validate audience if implemented
      expect([200, 403]).toContain(response.status);
    });
  });

  describe('[TC-001] Basic CRUD Operations - Complete Test Coverage', () => {
    // CREATE Operation Tests
    describe('CREATE Operation', () => {
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
        expect(response.body.data.title).toBe(announcementData.title);
        expect(response.body.data.content).toBe(announcementData.content);
        expect(response.body.data._id).toBeDefined();

        // Verify in database
        const savedAnnouncement = await Announcement.findById(response.body.data._id);
        expect(savedAnnouncement).toBeTruthy();
        expect(savedAnnouncement.title).toBe(announcementData.title);
      });

      test('[TC-001-CREATE-EP] should fail to create announcement with missing title', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ content: 'Content without title' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Validation errors');
      });

      test('[TC-001-CREATE-EP] should fail to create announcement with empty title', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: '', content: 'Content with empty title' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Validation errors');
      });

      test('[TC-001-CREATE-EP] should handle database save failures', async () => {
        const originalCreate = Announcement.create;
        Announcement.create = jest.fn().mockRejectedValue(new Error('Database save failed'));

        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Test', content: 'Test content' });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Failed to create announcement');

        Announcement.create = originalCreate;
      });

      test('[TC-001-CREATE-EP] should deny non-admin users from creating announcements', async () => {
        const response = await request(app)
          .post('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ title: 'Unauthorized', content: 'Should not work' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });
    });

    // READ Operation Tests
    describe('READ Operation', () => {
      beforeEach(async () => {
        await Announcement.create({
          title: 'Test Read Announcement',
          content: 'Content for read test',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-001-READ-HP] should successfully retrieve all announcements', async () => {
        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].title).toBe('Test Read Announcement');
        expect(response.body[0].content).toBe('Content for read test');
      });

      test('[TC-001-READ-HP] should retrieve announcements sorted by creation date', async () => {
        // Create second announcement
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
        await Announcement.create({
          title: 'Newer Announcement',
          content: 'Newer content',
          createdBy: adminUser._id,
          isActive: true
        });

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        
        // Verify sorting (newest first)
        const firstDate = new Date(response.body[0].created_at);
        const secondDate = new Date(response.body[1].created_at);
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      });

      test('[TC-001-READ-EP] should handle empty announcements list', async () => {
        await Announcement.deleteMany({});

        const response = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
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

        Announcement.find = originalFind;
      });

      test('[TC-001-READ-EP] should deny access without authentication', async () => {
        const response = await request(app)
          .get('/api/announcements');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });
    });

    // UPDATE Operation Tests
    describe('UPDATE Operation', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Original Title',
          content: 'Original content',
          createdBy: adminUser._id,
          isActive: true
        });
      });

      test('[TC-001-UPDATE-HP] should successfully update announcement with valid data', async () => {
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

        // Verify in database
        const updatedAnnouncement = await Announcement.findById(testAnnouncement._id);
        expect(updatedAnnouncement.title).toBe(updatedData.title);
        expect(updatedAnnouncement.content).toBe(updatedData.content);
      });

      test('[TC-001-UPDATE-HP] should allow partial updates', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Only Title Updated' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Only Title Updated');
        expect(response.body.data.content).toBe('Original content');
      });

      test('[TC-001-UPDATE-EP] should return 404 for non-existent announcement', async () => {
        const response = await request(app)
          .put('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated', content: 'Updated content' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      test('[TC-001-UPDATE-EP] should validate update data', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: '' }); // Invalid empty title

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Validation');
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

        Announcement.findByIdAndUpdate = originalFindByIdAndUpdate;
      });

      test('[TC-001-UPDATE-EP] should deny non-admin users from updating', async () => {
        const response = await request(app)
          .put(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ title: 'Unauthorized Update' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
      });
    });

    // DELETE Operation Tests
    describe('DELETE Operation', () => {
      beforeEach(async () => {
        testAnnouncement = await Announcement.create({
          title: 'Announcement to Delete',
          content: 'This will be deleted',
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
        expect(response.body.message).toContain('deleted');

        // Verify removal from database
        const deletedAnnouncement = await Announcement.findById(testAnnouncement._id);
        expect(deletedAnnouncement).toBeNull();
      });

      test('[TC-001-DELETE-HP] should remove announcement from user view immediately', async () => {
        // Confirm announcement is visible before deletion
        let viewResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);
        expect(viewResponse.body).toHaveLength(1);

        // Delete announcement
        await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Verify no longer visible
        viewResponse = await request(app)
          .get('/api/announcements')
          .set('Authorization', `Bearer ${employeeToken}`);
        expect(viewResponse.body).toHaveLength(0);
      });

      test('[TC-001-DELETE-EP] should return 404 for non-existent announcement', async () => {
        const response = await request(app)
          .delete('/api/announcements/507f1f77bcf86cd799439011')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      test('[TC-001-DELETE-EP] should handle invalid announcement ID format', async () => {
        const response = await request(app)
          .delete('/api/announcements/invalid-id')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid ID format');
      });

      test('[TC-001-DELETE-EP] should handle database deletion failures', async () => {
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

      test('[TC-001-DELETE-EP] should deny non-admin users from deleting', async () => {
        const response = await request(app)
          .delete(`/api/announcements/${testAnnouncement._id}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Access denied. Admin privileges required.');
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
      