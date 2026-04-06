import api from './api';

// API endpoints configuration - can be overridden by environment variables
const API_ENDPOINTS = {
  ANNOUNCEMENTS: process.env.REACT_APP_ANNOUNCEMENTS_ENDPOINT || '/announcements',
  ADMIN_ANNOUNCEMENTS: process.env.REACT_APP_ADMIN_ANNOUNCEMENTS_ENDPOINT || '/admin/announcements',
  ADMIN_ANNOUNCEMENTS_STATS: process.env.REACT_APP_ADMIN_ANNOUNCEMENTS_STATS_ENDPOINT || '/admin/announcements/stats',
  ADMIN_ANNOUNCEMENTS_SEARCH: process.env.REACT_APP_ADMIN_ANNOUNCEMENTS_SEARCH_ENDPOINT || '/admin/announcements/search',
  ADMIN_ANNOUNCEMENTS_BULK_DELETE: process.env.REACT_APP_ADMIN_ANNOUNCEMENTS_BULK_DELETE_ENDPOINT || '/admin/announcements/bulk-delete',
  ADMIN_ANNOUNCEMENTS_CHECK_PERMISSION: process.env.REACT_APP_ADMIN_ANNOUNCEMENTS_CHECK_PERMISSION_ENDPOINT || '/admin/announcements/check-permission'
};

// Error types for better error handling
const ERROR_TYPES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  FORBIDDEN_ERROR: 'FORBIDDEN_ERROR'
};

class AnnouncementService {
  /**
   * Handle API errors and provide meaningful error messages
   */
  handleError(error, context = 'API request') {
    let errorType = ERROR_TYPES.SERVER_ERROR;
    let userMessage = 'An unexpected error occurred. Please try again.';
    
    if (!error.response) {
      // Network error
      errorType = ERROR_TYPES.NETWORK_ERROR;
      userMessage = 'Network error. Please check your internet connection and try again.';
    } else {
      const status = error.response.status;
      
      switch (status) {
        case 400:
          errorType = ERROR_TYPES.VALIDATION_ERROR;
          userMessage = error.response.data?.message || 'Invalid request data.';
          break;
        case 401:
          errorType = ERROR_TYPES.AUTH_ERROR;
          userMessage = 'You are not authorized. Please log in and try again.';
          break;
        case 403:
          errorType = ERROR_TYPES.FORBIDDEN_ERROR;
          userMessage = 'You do not have permission to perform this action.';
          break;
        case 404:
          errorType = ERROR_TYPES.NOT_FOUND_ERROR;
          userMessage = 'The requested resource was not found.';
          break;
        case 422:
          errorType = ERROR_TYPES.VALIDATION_ERROR;
          userMessage = error.response.data?.message || 'Validation failed.';
          break;
        case 500:
          errorType = ERROR_TYPES.SERVER_ERROR;
          userMessage = 'Server error. Please try again later.';
          break;
        default:
          userMessage = error.response.data?.message || `Request failed with status ${status}`;
      }
    }

    console.error(`${context} failed:`, {
      errorType,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });

    const enhancedError = new Error(userMessage);
    enhancedError.type = errorType;
    enhancedError.originalError = error;
    enhancedError.status = error.response?.status;
    
    return enhancedError;
  }

  /**
   * Validate API response structure
   */
  validateResponse(response, expectedFields = []) {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format received from server');
    }

    if (expectedFields.length > 0) {
      const missingFields = expectedFields.filter(field => !(field in response));
      if (missingFields.length > 0) {
        throw new Error(`Response missing required fields: ${missingFields.join(', ')}`);
      }
    }

