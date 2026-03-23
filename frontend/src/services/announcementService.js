import apiClient from './apiClient';

class AnnouncementService {
  /**
   * Get all announcements with optional filters
   * @param {Object} params - Query parameters
   * @param {string} params.priority - Filter by priority (normal, important, urgent)
   * @param {boolean} params.published - Filter by publication status
   * @param {string} params.sortBy - Sort field (createdAt, publishedAt, priority)
   * @param {string} params.sortOrder - Sort order (asc, desc)
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Number of items per page
   * @returns {Promise} API response with announcements
   */
  async getAnnouncements(params = {}) {
    try {
      const response = await apiClient.get('/announcements', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching announcements:', error);
      throw error;
    }
  }

  /**
   * Get a specific announcement by ID
   * @param {string} id - Announcement ID
   * @returns {Promise} API response with announcement details
   */
  async getAnnouncementById(id) {
    try {
      const response = await apiClient.get(`/announcements/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching announcement:', error);
      throw error;
    }
  }

  /**
   * Create a new announcement
   * @param {Object} announcementData - Announcement data
   * @param {string} announcementData.title - Announcement title
   * @param {string} announcementData.content - Announcement content (HTML)
   * @param {string} announcementData.priority - Priority level (normal, important, urgent)
   * @param {Date} announcementData.publishedAt - Publication date/time
   * @param {Array} announcementData.attachments - File attachments
   * @returns {Promise} API response with created announcement
   */
  async createAnnouncement(announcementData) {
    try {
      const response = await apiClient.post('/announcements', announcementData);
      return response.data;
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw error;
    }
  }

  /**
   * Update an existing announcement
   * @param {string} id - Announcement ID
   * @param {Object} announcementData - Updated announcement data
   * @returns {Promise} API response with updated announcement
   */
  async updateAnnouncement(id, announcementData) {
    try {
      const response = await apiClient.put(`/announcements/${id}`, announcementData);
      return response.data;
    } catch (error) {
      console.error('Error updating announcement:', error);
      throw error;
    }
  }

  /**
   * Delete an announcement
   * @param {string} id - Announcement ID
   * @returns {Promise} API response
   */
  async deleteAnnouncement(id) {
    try {
      const response = await apiClient.delete(`/announcements/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting announcement:', error);
      throw error;
    }
  }

  /**
   * Mark an announcement as read
   * @param {string} id - Announcement ID
   * @returns {Promise} API response
   */
  async markAsRead(id) {
    try {
      const response = await apiClient.post(`/announcements/${id}/read`);
      return response.data;
    } catch (error) {
      console.error('Error marking announcement as read:', error);
      throw error;
    }
  }

  /**
   * Mark an announcement as unread
   * @param {string} id - Announcement ID
   * @returns {Promise} API response
   */
  async markAsUnread(id) {
    try {
      const response = await apiClient.delete(`/announcements/${id}/read`);
      return response.data;
    } catch (error) {
      console.error('Error marking announcement as unread:', error);
      throw error;
    }
  }

  /**
   * Get read statistics for an announcement (admin only)
   * @param {string} id - Announcement ID
   * @returns {Promise} API response with read statistics
   */
  async getReadStatistics(id) {
    try {
      const response = await apiClient.get(`/announcements/${id}/statistics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching read statistics:', error);
      throw error;
    }
  }

  /**
   * Upload attachment for announcement
   * @param {File} file - File to upload
   * @returns {Promise} API response with file URL
   */
  async uploadAttachment(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiClient.post('/announcements/attachments', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw error;
    }
  }

  /**
   * Delete attachment
   * @param {string} attachmentId - Attachment ID
   * @returns {Promise} API response
   */
  async deleteAttachment(attachmentId) {
    try {
      const response = await apiClient.delete(`/announcements/attachments/${attachmentId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      throw error;
    }
  }

  /**
   * Get unread announcements count for current user
   * @returns {Promise} API response with unread count
   */
  async getUnreadCount() {
    try {
      const response = await apiClient.get('/announcements/unread-count');
      return response.data;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  }

  /**
   * Get archived announcements (admin only)
   * @param {Object} params - Query parameters
   * @returns {Promise} API response with archived announcements
   */
  async getArchivedAnnouncements(params = {}) {
    try {
      const response = await apiClient.get('/announcements/archived', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching archived announcements:', error);
      throw error;
    }
  }

  /**
   * Archive an announcement manually (admin only)
   * @param {string} id - Announcement ID
   * @returns {Promise} API response
   */
  async archiveAnnouncement(id) {
    try {
      const response = await apiClient.post(`/announcements/${id}/archive`);
      return response.data;
    } catch (error) {
      console.error('Error archiving announcement:', error);
      throw error;
    }
  }

  /**
   * Restore an archived announcement (admin only)
   * @param {string} id - Announcement ID
   * @returns {Promise} API response
   */
  async restoreAnnouncement(id) {
    try {
      const response = await apiClient.post(`/announcements/${id}/restore`);
      return response.data;
    } catch (error) {
      console.error('Error restoring announcement:', error);
      throw error;
    }
  }

  /**
   * Schedule an announcement for future publication
   * @param {string} id - Announcement ID
   * @param {Date} publishedAt - Publication date/time
   * @returns {Promise} API response
   */
  async scheduleAnnouncement(id, publishedAt) {
    try {
      const response = await apiClient.post(`/announcements/${id}/schedule`, {
        publishedAt
      });
      return response.data;
    } catch (error) {
      console.error('Error scheduling announcement:', error);
      throw error;
    }
  }

  /**
   * Cancel scheduled publication
   * @param {string} id - Announcement ID
   * @returns {Promise} API response
   */
  async cancelScheduledPublication(id) {
    try {
      const response = await apiClient.delete(`/announcements/${id}/schedule`);
      return response.data;
    } catch (error) {
      console.error('Error canceling scheduled publication:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const announcementService = new AnnouncementService();
export default announcementService;

// Export the class for testing purposes
export { AnnouncementService };