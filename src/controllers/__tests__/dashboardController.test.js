const request = require('supertest');
const app = require('../../app');
const Employee = require('../../models/Employee');
const LeaveRequest = require('../../models/LeaveRequest');
const InventoryItem = require('../../models/Inventory');
const FinancialRecord = require('../../models/FinancialRecord');

jest.mock('../../models/Employee');
jest.mock('../../models/LeaveRequest');
jest.mock('../../models/Inventory');
jest.mock('../../models/FinancialRecord');
jest.mock('../../middleware/auth');

const mockAuth = require('../../middleware/auth');
mockAuth.authenticateToken = (req, res, next) => {
  req.user = { id: 'admin123', role: 'admin', email: 'admin@company.com', companyId: 'comp123' };
  next();
};

describe('Dashboard Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-005: Dashboard metrics calculation - Happy path and error scenarios
  describe('TC-005: Dashboard metrics calculation', () => {
    describe('Happy path - successful metrics calculation', () => {
      it('should calculate all dashboard metrics correctly for admin user', async () => {
        // Mock all required data for metrics calculation
        const mockStats = {
          totalEmployees: 15,
          pendingLeaves: 5,
          thisMonthLeaves: 18,
          totalInventoryItems: 67,
          lowStockItems: 4
        };

        const mockRecentLeaves = [
          {
            _id: 'leave1',
            employeeId: { firstName: 'John', lastName: 'Doe', email: 'john@company.com' },
            leaveType: 'annual',
            startDate: '2024-02-20',
            endDate: '2024-02-22',
            status: 'pending',
            totalDays: 3
          }
        ];

        const mockLowBalanceEmployees = [
          {
            firstName: 'Alice',
            lastName: 'Johnson',
            email: 'alice@company.com',
            leaveBalance: { annual: 2 }
          }
        ];

        // Setup all mocks for successful calculation
        Employee.countDocuments.mockImplementation((filter) => {
          if (filter.status === 'active') return Promise.resolve(mockStats.totalEmployees);
          return Promise.resolve(0);
        });

        LeaveRequest.countDocuments.mockImplementation((filter) => {
          if (filter.status === 'pending') return Promise.resolve(mockStats.pendingLeaves);
          if (filter.startDate) return Promise.resolve(mockStats.thisMonthLeaves);
          return Promise.resolve(0);
        });

        LeaveRequest.find.mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockRecentLeaves)
            })
          })
        });

        Employee.find.mockReturnValue({
          select: jest.fn().mockResolvedValue(mockLowBalanceEmployees)
        });

        InventoryItem.countDocuments.mockImplementation((filter) => {
          if (filter.companyId) {
            if (filter.$expr) return Promise.resolve(mockStats.lowStockItems);
            return Promise.resolve(mockStats.totalInventoryItems);
          }
          return Promise.resolve(0);
        });

        const response = await request(app)
          .get('/api/dashboard');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        // Validate metrics calculation results
        expect(response.body.data.stats).toEqual({
          totalEmployees: mockStats.totalEmployees,
          pendingLeaves: mockStats.pendingLeaves,
          thisMonthLeaves: mockStats.thisMonthLeaves,
          inventoryStats: {
            totalItems: mockStats.totalInventoryItems,
            lowStockItems: mockStats.lowStockItems
          }
        });
        
        expect(response.body.data.recentLeaveRequests).toEqual(mockRecentLeaves);
        expect(response.body.data.lowLeaveBalanceEmployees).toEqual(mockLowBalanceEmployees);
      });

      it('should calculate personal metrics correctly for employee user', async () => {
        // Mock employee authentication
        mockAuth.authenticateToken = (req, res, next) => {
          req.user = { id: 'emp123', role: 'employee', email: 'employee@company.com' };
          next();
        };

        const mockEmployee = {
          _id: 'emp123',
          firstName: 'John',
          lastName: 'Employee',
          leaveBalance: { annual: 12, sick: 6, personal: 3 }
        };

        const mockMyLeaves = [
          {
            _id: 'leave1',
            leaveType: 'annual',
            startDate: '2024-03-01',
            endDate: '2024-03-03',
            status: 'approved',
            totalDays: 3
          }
        ];

        Employee.findById.mockResolvedValue(mockEmployee);
        LeaveRequest.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockMyLeaves)
          })
        });

        const response = await request(app)
          .get('/api/dashboard');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.personalStats).toBeDefined();
        expect(response.body.data.myRecentLeaves).toEqual(mockMyLeaves);
        expect(response.body.data.leaveBalance).toEqual(mockEmployee.leaveBalance);
      });

      it('should handle zero metrics calculation correctly', async () => {
        // Mock scenario with all zero values
        Employee.countDocuments.mockResolvedValue(0);
        LeaveRequest.countDocuments.mockResolvedValue(0);
        LeaveRequest.find.mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([])
            })
          })
        });
        Employee.find.mockReturnValue({
          select: jest.fn().mockResolvedValue([])
        });
        InventoryItem.countDocuments.mockResolvedValue(0);

        const response = await request(app)
          .get('/api/dashboard');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.stats).toEqual({
          totalEmployees: 0,
          pendingLeaves: 0,
          thisMonthLeaves: 0,
          inventoryStats: {
            totalItems: 0,
            lowStockItems: 0
          }
        });
        expect(response.body.data.recentLeaveRequests).toEqual([]);
        expect(response.body.data.lowLeaveBalanceEmployees).toEqual([]);
      });
    });

    describe('Error path - metrics calculation failures', () => {
      it('should handle employee count calculation error', async () => {
        Employee.countDocuments.mockRejectedValue(new Error('Database connection failed'));
        
        const response = await request(app)
          .get('/api/dashboard');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Failed to load dashboard data');
      });

      it('should handle leave request metrics calculation error', async () => {
        Employee.countDocuments.mockResolvedValue(10);
        LeaveRequest.countDocuments.mockRejectedValue(new Error('Leave query failed'));
        
        const response = await request(app)
          .get('/api/dashboard');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Failed to load dashboard data');
      });

      it('should handle inventory metrics calculation error', async () => {
        Employee.countDocuments.mockResolvedValue(10);
        LeaveRequest.countDocuments.mockResolvedValue(5);
        LeaveRequest.find.mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([])
            })
          })
        });
        Employee.find.mockReturnValue({
          select: jest.fn().mockResolvedValue([])
        });
        InventoryItem.countDocuments.mockRejectedValue(new Error('Inventory query failed'));
        
        const response = await request(app)
          .get('/api/dashboard');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Failed to load dashboard data');
      });

      it('should handle partial data fetch errors gracefully', async () => {
        Employee.countDocuments.mockResolvedValue(10);
        LeaveRequest.countDocuments.mockResolvedValue(5);
        LeaveRequest.find.mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              limit: jest.fn().mockRejectedValue(new Error('Recent leaves fetch failed'))
            })
          })
        });
        
        const response = await request(app)
          .get('/api/dashboard');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Failed to load dashboard data');
      });

      it('should handle employee profile fetch error for personal dashboard', async () => {
        mockAuth.authenticateToken = (req, res, next) => {
          req.user = { id: 'emp123', role: 'employee', email: 'employee@company.com' };
          next();
        };

        Employee.findById.mockRejectedValue(new Error('Employee not found'));
        
        const response = await request(app)
          .get('/api/dashboard');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Failed to load dashboard data');
      });
    });
  });

  // TC-006: Dashboard showing company overview with key metrics and pending leave requests
  describe('GET /api/dashboard', () => {
    it('should return admin dashboard with company overview and key metrics', async () => {
      const mockStats = {
        totalEmployees: 8,
        pendingLeaves: 3,
        thisMonthLeaves: 12,
        totalInventoryItems: 45,
        lowStockItems: 2
      };

      const mockRecentLeaves = [
        {
          _id: 'leave1',
          employeeId: { firstName: 'John', lastName: 'Doe', email: 'john@company.com' },
          leaveType: 'annual',
          startDate: '2024-02-20',
          endDate: '2024-02-22',
          status: 'pending',
          totalDays: 3
        },
        {
          _id: 'leave2',
          employeeId: { firstName: 'Jane', lastName: 'Smith', email: 'jane@company.com' },
          leaveType: 'sick',
          startDate: '2024-02-18',
          endDate: '2024-02-19',
          status: 'pending',
          totalDays: 2
        }
      ];

      const mockLowBalanceEmployees = [
        {
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice@company.com',
          leaveBalance: { annual: 3 }
        }
      ];

      Employee.countDocuments.mockImplementation((filter) => {
        if (filter.status === 'active') return Promise.resolve(8);
        return Promise.resolve(0);
      });

      LeaveRequest.countDocuments.mockImplementation((filter) => {
        if (filter.status === 'pending') return Promise.resolve(3);
        if (filter.startDate) return Promise.resolve(12);
        return Promise.resolve(0);
      });

      LeaveRequest.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockRecentLeaves)
          })
        })
      });

      Employee.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockLowBalanceEmployees)
      });

      InventoryItem.countDocuments.mockImplementation((filter) => {
        if (filter.companyId) {
          if (filter.$expr) return Promise.resolve(2); // low stock items
          return Promise.resolve(45); // total items
        }
        return Promise.resolve(0);
      });

      const response = await request(app)
        .get('/api/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toEqual({
        totalEmployees: 8,
        pendingLeaves: 3,
        thisMonthLeaves: 12,
        inventoryStats: {
          totalItems: 45,
          lowStockItems: 2
        }
      });
      expect(response.body.data.recentLeaveRequests).toHaveLength(2);
      expect(response.body.data.lowLeaveBalanceEmployees).toHaveLength(1);
    });

    it('should return employee dashboard with personal overview', async () => {
      mockAuth.authenticateToken = (req, res, next) => {
        req.user = { id: 'emp123', role: 'employee', email: 'employee@company.com' };
        next();
      };

      const mockEmployee = {
        _id: 'emp123',
        firstName: 'John',
        lastName: 'Employee',
        leaveBalance: { annual: 15, sick: 8, personal: 4 }
      };

      const mockMyLeaves = [
        {
          _id: 'leave1',
          leaveType: 'annual',
          startDate: '2024-03-01',
          endDate: '2024-03-03',
          status: 'approved',
          totalDays: 3
        }
      ];

      Employee.findById.mockResolvedValue(mockEmployee);
      LeaveRequest.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockMyLeaves)
        })
      });

      const response = await request(app)
        .get('/api/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.data.personalStats).toBeDefined();
      expect(response.body.data.myRecentLeaves).toHaveLength(1);
      expect(response.body.data.leaveBalance).toEqual({
        annual: 15,
        sick: 8,
        personal: 4
      });
    });

    it('should handle dashboard data fetch errors gracefully', async () => {
      Employee.countDocuments.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/dashboard');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to load dashboard data');
    });
  });

  // TC-007: Basic reporting functionality for HR and business metrics
  describe('GET /api/dashboard/metrics', () => {
    it('should return detailed HR and business metrics for admin', async () => {
      const mockDepartmentStats = [
        { _id: 'Engineering', count: 4 },
        { _id: 'Marketing', count: 2 },
        { _id: 'HR', count: 2 }
      ];

      const mockLeaveTypeStats = [
        { _id: 'annual', totalDays: 25, count: 8 },
        { _id: 'sick', totalDays: 12, count: 4 }
      ];

      const mockFinancialOverview = {
        totalRevenue: 125000,
        totalExpenses: 89000,
        netProfit: 36000
      };

      Employee.aggregate.mockResolvedValue(mockDepartmentStats);
      LeaveRequest.aggregate.mockResolvedValue(mockLeaveTypeStats);
      FinancialRecord.aggregate.mockResolvedValue([
        { _id: 'income', total: 125000 },
        { _id: 'expense', total: 89000 }
      ]);

      const response = await request(app)
        .get('/api/dashboard/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.departmentBreakdown).toEqual(mockDepartmentStats);
      expect(response.body.data.leaveAnalytics).toEqual(mockLeaveTypeStats);
      expect(response.body.data.financialSummary).toBeDefined();
    });

    it('should deny access to metrics for non-admin users', async () => {
      mockAuth.authenticateToken = (req, res, next) => {
        req.user = { id: 'emp123', role: 'employee', email: 'employee@company.com' };
        next();
      };

      const response = await request(app)
        .get('/api/dashboard/metrics');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Insufficient permissions');
    });
  });

  // TC-011: Basic inventory/asset tracking capabilities
  describe('GET /api/dashboard/inventory-overview', () => {
    it('should return inventory overview with low stock alerts', async () => {
      const mockInventoryStats = {
        totalItems: 45,
        totalValue: 125000,
        lowStockItems: 3,
        categories: [
          { category: 'IT Equipment', count: 15, value: 75000 },
          { category: 'Office Supplies', count: 20, value: 5000 },
          { category: 'Furniture', count: 10, value: 45000 }
        ]
      };

      const mockLowStockItems = [
        {
          _id: 'item1',
          itemName: 'Office Chairs',
          currentStock: 2,
          minimumStock: 5,
          category: 'Furniture'
        },
        {
          _id: 'item2',
          itemName: 'Printer Paper',
          currentStock: 8,
          minimumStock: 10,
          category: 'Office Supplies'
        }
      ];

      InventoryItem.countDocuments.mockResolvedValue(45);
      InventoryItem.aggregate.mockResolvedValue(mockInventoryStats.categories);
      InventoryItem.find.mockResolvedValue(mockLowStockItems);

      const response = await request(app)
        .get('/api/dashboard/inventory-overview');

      expect(response.status).toBe(200);
      expect(response.body.data.stats.totalItems).toBe(45);
      expect(response.body.data.lowStockAlerts).toHaveLength(2);
      expect(response.body.data.categoryBreakdown).toEqual(mockInventoryStats.categories);
    });
  });

  // TC-012: Financial overview dashboard with basic accounting features
  describe('GET /api/dashboard/financial-overview', () => {
    it('should return financial overview with revenue, expenses and profit', async () => {
      const mockFinancialData = [
        { _id: 'income', totalAmount: 150000, count: 25 },
        { _id: 'expense', totalAmount: 95000, count: 45 }
      ];

      const mockMonthlyTrends = [
        { _id: { month: 1, year: 2024 }, income: 45000, expense: 28000 },
        { _id: { month: 2, year: 2024 }, income: 52000, expense: 31000 }
      ];

      FinancialRecord.aggregate.mockImplementation((pipeline) => {
        if (pipeline.some(stage => stage.$group && stage.$group._id === '$type')) {
          return Promise.resolve(mockFinancialData);
        }
        return Promise.resolve(mockMonthlyTrends);
      });

      const response = await request(app)
        .get('/api/dashboard/financial-overview');

      expect(response.status).toBe(200);
      expect(response.body.data.summary).toEqual({
        totalRevenue: 150000,
        totalExpenses: 95000,
        netProfit: 55000,
        revenueTransactions: 25,
        expenseTransactions: 45
      });
      expect(response.body.data.monthlyTrends).toEqual(mockMonthlyTrends);
    });

    it('should handle empty financial data gracefully', async () => {
      FinancialRecord.aggregate.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/dashboard/financial-overview');

      expect(response.status).toBe(200);
      expect(response.body.data.summary).toEqual({
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        revenueTransactions: 0,
        expenseTransactions: 0
      });
    });
  });
});