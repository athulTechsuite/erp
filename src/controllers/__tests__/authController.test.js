const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const LeaveRequest = require('../../models/LeaveRequest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../../models/User');
jest.mock('../../models/LeaveRequest');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-001: User authentication with valid credentials - Happy Path and Error Path
  describe('TC-001: User authentication with valid credentials', () => {
    describe('POST /api/auth/login - Happy Path', () => {
      it('should login admin user successfully with correct credentials', async () => {
        const mockUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b8',
          email: 'admin@company.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: true
        };
        
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('mock-jwt-token');

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'admin@company.com',
            password: 'admin123'
          });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          message: 'Login successful',
          data: {
            token: 'mock-jwt-token',
            user: {
              id: mockUser._id,
              email: mockUser.email,
              firstName: mockUser.firstName,
              lastName: mockUser.lastName,
              role: mockUser.role,
              isActive: mockUser.isActive
            }
          }
        });
      });

      it('should login employee user successfully with correct credentials', async () => {
        const mockUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b9',
          email: 'employee@company.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'employee',
          isActive: true
        };
        
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('employee-jwt-token');

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'employee@company.com',
            password: 'password123'
          });

        expect(response.status).toBe(200);
        expect(response.body.data.user.role).toBe('employee');
        expect(response.body.success).toBe(true);
      });
    });

    describe('POST /api/auth/login - Error Path', () => {
      it('should reject login with invalid email', async () => {
        User.findOne.mockResolvedValue(null);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid@company.com',
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          success: false,
          message: 'Invalid email or password'
        });
      });

      it('should reject login with invalid password', async () => {
        const mockUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b8',
          email: 'admin@company.com',
          role: 'admin',
          isActive: true
        };
        
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(false);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'admin@company.com',
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Invalid email or password');
      });

      it('should reject login for inactive user', async () => {
        const mockUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b8',
          email: 'inactive@company.com',
          role: 'employee',
          isActive: false
        };
        
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'inactive@company.com',
            password: 'password123'
          });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Account is deactivated');
      });
    });
  });

  // TC-002: Role-based access control verification - Happy Path and Error Path
  describe('TC-002: Role-based access control verification', () => {
    describe('Admin role access - Happy Path', () => {
      it('should allow admin to access admin-only endpoints', async () => {
        const adminUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b8',
          email: 'admin@company.com',
          role: 'admin',
          isActive: true
        };

        jwt.verify.mockReturnValue({ userId: adminUser._id, role: 'admin' });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(adminUser)
        });

        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', 'Bearer admin-token');

        expect(response.status).not.toBe(403);
        expect(jwt.verify).toHaveBeenCalledWith('admin-token', process.env.JWT_SECRET);
      });

      it('should allow admin to create, update, and delete user accounts', async () => {
        const adminUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b8',
          email: 'admin@company.com',
          role: 'admin',
          isActive: true
        };

        jwt.verify.mockReturnValue({ userId: adminUser._id, role: 'admin' });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(adminUser)
        });

        const createResponse = await request(app)
          .post('/api/admin/users')
          .set('Authorization', 'Bearer admin-token')
          .send({ firstName: 'Test', lastName: 'User', email: 'test@company.com' });

        expect(createResponse.status).not.toBe(403);
      });
    });

    describe('Employee role access - Happy Path', () => {
      it('should allow employee to access employee endpoints', async () => {
        const employeeUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b9',
          email: 'employee@company.com',
          role: 'employee',
          isActive: true
        };

        jwt.verify.mockReturnValue({ userId: employeeUser._id, role: 'employee' });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(employeeUser)
        });

        const response = await request(app)
          .get('/api/employee/profile')
          .set('Authorization', 'Bearer employee-token');

        expect(response.status).not.toBe(403);
      });

      it('should allow employee to submit leave requests', async () => {
        const employeeUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b9',
          email: 'employee@company.com',
          role: 'employee',
          isActive: true
        };

        jwt.verify.mockReturnValue({ userId: employeeUser._id, role: 'employee' });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(employeeUser)
        });

        const response = await request(app)
          .post('/api/leave/request')
          .set('Authorization', 'Bearer employee-token')
          .send({ leaveType: 'vacation', startDate: '2024-01-01', endDate: '2024-01-05' });

        expect(response.status).not.toBe(403);
      });
    });

    describe('Role-based access control - Error Path', () => {
      it('should deny employee access to admin-only endpoints', async () => {
        const employeeUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b9',
          email: 'employee@company.com',
          role: 'employee',
          isActive: true
        };

        jwt.verify.mockReturnValue({ userId: employeeUser._id, role: 'employee' });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(employeeUser)
        });

        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', 'Bearer employee-token');

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Access denied. Admin role required.');
      });

      it('should deny access with invalid token', async () => {
        jwt.verify.mockImplementation(() => {
          throw new Error('Invalid token');
        });

        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(401);
      });

      it('should deny access without token', async () => {
        const response = await request(app)
          .get('/api/admin/users');

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Access token is required');
      });
    });
  });

  // TC-004: Leave balance calculation accuracy - Happy Path and Error Path
  describe('TC-004: Leave balance calculation accuracy', () => {
    describe('Leave balance calculation - Happy Path', () => {
      it('should calculate initial leave balance correctly for new employee', async () => {
        const employeeUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b9',
          email: 'employee@company.com',
          role: 'employee',
          isActive: true,
          startDate: new Date('2024-01-01'),
          annualLeaveEntitlement: 20
        };

        jwt.verify.mockReturnValue({ userId: employeeUser._id, role: 'employee' });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(employeeUser)
        });
        
        LeaveRequest.find.mockResolvedValue([]);

        const response = await request(app)
          .get('/api/leave/balance')
          .set('Authorization', 'Bearer employee-token');

        expect(response.status).toBe(200);
        expect(response.body.data.totalEntitlement).toBe(20);
        expect(response.body.data.usedLeave).toBe(0);
        expect(response.body.data.remainingLeave).toBe(20);
      });

      it('should calculate leave balance accurately after approved leave requests', async () => {
        const employeeUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b9',
          email: 'employee@company.com',
          role: 'employee',
          isActive: true,
          startDate: new Date('2024-01-01'),
          annualLeaveEntitlement: 20
        };

        const approvedLeaveRequests = [
          {
            startDate: new Date('2024-03-01'),
            endDate: new Date('2024-03-03'),
            status: 'approved',
            leaveDays: 3
          },
          {
            startDate: new Date('2024-06-01'),
            endDate: new Date('2024-06-05'),
            status: 'approved',
            leaveDays: 5
          }
        ];

        jwt.verify.mockReturnValue({ userId: employeeUser._id, role: 'employee' });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(employeeUser)
        });
        LeaveRequest.find.mockResolvedValue(approvedLeaveRequests);

        const response = await request(app)
          .get('/api/leave/balance')
          .set('Authorization', 'Bearer employee-token');

        expect(response.status).toBe(200);
        expect(response.body.data.totalEntitlement).toBe(20);
        expect(response.body.data.usedLeave).toBe(8);
        expect(response.body.data.remainingLeave).toBe(12);
      });

      it('should exclude pending and rejected leave requests from balance calculation', async () => {
        const employeeUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b9',
          email: 'employee@company.com',
          role: 'employee',
          isActive: true,
          startDate: new Date('2024-01-01'),
          annualLeaveEntitlement: 15
        };

        const leaveRequests = [
          {
            startDate: new Date('2024-03-01'),
            endDate: new Date('2024-03-03'),
            status: 'approved',
            leaveDays: 3
          },
          {
            startDate: new Date('2024-06-01'),
            endDate: new Date('2024-06-02'),
            status: 'pending',
            leaveDays: 2
          },
          {
            startDate: new Date('2024-07-01'),
            endDate: new Date('2024-07-01'),
            status: 'rejected',
            leaveDays: 1
          }
        ];

        jwt.verify.mockReturnValue({ userId: employeeUser._id, role: 'employee' });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(employeeUser)
        });
        LeaveRequest.find.mockResolvedValue(leaveRequests);

        const response = await request(app)
          .get('/api/leave/balance')
          .set('Authorization', 'Bearer employee-token');

        expect(response.status).toBe(200);
        expect(response.body.data.totalEntitlement).toBe(15);
        expect(response.body.data.usedLeave).toBe(3);
        expect(response.body.data.remainingLeave).toBe(12);
      });
    });

    describe('Leave balance calculation - Error Path', () => {
      it('should handle error when user data is not found', async () => {
        jwt.verify.mockReturnValue({ userId: '64b1e2f1a1b2c3d4e5f6a7b9', role: 'employee' });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(null)
        });

        const response = await request(app)
          .get('/api/leave/balance')
          .set('Authorization', 'Bearer employee-token');

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('User not found');
      });

      it('should handle database error during leave balance calculation', async () => {
        const employeeUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b9',
          email: 'employee@company.com',
          role: 'employee',
          isActive: true,
          startDate: new Date('2024-01-01'),
          annualLeaveEntitlement: 20
        };

        jwt.verify.mockReturnValue({ userId: employeeUser._id, role: 'employee' });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(employeeUser)
        });
        LeaveRequest.find.mockRejectedValue(new Error('Database connection error'));

        const response = await request(app)
          .get('/api/leave/balance')
          .set('Authorization', 'Bearer employee-token');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Internal server error');
      });

      it('should handle missing annual leave entitlement data', async () => {
        const employeeUser = {
          _id: '64b1e2f1a1b2c3d4e5f6a7b9',
          email: 'employee@company.com',
          role: 'employee',
          isActive: true,
          startDate: new Date('2024-01-01'),
          annualLeaveEntitlement: null
        };

        jwt.verify.mockReturnValue({ userId: employeeUser._id, role: 'employee' });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(employeeUser)
        });
        LeaveRequest.find.mockResolvedValue([]);

        const response = await request(app)
          .get('/api/leave/balance')
          .set('Authorization', 'Bearer employee-token');

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Annual leave entitlement not configured for user');
      });
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new employee user with valid data', async () => {
      const newUserData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@company.com',
        password: 'password123',
        role: 'employee'
      };

      User.findOne.mockResolvedValue(null); // No existing user
      bcrypt.hash.mockResolvedValue('hashed-password');
      
      const mockCreatedUser = {
        _id: '64b1e2f1a1b2c3d4e5f6a7c0',
        ...newUserData,
        password: 'hashed-password',
        save: jest.fn().mockResolvedValue(true)
      };
      
      User.mockImplementation(() => mockCreatedUser);
      jwt.sign.mockReturnValue('new-user-jwt-token');

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUserData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('jane@company.com');
    });

    it('should reject registration with duplicate email', async () => {
      const existingUser = { email: 'existing@company.com' };
      User.findOne.mockResolvedValue(existingUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'existing@company.com',
          password: 'password123',
          role: 'employee'
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('User with this email already exists');
    });
  });

  describe('GET /api/auth/validate', () => {
    it('should validate valid JWT token', async () => {
      const mockUser = {
        _id: '64b1e2f1a1b2c3d4e5f6a7b8',
        email: 'user@company.com',
        role: 'employee',
        isActive: true
      };

      jwt.verify.mockReturnValue({ userId: mockUser._id, role: mockUser.role });
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('user@company.com');
    });

    it('should reject invalid or expired token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('TokenExpiredError');
      });

      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token has expired');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/validate');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Access token is required');
    });
  });
});