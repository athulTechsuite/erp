const request = require('supertest');
const app = require('../../app');
const Leave = require('../../models/LeaveRequest');
const Employee = require('../../models/Employee');

jest.mock('../../models/LeaveRequest');
jest.mock('../../models/Employee');
jest.mock('../../middleware/auth');

// Mock auth middleware to simulate authenticated users
const mockAuth = require('../../middleware/auth');
mockAuth.authenticateToken = (req, res, next) => {
  req.user = { id: 'user123', role: 'employee', email: 'test@company.com' };
  next();
};
mockAuth.requireRole = (roles) => (req, res, next) => {
  if (roles.includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
};

describe('Leave Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-003: Leave request submission workflow for employees
  describe('POST /api/leaves', () => {
    it('should create leave request successfully with valid data', async () => {
      const leaveRequestData = {
        leaveType: 'annual',
        startDate: '2024-02-15',
        endDate: '2024-02-17',
        reason: 'Personal vacation',
        totalDays: 3
      };

      const mockEmployee = {
        _id: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        leaveBalances: { annual: 20 }
      };

      const mockLeaveRequest = {
        _id: 'leave123',
        ...leaveRequestData,
        employee: 'user123',
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      Employee.findById.mockResolvedValue(mockEmployee);
      Leave.mockImplementation(() => mockLeaveRequest);
      Leave.prototype.save = jest.fn().mockResolvedValue(mockLeaveRequest);

      const response = await request(app)
        .post('/api/leaves')
        .send(leaveRequestData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.message).toContain('submitted successfully');
    });

    it('should reject leave request when insufficient balance', async () => {
      const leaveRequestData = {
        leaveType: 'annual',
        startDate: '2024-02-15',
        endDate: '2024-03-01',
        reason: 'Long vacation',
        totalDays: 15
      };

      const mockEmployee = {
        _id: 'user123',
        leaveBalances: { annual: 5 } // Insufficient balance
      };

      Employee.findById.mockResolvedValue(mockEmployee);

      const response = await request(app)
        .post('/api/leaves')
        .send(leaveRequestData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Insufficient leave balance');
    });

    it('should reject leave request with invalid date range', async () => {
      const leaveRequestData = {
        leaveType: 'annual',
        startDate: '2024-02-17',
        endDate: '2024-02-15', // End date before start date
        reason: 'Invalid dates',
        totalDays: 3
      };

      const response = await request(app)
        .post('/api/leaves')
        .send(leaveRequestData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid date range');
    });
  });

  // TC-004: Leave approval/rejection workflow for managers/admins
  describe('PUT /api/leaves/:id/approve', () => {
    beforeEach(() => {
      mockAuth.authenticateToken = (req, res, next) => {
        req.user = { id: 'admin123', role: 'admin', email: 'admin@company.com' };
        next();
      };
    });

    it('should approve leave request successfully by admin', async () => {
      const mockLeaveRequest = {
        _id: 'leave123',
        employee: 'user123',
        status: 'pending',
        leaveType: 'annual',
        totalDays: 3,
        save: jest.fn().mockResolvedValue(true)
      };

      const mockEmployee = {
        _id: 'user123',
        leaveBalances: { annual: 20 },
        save: jest.fn().mockResolvedValue(true)
      };

      Leave.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockLeaveRequest)
      });
      Employee.findById.mockResolvedValue(mockEmployee);

      const response = await request(app)
        .put('/api/leaves/leave123/approve')
        .send({ comments: 'Approved for vacation' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('approved successfully');
      expect(mockLeaveRequest.status).toBe('approved');
    });

    it('should reject leave request with reason by admin', async () => {
      const mockLeaveRequest = {
        _id: 'leave123',
        employee: 'user123',
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      Leave.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockLeaveRequest)
      });

      const response = await request(app)
        .put('/api/leaves/leave123/reject')
        .send({ rejectionReason: 'Insufficient coverage during requested period' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockLeaveRequest.status).toBe('rejected');
      expect(mockLeaveRequest.rejectionReason).toContain('Insufficient coverage');
    });

    it('should deny approval access to regular employees', async () => {
      mockAuth.authenticateToken = (req, res, next) => {
        req.user = { id: 'user123', role: 'employee', email: 'employee@company.com' };
        next();
      };

      const response = await request(app)
        .put('/api/leaves/leave123/approve')
        .send({ comments: 'Trying to approve own request' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Insufficient permissions');
    });
  });

  // TC-005: Leave balance tracking and automatic calculation
  describe('GET /api/leaves/balance', () => {
    it('should return current leave balance for authenticated user', async () => {
      const mockEmployee = {
        _id: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        leaveBalances: {
          annual: 17,
          sick: 8,
          personal: 5
        }
      };

      const mockUsedLeaves = [
        { leaveType: 'annual', totalDays: 3, status: 'approved' }
      ];

      Employee.findById.mockResolvedValue(mockEmployee);
      Leave.find.mockResolvedValue(mockUsedLeaves);

      const response = await request(app)
        .get('/api/leaves/balance');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.balances).toEqual({
        annual: { remaining: 17, used: 3, total: 20 },
        sick: { remaining: 8, used: 0, total: 8 },
        personal: { remaining: 5, used: 0, total: 5 }
      });
    });

    it('should handle employee not found error', async () => {
      Employee.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/leaves/balance');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Employee not found');
    });
  });

  describe('GET /api/leaves', () => {
    it('should return employee own leave requests', async () => {
      const mockLeaves = [
        {
          _id: 'leave1',
          leaveType: 'annual',
          startDate: '2024-02-15',
          endDate: '2024-02-17',
          status: 'approved',
          totalDays: 3
        },
        {
          _id: 'leave2',
          leaveType: 'sick',
          startDate: '2024-01-10',
          endDate: '2024-01-11',
          status: 'approved',
          totalDays: 2
        }
      ];

      Leave.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockLeaves)
        })
      });

      const response = await request(app)
        .get('/api/leaves');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(Leave.find).toHaveBeenCalledWith({ employee: 'user123' });
    });

    it('should return all leave requests for admin users', async () => {
      mockAuth.authenticateToken = (req, res, next) => {
        req.user = { id: 'admin123', role: 'admin', email: 'admin@company.com' };
        next();
      };

      const mockLeaves = [
        { _id: 'leave1', employee: 'user123', status: 'pending' },
        { _id: 'leave2', employee: 'user456', status: 'approved' }
      ];

      Leave.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockLeaves)
        })
      });

      const response = await request(app)
        .get('/api/leaves');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(Leave.find).toHaveBeenCalledWith({}); // No employee filter for admin
    });
  });
});