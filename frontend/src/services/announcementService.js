import api from './api';

class AnnouncementService {
  /**
   * Get all announcements
   * @returns {Promise} Promise resolving to announcements array
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
   * Get a single announcement by ID
   * @param {string} id - Announcement ID
   * @returns {Promise} Promise resolving to announcement object
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
   * @param {string} announcementData.message - Announcement message
   * @returns {Promise} Promise resolving to created announcement
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
   * @param {string} id - Announcement ID
   * @param {Object} announcementData - Updated announcement data
   * @param {string} announcementData.title - Announcement title
   * @param {string} announcementData.message - Announcement message
   * @returns {Promise} Promise resolving to updated announcement
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
   * @param {string} id - Announcement ID
   * @returns {Promise} Promise resolving to deletion confirmation
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
   * Get announcements for dashboard display (sorted by creation date, newest first)
   * @returns {Promise} Promise resolving to announcements array
   */
  async getDashboardAnnouncements() {
    try {
      const announcements = await this.getAnnouncements();
      // Sort by creation date, newest first
      return announcements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      console.error('Error fetching dashboard announcements:', error);
      // Return empty array to allow dashboard to display gracefully
      return [];
    }
  }
}

const announcementService = new AnnouncementService();
export default announcementService;