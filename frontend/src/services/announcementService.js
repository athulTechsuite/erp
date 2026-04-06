import api from './api';

class AnnouncementService {
  /**
   * Handle API errors with detailed error information
   */
  _handleApiError(error, operation = 'API operation') {
    let errorMessage = `Failed to ${operation}`;
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.code === 'ECONNABORTED') {
      // Request timeout
      errorMessage = `Request timeout: ${operation} took too long to complete`;
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.code === 'ERR_NETWORK' || !error.response) {
      // Network error (offline, DNS issues, etc.)
      errorMessage = `Network error: Unable to connect to server during ${operation}`;
      errorCode = 'NETWORK_ERROR';
    } else if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 400:
          errorMessage = data?.message || `Bad request: Invalid data for ${operation}`;
          errorCode = 'BAD_REQUEST';
          break;
        case 401:
          errorMessage = 'Authentication required: Please log in again';
          errorCode = 'UNAUTHORIZED';
          break;
        case 403:
          errorMessage = 'Access denied: Insufficient permissions';
          errorCode = 'FORBIDDEN';
          break;
        case 404:
          errorMessage = data?.message || 'Resource not found';
          errorCode = 'NOT_FOUND';
          break;
        case 422:
          errorMessage = data?.message || `Validation error during ${operation}`;
          errorCode = 'VALIDATION_ERROR';
          break;
        case 429:
          errorMessage = 'Too many requests: Please try again later';
          errorCode = 'RATE_LIMIT';
          break;
        case 500:
          errorMessage = 'Server error: Please try again later';
          errorCode = 'SERVER_ERROR';
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = 'Service temporarily unavailable: Please try again later';
          errorCode = 'SERVICE_UNAVAILABLE';
          break;
        default:
          errorMessage = data?.message || `Server error (${status}) during ${operation}`;
          errorCode = 'HTTP_ERROR';
      }
    }

    const enhancedError = new Error(errorMessage);
    enhancedError.code = errorCode;
    enhancedError.originalError = error;
    enhancedError.status = error.response?.status;
    enhancedError.data = error.response?.data;
    
    console.error(`AnnouncementService Error - ${operation}:`, {
      message: errorMessage,
      code: errorCode,
      status: error.response?.status,
      originalError: error
    });
    
    return enhancedError;
  }

  /**
   * Get all announcements (for employees to view on dashboard)
   */
  async getAllAnnouncements() {
    try {
      const response = await api.get('/announcements');
      return response.data;
    } catch (error) {
      throw this._handleApiError(error, 'fetch announcements');
    }
  }

  /**
   * Get announcements for admin management (includes inactive ones)
   */
  async getAnnouncementsForAdmin() {
    try {
      const response = await api.get('/admin/announcements');
      return response.data;
    } catch (error) {
      throw this._handleApiError(error, 'fetch admin announcements');
    }
  }

  /**
   * Get a specific announcement by ID
   */
  async getAnnouncementById(id) {
    try {
      const response = await api.get(`/announcements/${id}`);
      return response.data;
    } catch (error) {
      throw this._handleApiError(error, `fetch announcement with ID ${id}`);
    }
  }

  /**
   * Create a new announcement (admin only)
   */
  async createAnnouncement(announcementData) {
    try {
      const response = await api.post('/admin/announcements', announcementData);
      return response.data;
    } catch (error) {
      throw this._handleApiError(error, 'create announcement');
    }
  }

  /**
   * Update an existing announcement (admin only)
   */
  async updateAnnouncement(id, announcementData) {
    try {
      const response = await api.put(`/admin/announcements/${id}`, announcementData);
      return response.data;
    } catch (error) {
      throw this._handleApiError(error, `update announcement with ID ${id}`);
    }
  }

  /**
   * Delete an announcement (admin only)
   */
  async deleteAnnouncement(id) {
    try {
      const response = await api.delete(`/admin/announcements/${id}`);
      return response.data;
    } catch (error) {
      throw this._handleApiError(error, `delete announcement with ID ${id}`);
    }
  }

  /**
   * Toggle announcement active status (admin only)
   */
  async toggleAnnouncementStatus(id) {
    try {
      const response = await api.patch(`/admin/announcements/${id}/toggle-status`);
      return response.data;
    } catch (error) {
      throw this._handleApiError(error, `toggle status for announcement with ID ${id}`);
    }
  }

  /**
   * Get announcement statistics (admin only)
   */
  async getAnnouncementStats() {
    try {
      const response = await api.get('/admin/announcements/stats');
      return response.data;
    } catch (error) {
      throw this._handleApiError(error, 'fetch announcement statistics');
    }
  }

  /**
   * Search announcements (admin only)
   */
  async searchAnnouncements(query, filters = {}) {
    try {
      const params = new URLSearchParams({
        q: query,
        ...filters
      });
      const response = await api.get(`/admin/announcements/search?${params}`);
      return response.data;
    } catch (error) {
      throw this._handleApiError(error, `search announcements with query "${query}"`);
    }
  }

  /**
   * Bulk delete announcements (admin only)
   */
  async bulkDeleteAnnouncements(announcementIds) {
    try {
      const response = await api.post('/admin/announcements/bulk-delete', {
        ids: announcementIds
      });
      return response.data;
    } catch (error) {
      throw this._handleApiError(error, `bulk delete ${announcementIds.length} announcements`);
    }
  }

  /**
   * Format announcement data for display
   */
  formatAnnouncement(announcement) {
    return {
      ...announcement,
      formattedDate: new Date(announcement.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      shortContent: announcement.content.length > 150 
        ? announcement.content.substring(0, 150) + '...' 
        : announcement.content
    };
  }

  /**
   * Validate announcement data before submission
   */
  validateAnnouncementData(data) {
    const errors = {};

    if (!data.title || data.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters long';
    }

    if (data.title && data.title.length > 200) {
      errors.title = 'Title must not exceed 200 characters';
    }

    if (!data.content || data.content.trim().length < 10) {
      errors.content = 'Content must be at least 10 characters long';
    }

    if (data.content && data.content.length > 5000) {
      errors.content = 'Content must not exceed 5000 characters';
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
      const response = await api.get('/admin/announcements/check-permission');
      return response.data.hasPermission;
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