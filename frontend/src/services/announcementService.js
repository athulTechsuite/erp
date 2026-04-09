import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class AnnouncementService {
  constructor() {
    this.axios = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });

    // Add request interceptor to include auth token
    this.axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, redirect to login
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get all published announcements for dashboard display
   * @returns {Promise<Array>} Array of published announcements
   */
  async getPublishedAnnouncements() {
    try {
      const response = await this.axios.get('/announcements/published');
      return response.data;
    } catch (error) {
      console.error('Error fetching published announcements:', error);
      throw new Error('Failed to load announcements');
    }
  }

  /**
   * Get all announcements (admin only)
   * @returns {Promise<Array>} Array of all announcements
   */
  async getAllAnnouncements() {
    try {
      const response = await this.axios.get('/announcements');
      return response.data;
    } catch (error) {
      console.error('Error fetching all announcements:', error);
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to view all announcements');
      }
      throw new Error('Failed to load announcements');
    }
  }

  /**
   * Get a specific announcement by ID
   * @param {string} id - Announcement ID
   * @returns {Promise<Object>} Announcement object
   */
  async getAnnouncementById(id) {
    try {
      const response = await this.axios.get(`/announcements/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching announcement:', error);
      if (error.response?.status === 404) {
        throw new Error('Announcement not found');
      }
      throw new Error('Failed to load announcement');
    }
  }

  /**
   * Create a new announcement (admin only)
   * @param {Object} announcementData - Announcement data
   * @param {string} announcementData.title - Announcement title
   * @param {string} announcementData.content - Announcement content
   * @param {boolean} announcementData.published - Publication status
   * @returns {Promise<Object>} Created announcement
   */
  async createAnnouncement(announcementData) {
    try {
      const response = await this.axios.post('/announcements', announcementData);
      return response.data;
    } catch (error) {
      console.error('Error creating announcement:', error);
      if (error.response?.status === 400) {
        throw new Error(error.response.data.message || 'Invalid announcement data');
      }
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to create announcements');
      }
      throw new Error('Failed to create announcement');
    }
  }

  /**
   * Update an existing announcement (admin only)
   * @param {string} id - Announcement ID
   * @param {Object} announcementData - Updated announcement data
   * @returns {Promise<Object>} Updated announcement
   */
  async updateAnnouncement(id, announcementData) {
    try {
      const response = await this.axios.put(`/announcements/${id}`, announcementData);
      return response.data;
    } catch (error) {
      console.error('Error updating announcement:', error);
      if (error.response?.status === 400) {
        throw new Error(error.response.data.message || 'Invalid announcement data');
      }
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to update announcements');
      }
      if (error.response?.status === 404) {
        throw new Error('Announcement not found');
      }
      throw new Error('Failed to update announcement');
    }
  }

  /**
   * Delete an announcement (admin only)
   * @param {string} id - Announcement ID
   * @returns {Promise<void>}
   */
  async deleteAnnouncement(id) {
    try {
      await this.axios.delete(`/announcements/${id}`);
    } catch (error) {
      console.error('Error deleting announcement:', error);
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to delete announcements');
      }
      if (error.response?.status === 404) {
        throw new Error('Announcement not found');
      }
      throw new Error('Failed to delete announcement');
    }
  }

  /**
   * Toggle publication status of an announcement (admin only)
   * @param {string} id - Announcement ID
   * @returns {Promise<Object>} Updated announcement
   */
  async toggleAnnouncementStatus(id) {
    try {
      const response = await this.axios.patch(`/announcements/${id}/toggle-status`);
      return response.data;
    } catch (error) {
      console.error('Error toggling announcement status:', error);
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to modify announcements');
      }
      if (error.response?.status === 404) {
        throw new Error('Announcement not found');
      }
      throw new Error('Failed to update announcement status');
    }
  }

  /**
   * Validate announcement data before submission
   * @param {Object} announcementData - Announcement data to validate
   * @returns {Object} Validation result with isValid boolean and errors array
   */
  validateAnnouncementData(announcementData) {
    const errors = [];
    
    if (!announcementData.title || announcementData.title.trim().length === 0) {
      errors.push('Title is required');
    } else if (announcementData.title.trim().length > 200) {
      errors.push('Title must be less than 200 characters');
    }

    if (!announcementData.content || announcementData.content.trim().length === 0) {
      errors.push('Content is required');
    } else if (announcementData.content.trim().length > 5000) {
      errors.push('Content must be less than 5000 characters');
    }

    if (typeof announcementData.published !== 'boolean') {
      errors.push('Publication status must be specified');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Create and export a singleton instance
const announcementService = new AnnouncementService();
export default announcementService;

// Also export the class for testing purposes
export { AnnouncementService };