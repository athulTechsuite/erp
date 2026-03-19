import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class ReportService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Employee Reports
  async getEmployeeReport(filters = {}) {
    try {
      const response = await this.api.get('/reports/employees', {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getEmployeeSummary() {
    try {
      const response = await this.api.get('/reports/employees/summary');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Leave Reports
  async getLeaveReport(filters = {}) {
    try {
      const response = await this.api.get('/reports/leave', {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLeaveAnalytics(period = 'monthly') {
    try {
      const response = await this.api.get(`/reports/leave/analytics`, {
        params: { period }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getDepartmentLeaveReport(departmentId, filters = {}) {
    try {
      const response = await this.api.get(`/reports/departments/${departmentId}/leave`, {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLeaveBalanceReport(employeeId = null) {
    try {
      const endpoint = employeeId 
        ? `/reports/leave-balance/${employeeId}`
        : '/reports/leave-balance';
      const response = await this.api.get(endpoint);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Financial Reports
  async getFinancialOverview(period = 'monthly') {
    try {
      const response = await this.api.get('/reports/financial/overview', {
        params: { period }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPayrollReport(filters = {}) {
    try {
      const response = await this.api.get('/reports/payroll', {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getExpenseReport(filters = {}) {
    try {
      const response = await this.api.get('/reports/expenses', {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Inventory Reports
  async getInventoryReport(filters = {}) {
    try {
      const response = await this.api.get('/reports/inventory', {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getLowStockReport(threshold = 10) {
    try {
      const response = await this.api.get('/reports/inventory/low-stock', {
        params: { threshold }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAssetReport(filters = {}) {
    try {
      const response = await this.api.get('/reports/assets', {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Dashboard Reports
  async getDashboardMetrics() {
    try {
      const response = await this.api.get('/reports/dashboard');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getKPIReport(period = 'monthly') {
    try {
      const response = await this.api.get('/reports/kpi', {
        params: { period }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Performance Reports
  async getPerformanceReport(filters = {}) {
    try {
      const response = await this.api.get('/reports/performance', {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAttendanceReport(filters = {}) {
    try {
      const response = await this.api.get('/reports/attendance', {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Custom Reports
  async generateCustomReport(reportConfig) {
    try {
      const response = await this.api.post('/reports/custom', reportConfig);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCustomReportTemplates() {
    try {
      const response = await this.api.get('/reports/custom/templates');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async saveCustomReportTemplate(template) {
    try {
      const response = await this.api.post('/reports/custom/templates', template);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Export Functions
  async exportReport(reportType, format = 'csv', filters = {}) {
    try {
      const response = await this.api.get(`/reports/export/${reportType}`, {
        params: { format, ...filters },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Set filename based on report type and format
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${reportType}_report_${timestamp}.${format}`);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'Report exported successfully' };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async exportDashboardData(format = 'pdf') {
    try {
      const response = await this.api.get('/reports/export/dashboard', {
        params: { format },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `dashboard_report_${timestamp}.${format}`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'Dashboard exported successfully' };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Analytics Functions
  async getTimeSeries(metric, period = 'daily', range = '30days') {
    try {
      const response = await this.api.get('/reports/analytics/timeseries', {
        params: { metric, period, range }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getComparative(metrics, period = 'monthly') {
    try {
      const response = await this.api.post('/reports/analytics/comparative', {
        metrics,
        period
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getTrends(metric, period = '12months') {
    try {
      const response = await this.api.get('/reports/analytics/trends', {
        params: { metric, period }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Scheduled Reports
  async getScheduledReports() {
    try {
      const response = await this.api.get('/reports/scheduled');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createScheduledReport(reportConfig) {
    try {
      const response = await this.api.post('/reports/scheduled', reportConfig);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateScheduledReport(id, reportConfig) {
    try {
      const response = await this.api.put(`/reports/scheduled/${id}`, reportConfig);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteScheduledReport(id) {
    try {
      const response = await this.api.delete(`/reports/scheduled/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Utility Functions
  formatReportData(data, type) {
    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(data);
      
      case 'percentage':
        return `${(data * 100).toFixed(2)}%`;
      
      case 'date':
        return new Date(data).toLocaleDateString();
      
      case 'number':
        return new Intl.NumberFormat('en-US').format(data);
      
      default:
        return data;
    }
  }

  calculateGrowthRate(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  aggregateData(data, groupBy, aggregateField, operation = 'sum') {
    const grouped = data.reduce((acc, item) => {
      const key = item[groupBy];
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item[aggregateField]);
      return acc;
    }, {});

    const result = {};
    for (const [key, values] of Object.entries(grouped)) {
      switch (operation) {
        case 'sum':
          result[key] = values.reduce((sum, val) => sum + val, 0);
          break;
        case 'average':
          result[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
          break;
        case 'count':
          result[key] = values.length;
          break;
        case 'max':
          result[key] = Math.max(...values);
          break;
        case 'min':
          result[key] = Math.min(...values);
          break;
        default:
          result[key] = values;
      }
    }

    return result;
  }

  handleError(error) {
    if (error.response) {
      // Server responded with error status
      return {
        message: error.response.data.message || 'Server error occurred',
        status: error.response.status,
        data: error.response.data
      };
    } else if (error.request) {
      // Request made but no response
      return {
        message: 'Network error - please check your connection',
        status: 0
      };
    } else {
      // Other error
      return {
        message: error.message || 'An unexpected error occurred',
        status: -1
      };
    }
  }
}

export default new ReportService();