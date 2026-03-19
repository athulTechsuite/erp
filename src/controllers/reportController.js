const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const Asset = require('../models/Asset');
const FinancialRecord = require('../models/FinancialRecord');
const { validationResult } = require('express-validator');

class ReportController {
  // Get employee report
  async getEmployeeReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { startDate, endDate, department, format } = req.query;
      
      // Build query filters
      const filters = {
        role: 'employee',
        isActive: true
      };

      if (department) {
        filters.department = department;
      }

      // Get employees with aggregated data
      const employees = await User.find(filters)
        .select('-password')
        .lean();

      // Get leave statistics for each employee
      const employeeReports = await Promise.all(employees.map(async (employee) => {
        const leaveQuery = {
          userId: employee._id
        };

        if (startDate && endDate) {
          leaveQuery.startDate = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          };
        }

        const leaveRequests = await LeaveRequest.find(leaveQuery);
        const approvedLeaves = leaveRequests.filter(leave => leave.status === 'approved');
        
        const totalLeaveDays = approvedLeaves.reduce((sum, leave) => {
          const days = Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1;
          return sum + days;
        }, 0);

        return {
          ...employee,
          leaveStatistics: {
            totalRequests: leaveRequests.length,
            approvedRequests: approvedLeaves.length,
            pendingRequests: leaveRequests.filter(leave => leave.status === 'pending').length,
            rejectedRequests: leaveRequests.filter(leave => leave.status === 'rejected').length,
            totalLeaveDays,
            remainingLeave: employee.leaveBalance - totalLeaveDays
          }
        };
      }));

      const reportData = {
        reportType: 'employee',
        generatedAt: new Date(),
        filters: { startDate, endDate, department },
        summary: {
          totalEmployees: employees.length,
          totalLeaveRequests: employeeReports.reduce((sum, emp) => sum + emp.leaveStatistics.totalRequests, 0),
          totalLeaveDays: employeeReports.reduce((sum, emp) => sum + emp.leaveStatistics.totalLeaveDays, 0)
        },
        data: employeeReports
      };

      if (format === 'csv') {
        return this.exportToCSV(res, reportData, 'employee-report');
      }

      res.json({
        success: true,
        report: reportData
      });

    } catch (error) {
      console.error('Error generating employee report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate employee report'
      });
    }
  }

  // Get leave report
  async getLeaveReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { startDate, endDate, status, department, format } = req.query;
      
      // Build query filters
      const filters = {};

      if (startDate && endDate) {
        filters.startDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      if (status) {
        filters.status = status;
      }

      // Get leave requests with user details
      let leaveQuery = LeaveRequest.find(filters)
        .populate('userId', 'firstName lastName email department')
        .sort({ createdAt: -1 });

      const leaveRequests = await leaveQuery.lean();

      // Filter by department if specified
      let filteredRequests = leaveRequests;
      if (department) {
        filteredRequests = leaveRequests.filter(leave => 
          leave.userId && leave.userId.department === department
        );
      }

      // Calculate statistics
      const statusCounts = filteredRequests.reduce((acc, leave) => {
        acc[leave.status] = (acc[leave.status] || 0) + 1;
        return acc;
      }, {});

      const totalLeaveDays = filteredRequests.reduce((sum, leave) => {
        const days = Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1;
        return sum + days;
      }, 0);

      const reportData = {
        reportType: 'leave',
        generatedAt: new Date(),
        filters: { startDate, endDate, status, department },
        summary: {
          totalRequests: filteredRequests.length,
          statusBreakdown: statusCounts,
          totalLeaveDays,
          averageLeaveDuration: filteredRequests.length > 0 ? totalLeaveDays / filteredRequests.length : 0
        },
        data: filteredRequests
      };

      if (format === 'csv') {
        return this.exportToCSV(res, reportData, 'leave-report');
      }

      res.json({
        success: true,
        report: reportData
      });

    } catch (error) {
      console.error('Error generating leave report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate leave report'
      });
    }
  }

  // Get financial report
  async getFinancialReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { startDate, endDate, type, format } = req.query;
      
      // Build query filters
      const filters = {};

      if (startDate && endDate) {
        filters.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      if (type) {
        filters.type = type;
      }

      // Get financial records
      const financialRecords = await FinancialRecord.find(filters)
        .sort({ date: -1 })
        .lean();

      // Calculate totals
      const totals = financialRecords.reduce((acc, record) => {
        if (record.type === 'income') {
          acc.totalIncome += record.amount;
        } else if (record.type === 'expense') {
          acc.totalExpenses += record.amount;
        }
        return acc;
      }, { totalIncome: 0, totalExpenses: 0 });

      // Group by category
      const categoryBreakdown = financialRecords.reduce((acc, record) => {
        if (!acc[record.category]) {
          acc[record.category] = { income: 0, expenses: 0, count: 0 };
        }
        
        if (record.type === 'income') {
          acc[record.category].income += record.amount;
        } else {
          acc[record.category].expenses += record.amount;
        }
        acc[record.category].count++;
        
        return acc;
      }, {});

      // Monthly breakdown
      const monthlyBreakdown = financialRecords.reduce((acc, record) => {
        const monthKey = new Date(record.date).toISOString().substring(0, 7);
        if (!acc[monthKey]) {
          acc[monthKey] = { income: 0, expenses: 0 };
        }
        
        if (record.type === 'income') {
          acc[monthKey].income += record.amount;
        } else {
          acc[monthKey].expenses += record.amount;
        }
        
        return acc;
      }, {});

      const reportData = {
        reportType: 'financial',
        generatedAt: new Date(),
        filters: { startDate, endDate, type },
        summary: {
          totalRecords: financialRecords.length,
          totalIncome: totals.totalIncome,
          totalExpenses: totals.totalExpenses,
          netIncome: totals.totalIncome - totals.totalExpenses,
          categoryBreakdown,
          monthlyBreakdown
        },
        data: financialRecords
      };

      if (format === 'csv') {
        return this.exportToCSV(res, reportData, 'financial-report');
      }

      res.json({
        success: true,
        report: reportData
      });

    } catch (error) {
      console.error('Error generating financial report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate financial report'
      });
    }
  }

  // Get asset report
  async getAssetReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { category, status, assignedTo, format } = req.query;
      
      // Build query filters
      const filters = {};

      if (category) {
        filters.category = category;
      }

      if (status) {
        filters.status = status;
      }

      if (assignedTo) {
        filters.assignedTo = assignedTo;
      }

      // Get assets with assigned user details
      const assets = await Asset.find(filters)
        .populate('assignedTo', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .lean();

      // Calculate statistics
      const statusCounts = assets.reduce((acc, asset) => {
        acc[asset.status] = (acc[asset.status] || 0) + 1;
        return acc;
      }, {});

      const categoryBreakdown = assets.reduce((acc, asset) => {
        if (!acc[asset.category]) {
          acc[asset.category] = { count: 0, totalValue: 0 };
        }
        acc[asset.category].count++;
        acc[asset.category].totalValue += asset.value || 0;
        return acc;
      }, {});

      const totalValue = assets.reduce((sum, asset) => sum + (asset.value || 0), 0);

      const reportData = {
        reportType: 'asset',
        generatedAt: new Date(),
        filters: { category, status, assignedTo },
        summary: {
          totalAssets: assets.length,
          totalValue,
          statusBreakdown: statusCounts,
          categoryBreakdown,
          assignedAssets: assets.filter(asset => asset.assignedTo).length,
          availableAssets: assets.filter(asset => asset.status === 'available').length
        },
        data: assets
      };

      if (format === 'csv') {
        return this.exportToCSV(res, reportData, 'asset-report');
      }

      res.json({
        success: true,
        report: reportData
      });

    } catch (error) {
      console.error('Error generating asset report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate asset report'
      });
    }
  }

  // Get dashboard overview report
  async getDashboardReport(req, res) {
    try {
      const { timeframe = '30' } = req.query;
      const days = parseInt(timeframe);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get parallel data
      const [
        employeeCount,
        pendingLeaves,
        recentLeaves,
        financialSummary,
        assetSummary
      ] = await Promise.all([
        User.countDocuments({ role: 'employee', isActive: true }),
        LeaveRequest.countDocuments({ status: 'pending' }),
        LeaveRequest.find({
          createdAt: { $gte: startDate }
        }).populate('userId', 'firstName lastName'),
        FinancialRecord.aggregate([
          {
            $match: {
              date: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: '$type',
              total: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ]),
        Asset.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalValue: { $sum: '$value' }
            }
          }
        ])
      ]);

      // Process financial summary
      const financial = financialSummary.reduce((acc, item) => {
        acc[item._id] = {
          total: item.total,
          count: item.count
        };
        return acc;
      }, { income: { total: 0, count: 0 }, expense: { total: 0, count: 0 } });

      // Process asset summary
      const assets = assetSummary.reduce((acc, item) => {
        acc[item._id] = {
          count: item.count,
          totalValue: item.totalValue
        };
        return acc;
      }, {});

      const reportData = {
        reportType: 'dashboard',
        generatedAt: new Date(),
        timeframe: `${days} days`,
        summary: {
          employees: {
            total: employeeCount,
            active: employeeCount
          },
          leaves: {
            pending: pendingLeaves,
            recentRequests: recentLeaves.length,
            recentData: recentLeaves.slice(0, 10)
          },
          financial: {
            income: financial.income?.total || 0,
            expenses: financial.expense?.total || 0,
            netIncome: (financial.income?.total || 0) - (financial.expense?.total || 0),
            transactionCount: (financial.income?.count || 0) + (financial.expense?.count || 0)
          },
          assets: {
            total: Object.values(assets).reduce((sum, item) => sum + item.count, 0),
            totalValue: Object.values(assets).reduce((sum, item) => sum + item.totalValue, 0),
            breakdown: assets
          }
        }
      };

      res.json({
        success: true,
        report: reportData
      });

    } catch (error) {
      console.error('Error generating dashboard report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate dashboard report'
      });
    }
  }

  // Export to CSV helper method
  exportToCSV(res, reportData, filename) {
    try {
      let csvContent = '';
      const timestamp = new Date().toISOString().split('T')[0];
      
      // Add report header
      csvContent += `Report Type: ${reportData.reportType}\n`;
      csvContent += `Generated: ${reportData.generatedAt}\n\n`;

      // Add summary section
      csvContent += 'SUMMARY\n';
      Object.entries(reportData.summary).forEach(([key, value]) => {
        if (typeof value === 'object') {
          csvContent += `${key}:\n`;
          Object.entries(value).forEach(([subKey, subValue]) => {
            csvContent += `  ${subKey}: ${subValue}\n`;
          });
        } else {
          csvContent += `${key}: ${value}\n`;
        }
      });
      csvContent += '\n';

      // Add data section based on report type
      if (reportData.reportType === 'employee') {
        csvContent += 'EMPLOYEE DATA\n';
        csvContent += 'Name,Email,Department,Position,Leave Balance,Total Leave Days,Pending Requests\n';
        reportData.data.forEach(emp => {
          csvContent += `"${emp.firstName} ${emp.lastName}",${emp.email},${emp.department || ''},${emp.position || ''},${emp.leaveBalance},${emp.leaveStatistics.totalLeaveDays},${emp.leaveStatistics.pendingRequests}\n`;
        });
      } else if (reportData.reportType === 'leave') {
        csvContent += 'LEAVE DATA\n';
        csvContent += 'Employee,Leave Type,Start Date,End Date,Days,Status,Reason\n';
        reportData.data.forEach(leave => {
          const employee = leave.userId ? `${leave.userId.firstName} ${leave.userId.lastName}` : 'Unknown';
          const days = Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1;
          csvContent += `"${employee}",${leave.leaveType},${leave.startDate.split('T')[0]},${leave.endDate.split('T')[0]},${days},${leave.status},"${leave.reason || ''}"\n`;
        });
      } else if (reportData.reportType === 'financial') {
        csvContent += 'FINANCIAL DATA\n';
        csvContent += 'Date,Type,Category,Amount,Description,Reference\n';
        reportData.data.forEach(record => {
          csvContent += `${record.date.split('T')[0]},${record.type},${record.category},${record.amount},"${record.description || ''}","${record.reference || ''}"\n`;
        });
      } else if (reportData.reportType === 'asset') {
        csvContent += 'ASSET DATA\n';
        csvContent += 'Name,Category,Status,Value,Assigned To,Purchase Date\n';
        reportData.data.forEach(asset => {
          const assignedTo = asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : '';
          const purchaseDate = asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '';
          csvContent += `"${asset.name}",${asset.category},${asset.status},${asset.value || 0},"${assignedTo}",${purchaseDate}\n`;
        });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}-${timestamp}.csv"`);
      res.send(csvContent);

    } catch (error) {
      console.error('Error exporting to CSV:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export report to CSV'
      });
    }
  }

  // Get available report types and filters
  async getReportTypes(req, res) {
    try {
      const reportTypes = {
        employee: {
          name: 'Employee Report',
          description: 'Comprehensive employee data with leave statistics',
          filters: ['startDate', 'endDate', 'department'],
          formats: ['json', 'csv']
        },
        leave: {
          name: 'Leave Report',
          description: 'Leave requests and approvals analysis',
          filters: ['startDate', 'endDate', 'status', 'department'],
          formats: ['json', 'csv']
        },
        financial: {
          name: 'Financial Report',
          description: 'Income, expenses and financial overview',
          filters: ['startDate', 'endDate', 'type'],
          formats: ['json', 'csv']
        },
        asset: {
          name: 'Asset Report',
          description: 'Asset tracking and assignment report',
          filters: ['category', 'status', 'assignedTo'],
          formats: ['json', 'csv']
        },
        dashboard: {
          name: 'Dashboard Overview',
          description: 'High-level business metrics and KPIs',
          filters: ['timeframe'],
          formats: ['json']
        }
      };

      // Get available filter options
      const [departments, leaveStatuses, assetCategories, assetStatuses] = await Promise.all([
        User.distinct('department', { role: 'employee' }),
        LeaveRequest.distinct('status'),
        Asset.distinct('category'),
        Asset.distinct('status')
      ]);

      const filterOptions = {
        departments: departments.filter(Boolean),
        leaveStatuses,
        assetCategories,
        assetStatuses,
        timeframes: ['7', '30', '90', '180', '365']
      };

      res.json({
        success: true,
        reportTypes,
        filterOptions
      });

    } catch (error) {
      console.error('Error getting report types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get report types'
      });
    }
  }
}

module.exports = new ReportController();