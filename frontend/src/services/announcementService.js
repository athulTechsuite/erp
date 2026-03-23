import api from './api';

class AnnouncementService {
  /**
   * Get all announcements with optional filtering
   * @param {Object} params - Query parameters
   * @param {boolean} params.activeOnly - Filter to only active announcements
   * @param {string} params.priority - Filter by priority level
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Number of items per page
   * @returns {Promise} API response with announcements list
   */
  async getAnnouncements(params = {}) {
    try {
      const response = await api.get('/announcements', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get a specific announcement by ID
   * @param {string} id - Announcement ID
   * @returns {Promise} API response with announcement details
   */
  async getAnnouncement(id) {
    try {
      const response = await api.get(`/announcements/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a new announcement (Admin only)
   * @param {Object} announcementData - Announcement data
   * @param {string} announcementData.title - Announcement title
   * @param {string} announcementData.content - Rich text content
   * @param {string} announcementData.priority - Priority level (normal, urgent, priority)
   * @param {Date} announcementData.publishDate - Publication date
   * @param {Date} announcementData.expirationDate - Expiration date
   * @param {boolean} announcementData.sendEmailNotification - Send email for urgent announcements
   * @returns {Promise} API response with created announcement
   */
  async createAnnouncement(announcementData) {
    try {
      const response = await api.post('/announcements', announcementData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update an existing announcement (Admin only)
   * @param {string} id - Announcement ID
   * @param {Object} announcementData - Updated announcement data
   * @returns {Promise} API response with updated announcement
   */
  async updateAnnouncement(id, announcementData) {
    try {
      const response = await api.put(`/announcements/${id}`, announcementData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete an announcement (Admin only)
   * @param {string} id - Announcement ID
   * @returns {Promise} API response
   */
  async deleteAnnouncement(id) {
    try {
      const response = await api.delete(`/announcements/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Mark announcement as read for current user
   * @param {string} announcementId - Announcement ID
   * @returns {Promise} API response
   */
  async markAsRead(announcementId) {
    try {
      const response = await api.post(`/announcements/${announcementId}/read`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Mark announcement as unread for current user
   * @param {string} announcementId - Announcement ID
   * @returns {Promise} API response
   */
  async markAsUnread(announcementId) {
    try {
      const response = await api.delete(`/announcements/${announcementId}/read`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get user's read status for announcements
   * @param {Array} announcementIds - Array of announcement IDs
   * @returns {Promise} API response with read statuses
   */
  async getReadStatuses(announcementIds) {
    try {
      const response = await api.post('/announcements/read-status', {
        announcementIds
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get archived announcements (Admin only)
   * @param {Object} params - Query parameters
   * @returns {Promise} API response with archived announcements
   */
  async getArchivedAnnouncements(params = {}) {
    try {
      const response = await api.get('/announcements/archived', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Archive an announcement manually (Admin only)
   * @param {string} id - Announcement ID
   * @returns {Promise} API response
   */
  async archiveAnnouncement(id) {
    try {
      const response = await api.post(`/announcements/${id}/archive`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Restore archived announcement (Admin only)
   * @param {string} id - Announcement ID
   * @returns {Promise} API response
   */
  async restoreAnnouncement(id) {
    try {
      const response = await api.post(`/announcements/${id}/restore`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get announcement statistics (Admin only)
   * @returns {Promise} API response with statistics
   */
  async getAnnouncementStats() {
    try {
      const response = await api.get('/announcements/stats');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Send test email notification (Admin only)
   * @param {string} announcementId - Announcement ID
   * @param {Array} recipients - Array of email addresses for testing
   * @returns {Promise} API response
   */
  async sendTestNotification(announcementId, recipients = []) {
    try {
      const response = await api.post(`/announcements/${announcementId}/test-notification`, {
        recipients
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get unread announcements count for current user
   * @returns {Promise} API response with unread count
   */
  async getUnreadCount() {
    try {
      const response = await api.get('/announcements/unread-count');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle API errors consistently
   * @param {Error} error - API error
   * @returns {Error} Formatted error
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      const message = data.message || data.error || 'An error occurred';
      
      switch (status) {
        case 400:
          return new Error(`Bad Request: ${message}`);
        case 401:
          return new Error('Unauthorized: Please log in again');
        case 403:
          return new Error('Forbidden: You do not have permission to perform this action');
        case 404:
          return new Error('Announcement not found');
        case 409:
          return new Error(`Conflict: ${message}`);
        case 422:
          return new Error(`Validation Error: ${message}`);
        case 500:
          return new Error('Server error: Please try again later');
        default:
          return new Error(message);
      }
    } else if (error.request) {
      // Network error
      return new Error('Network error: Please check your connection');
    } else {
      // Other error
      return new Error(error.message || 'An unexpected error occurred');
    }
  }

  /**
   * Validate announcement data before sending to API
   * @param {Object} data - Announcement data
   * @returns {Object} Validation result
   */
  validateAnnouncementData(data) {
    const errors = {};

    if (!data.title || data.title.trim().length === 0) {
      errors.title = 'Title is required';
    } else if (data.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    if (!data.content || data.content.trim().length === 0) {
      errors.content = 'Content is required';
    } else if (data.content.length > 10000) {
      errors.content = 'Content must be less than 10,000 characters';
    }

    if (data.priority && !['normal', 'priority', 'urgent'].includes(data.priority)) {
      errors.priority = 'Priority must be normal, priority, or urgent';
    }

    if (data.publishDate) {
      const publishDate = new Date(data.publishDate);
      if (isNaN(publishDate.getTime())) {
        errors.publishDate = 'Invalid publish date';
      }
    }

    if (data.expirationDate) {
      const expirationDate = new Date(data.expirationDate);
      if (isNaN(expirationDate.getTime())) {
        errors.expirationDate = 'Invalid expiration date';
      } else if (data.publishDate && expirationDate <= new Date(data.publishDate)) {
        errors.expirationDate = 'Expiration date must be after publish date';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Format announcement data for display
   * @param {Object} announcement - Raw announcement data
   * @returns {Object} Formatted announcement
   */
  formatAnnouncementForDisplay(announcement) {
    return {
      ...announcement,
      formattedPublishDate: this.formatDate(announcement.publishDate),
      formattedExpirationDate: announcement.expirationDate 
        ? this.formatDate(announcement.expirationDate) 
        : null,
      isExpired: announcement.expirationDate 
        ? new Date(announcement.expirationDate) < new Date() 
        : false,
      isScheduled: new Date(announcement.publishDate) > new Date(),
      priorityLabel: this.getPriorityLabel(announcement.priority),
      priorityColor: this.getPriorityColor(announcement.priority)
    };
  }

  /**
   * Format date for display
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    if (!date) return '';
    
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get priority display label
   * @param {string} priority - Priority level
   * @returns {string} Display label
   */
  getPriorityLabel(priority) {
    const labels = {
      normal: 'Normal',
      priority: 'Priority',
      urgent: 'Urgent'
    };
    return labels[priority] || 'Normal';
  }

  /**
   * Get priority color for UI styling
   * @param {string} priority - Priority level
   * @returns {string} Color class or hex code
   */
  getPriorityColor(priority) {
    const colors = {
      normal: '#6b7280',    // gray
      priority: '#f59e0b',  // amber
      urgent: '#ef4444'     // red
    };
    return colors[priority] || colors.normal;
  }
}

// Export singleton instance
export default new AnnouncementService();