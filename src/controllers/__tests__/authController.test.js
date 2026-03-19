const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../../models/User');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-001: User authentication and role-based access control for admin and employee roles
  describe('POST /api/auth/login', () => {
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
    });

    it('should reject login with invalid credentials', async () => {
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