    return true;
  }

  /**
   * Get all announcements (for employees to view on dashboard)
   */
  async getAllAnnouncements() {
    try {
      const response = await api.get(API_ENDPOINTS.ANNOUNCEMENTS);
      
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }

      const data = response.data;
      
      // Validate response structure
      if (Array.isArray(data)) {
        // Validate each announcement has required fields
        data.forEach((announcement, index) => {
          if (!announcement.id || !announcement.title) {
            console.warn(`Announcement at index ${index} is missing required fields`);
          }
        });
      } else if (data.data && Array.isArray(data.data)) {
        // Handle paginated response
        data.data.forEach((announcement, index) => {
          if (!announcement.id || !announcement.title) {
            console.warn(`Announcement at index ${index} is missing required fields`);
          }
        });
      }
      
      return data;
    } catch (error) {
      throw this.handleError(error, 'Fetching announcements');
    }
  }

  /**
   * Get announcements for admin management (includes inactive ones)
   */
  async getAnnouncementsForAdmin() {
    try {
      const response = await api.get(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS);
      
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }

      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Fetching admin announcements');
    }
  }

  /**
   * Get a specific announcement by ID
   */
  async getAnnouncementById(id) {
    if (!id) {
      throw new Error('Announcement ID is required');
    }

    try {
      const response = await api.get(`${API_ENDPOINTS.ANNOUNCEMENTS}/${id}`);
      
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }

      const announcement = response.data;
      this.validateResponse(announcement, ['id', 'title', 'content']);
      
      return announcement;
    } catch (error) {
      throw this.handleError(error, 'Fetching announcement');
    }
  }

  /**
   * Create a new announcement (admin only)
   */
  async createAnnouncement(announcementData) {
    if (!announcementData) {
      throw new Error('Announcement data is required');
    }

    // Validate data before sending
    const validation = this.validateAnnouncementData(announcementData);
    if (!validation.isValid) {
      const validationError = new Error('Validation failed');
      validationError.type = ERROR_TYPES.VALIDATION_ERROR;
      validationError.validationErrors = validation.errors;
      throw validationError;
    }

    try {
      const response = await api.post(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS, announcementData);
      
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }

      const createdAnnouncement = response.data;
      this.validateResponse(createdAnnouncement, ['id', 'title']);
      
      return createdAnnouncement;
    } catch (error) {
      throw this.handleError(error, 'Creating announcement');
    }
  }

  /**
   * Update an existing announcement (admin only)
   */
  async updateAnnouncement(id, announcementData) {
    if (!id) {
      throw new Error('Announcement ID is required');
    }
    
    if (!announcementData) {
      throw new Error('Announcement data is required');
    }

    // Validate data before sending
    const validation = this.validateAnnouncementData(announcementData);
    if (!validation.isValid) {
      const validationError = new Error('Validation failed');
      validationError.type = ERROR_TYPES.VALIDATION_ERROR;
      validationError.validationErrors = validation.errors;
      throw validationError;
    }

    try {
      const response = await api.put(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS}/${id}`, announcementData);
      
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }

      const updatedAnnouncement = response.data;
      this.validateResponse(updatedAnnouncement, ['id', 'title']);
      
      return updatedAnnouncement;
    } catch (error) {
      throw this.handleError(error, 'Updating announcement');
    }
  }

  /**
   * Delete an announcement (admin only)
   */
  async deleteAnnouncement(id) {
    if (!id) {
      throw new Error('Announcement ID is required');
    }

    try {
      const response = await api.delete(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS}/${id}`);
      
      if (!response) {
        throw new Error('Invalid response format');
      }

      return response.data || { success: true };
    } catch (error) {
      throw this.handleError(error, 'Deleting announcement');
    }
  }

  /**
   * Toggle announcement active status (admin only)
   */
  async toggleAnnouncementStatus(id) {
    if (!id) {
      throw new Error('Announcement ID is required');
    }

    try {
      const response = await api.patch(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS}/${id}/toggle-status`);
      
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }

      const updatedAnnouncement = response.data;
      this.validateResponse(updatedAnnouncement, ['id', 'is_active']);
      
      return updatedAnnouncement;
    } catch (error) {
      throw this.handleError(error, 'Toggling announcement status');
    }
  }

  /**
   * Get announcement statistics (admin only)
   */
  async getAnnouncementStats() {
    try {
      const response = await api.get(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_STATS);
      
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }

      const stats = response.data;
      // Validate stats have expected numeric fields
      const expectedFields = ['total', 'active', 'inactive'];
      expectedFields.forEach(field => {
        if (stats[field] !== undefined && typeof stats[field] !== 'number') {
          console.warn(`Stats field '${field}' should be a number`);
        }
      });
      
      return stats;
    } catch (error) {
      throw this.handleError(error, 'Fetching announcement stats');
    }
  }

  /**
   * Search announcements (admin only)
   */
  async searchAnnouncements(query, filters = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query is required and must be a string');
    }

    if (query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        ...filters
      });
      
      const response = await api.get(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_SEARCH}?${params}`);
      
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }

      const searchResults = response.data;
      
      // Validate search results structure
      if (searchResults.results && Array.isArray(searchResults.results)) {
        searchResults.results.forEach((announcement, index) => {
          if (!announcement.id || !announcement.title) {
            console.warn(`Search result at index ${index} is missing required fields`);
          }
        });
      } else if (Array.isArray(searchResults)) {
        searchResults.forEach((announcement, index) => {
          if (!announcement.id || !announcement.title) {
            console.warn(`Search result at index ${index} is missing required fields`);
          }
        });
      }
      
      return searchResults;
    } catch (error) {
      throw this.handleError(error, 'Searching announcements');
    }
  }

  /**
   * Bulk delete announcements (admin only)
   */
  async bulkDeleteAnnouncements(announcementIds) {
    if (!Array.isArray(announcementIds) || announcementIds.length === 0) {
      throw new Error('Announcement IDs array is required and cannot be empty');
    }

    // Validate all IDs are present
    const invalidIds = announcementIds.filter(id => !id || (typeof id !== 'string' && typeof id !== 'number'));
    if (invalidIds.length > 0) {
      throw new Error('All announcement IDs must be valid');
    }

    try {
      const response = await api.post(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_BULK_DELETE, {
        ids: announcementIds
      });
      
      if (!response || !response.data) {
        throw new Error('Invalid response format');
      }

      const result = response.data;
      
      // Validate bulk delete response
      if (result.deleted_count !== undefined && typeof result.deleted_count !== 'number') {
        console.warn('Bulk delete response should include numeric deleted_count');
      }
      
      return result;
    } catch (error) {
      throw this.handleError(error, 'Bulk deleting announcements');
    }
  }

  /**
   * Format announcement data for display
   */
  formatAnnouncement(announcement) {
    if (!announcement || typeof announcement !== 'object') {
      throw new Error('Valid announcement object is required');
    }

    try {
      return {
        ...announcement,
        formattedDate: announcement.created_at 
          ? new Date(announcement.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Date unavailable',
        shortContent: announcement.content && announcement.content.length > 150 
          ? announcement.content.substring(0, 150) + '...' 
          : announcement.content || ''
      };
    } catch (error) {
      console.error('Error formatting announcement:', error);
      return {
        ...announcement,
        formattedDate: 'Invalid date',
        shortContent: announcement.content || ''
      };
    }
  }

  /**
   * Validate announcement data before submission
   */
  validateAnnouncementData(data) {
    const errors = {};

    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: { general: 'Invalid announcement data' }
      };
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters long';
    }

    if (data.title && data.title.length > 200) {
      errors.title = 'Title must not exceed 200 characters';
    }

    if (!data.content || typeof data.content !== 'string' || data.content.trim().length < 10) {
      errors.content = 'Content must be at least 10 characters long';
    }

    if (data.content && data.content.length > 5000) {
      errors.content = 'Content must not exceed 5000 characters';
    }

    // Validate priority if provided
    if (data.priority !== undefined && !['low', 'medium', 'high'].includes(data.priority)) {
      errors.priority = 'Priority must be one of: low, medium, high';
    }

    // Validate is_active if provided
    if (data.is_active !== undefined && typeof data.is_active !== 'boolean') {
      errors.is_active = 'Active status must be a boolean value';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Check if user has permission to manage announcements
   */
  async checkManagementPermission() {
    try {
      const response = await api.get(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_CHECK_PERMISSION);
      
      if (!response || !response.data) {
        console.warn('Invalid response format for permission check');
        return false;
      }

      const hasPermission = response.data.hasPermission;
      
      if (typeof hasPermission !== 'boolean') {
        console.warn('Permission check should return boolean value');
        return false;
      }
      
      return hasPermission;
    } catch (error) {
      console.error('Error checking announcement permission:', error);
      return false;
    }
  }
}

// Create and export a singleton instance
const announcementService = new AnnouncementService();
export default announcementService;

// Named exports for specific methods if needed
export const {
  getAllAnnouncements,
  getAnnouncementsForAdmin,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus,
  getAnnouncementStats,
  searchAnnouncements,
  bulkDeleteAnnouncements,
  formatAnnouncement,
  validateAnnouncementData,
  checkManagementPermission
} = announcementService;

// Export error types for use in components
export { ERROR_TYPES };