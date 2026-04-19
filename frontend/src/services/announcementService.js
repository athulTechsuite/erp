import api from './api';

class AnnouncementService {
  /**
   * Get all announcements
   * @returns {Promise} API response with announcements list
   */
  async getAnnouncements() {
    try {
      const response = await api.get('/announcements');
      return response.data;
    } catch (error) {
      console.error('Error fetching announcements:', error);
      throw error;
    }
  }

  /**
   * Get recent announcements for dashboard widget
   * @param {number} limit - Number of announcements to fetch
   * @returns {Promise} API response with recent announcements
   */
  async getRecentAnnouncements(limit = 5) {
    try {
      const response = await api.get(`/announcements/recent?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching recent announcements:', error);
      throw error;
    }
  }

  /**
   * Get a specific announcement by ID
   * @param {number} id - Announcement ID
   * @returns {Promise} API response with announcement details
   */
  async getAnnouncementById(id) {
    try {
      const response = await api.get(`/announcements/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching announcement:', error);
      throw error;
    }
  }

  /**
   * Create a new announcement (admin only)
   * @param {Object} announcementData - Announcement data
   * @param {string} announcementData.title - Announcement title
   * @param {string} announcementData.content - Announcement content
   * @param {string} announcementData.priority - Priority level (low, medium, high)
   * @returns {Promise} API response with created announcement
   */
  async createAnnouncement(announcementData) {
    try {
      const response = await api.post('/announcements', announcementData);
      return response.data;
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw error;
    }
  }

  /**
   * Update an existing announcement (admin only)
   * @param {number} id - Announcement ID
   * @param {Object} announcementData - Updated announcement data
   * @returns {Promise} API response with updated announcement
   */
  async updateAnnouncement(id, announcementData) {
    try {
      const response = await api.put(`/announcements/${id}`, announcementData);
      return response.data;
    } catch (error) {
      console.error('Error updating announcement:', error);
      throw error;
    }
  }

  /**
   * Delete an announcement (admin only)
   * @param {number} id - Announcement ID
   * @returns {Promise} API response confirming deletion
   */
  async deleteAnnouncement(id) {
    try {
      const response = await api.delete(`/announcements/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting announcement:', error);
      throw error;
    }
  }

  /**
   * Mark announcement as read for current user
   * @param {number} id - Announcement ID
   * @returns {Promise} API response confirming read status
   */
  async markAsRead(id) {
    try {
      const response = await api.post(`/announcements/${id}/mark-read`);
      return response.data;
    } catch (error) {
      console.error('Error marking announcement as read:', error);
      throw error;
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
      console.error('Error fetching unread count:', error);
      throw error;
    }
  }

  /**
   * Get announcement statistics (admin only)
   * @returns {Promise} API response with announcement stats
   */
  async getAnnouncementStats() {
    try {
      const response = await api.get('/announcements/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching announcement stats:', error);
      throw error;
    }
  }

  /**
   * Search announcements
   * @param {string} query - Search query
   * @param {Object} filters - Optional filters
   * @returns {Promise} API response with search results
   */
  async searchAnnouncements(query, filters = {}) {
    try {
      const params = new URLSearchParams({
        q: query,
        ...filters
      });
      const response = await api.get(`/announcements/search?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error searching announcements:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const announcementService = new AnnouncementService();
export default announcementService;

// Export class for testing purposes
export { AnnouncementService };