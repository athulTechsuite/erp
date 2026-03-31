import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class AnnouncementService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });

    // Add request interceptor to include auth token
    this.apiClient.interceptors.request.use(
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
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get all announcements
   * @returns {Promise<Array>} List of announcements
   */
  async getAllAnnouncements() {
    try {
      const response = await this.apiClient.get('/announcements');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch announcements');
    }
  }

  /**
   * Get a single announcement by ID
   * @param {string} id - Announcement ID
   * @returns {Promise<Object>} Announcement details
   */
  async getAnnouncementById(id) {
    try {
      const response = await this.apiClient.get(`/announcements/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch announcement');
    }
  }

  /**
   * Create a new announcement (Admin only)
   * @param {Object} announcementData - Announcement data
   * @param {string} announcementData.title - Announcement title
   * @param {string} announcementData.content - Announcement content
   * @param {File} [announcementData.image] - Optional image file
   * @returns {Promise<Object>} Created announcement
   */
  async createAnnouncement(announcementData) {
    try {
      const formData = new FormData();
      formData.append('title', announcementData.title);
      formData.append('content', announcementData.content);
      
      if (announcementData.image) {
        formData.append('image', announcementData.image);
      }

      const response = await this.apiClient.post('/announcements', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to create announcement');
    }
  }

  /**
   * Update an existing announcement (Admin only)
   * @param {string} id - Announcement ID
   * @param {Object} announcementData - Updated announcement data
   * @returns {Promise<Object>} Updated announcement
   */
  async updateAnnouncement(id, announcementData) {
    try {
      const formData = new FormData();
      formData.append('title', announcementData.title);
      formData.append('content', announcementData.content);
      
      if (announcementData.image) {
        formData.append('image', announcementData.image);
      }

      const response = await this.apiClient.put(`/announcements/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update announcement');
    }
  }

  /**
   * Delete an announcement (Admin only)
   * @param {string} id - Announcement ID
   * @returns {Promise<void>}
   */
  async deleteAnnouncement(id) {
    try {
      await this.apiClient.delete(`/announcements/${id}`);
    } catch (error) {
      throw this.handleError(error, 'Failed to delete announcement');
    }
  }

  /**
   * Get announcements for dashboard display
   * @returns {Promise<Array>} Active announcements
   */
  async getDashboardAnnouncements() {
    try {
      const response = await this.apiClient.get('/announcements/dashboard');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch dashboard announcements');
    }
  }

  /**
   * Handle API errors and provide user-friendly messages
   * @param {Error} error - The error object
   * @param {string} defaultMessage - Default error message
   * @returns {Error} Formatted error
   */
  handleError(error, defaultMessage) {
    let message = defaultMessage;
    let statusCode = null;

    if (error.response) {
      // Server responded with error status
      statusCode = error.response.status;
      message = error.response.data?.message || error.response.data?.error || defaultMessage;
      
      // Handle specific error cases
      switch (statusCode) {
        case 400:
          message = error.response.data?.message || 'Invalid request data';
          break;
        case 401:
          message = 'Unauthorized access. Please log in again.';
          break;
        case 403:
          message = 'Access denied. Admin privileges required.';
          break;
        case 404:
          message = 'Announcement not found';
          break;
        case 413:
          message = 'File size too large. Please choose a smaller image.';
          break;
        case 500:
          message = 'Server error. Please try again later.';
          break;
      }
    } else if (error.request) {
      // Network error
      message = 'Network error. Please check your connection and try again.';
    }

    const customError = new Error(message);
    customError.statusCode = statusCode;
    customError.originalError = error;
    
    return customError;
  }

  /**
   * Validate announcement data before submission
   * @param {Object} announcementData - Announcement data to validate
   * @returns {Object} Validation result
   */
  validateAnnouncementData(announcementData) {
    const errors = {};

    // Validate title
    if (!announcementData.title || announcementData.title.trim().length === 0) {
      errors.title = 'Title is required';
    } else if (announcementData.title.trim().length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    // Validate content
    if (!announcementData.content || announcementData.content.trim().length === 0) {
      errors.content = 'Content is required';
    } else if (announcementData.content.trim().length > 5000) {
      errors.content = 'Content must be less than 5000 characters';
    }

    // Validate image if provided
    if (announcementData.image) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(announcementData.image.type)) {
        errors.image = 'Only JPEG, PNG, GIF, and WebP images are allowed';
      } else if (announcementData.image.size > maxSize) {
        errors.image = 'Image size must be less than 5MB';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
}

// Create and export a singleton instance
const announcementService = new AnnouncementService();
export default announcementService;

// Export the class for testing purposes
export { AnnouncementService };