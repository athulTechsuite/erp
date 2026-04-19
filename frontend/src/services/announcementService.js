import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class AnnouncementService {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/announcements`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
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
    this.api.interceptors.response.use(
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

  // Get all announcements (with optional filters)
  async getAnnouncements(params = {}) {
    try {
      const response = await this.api.get('/', { params });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch announcements',
      };
    }
  }

  // Get active announcements only
  async getActiveAnnouncements() {
    try {
      const response = await this.api.get('/active');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch active announcements',
      };
    }
  }

  // Get recent announcements for dashboard widget
  async getRecentAnnouncements(limit = 5) {
    try {
      const response = await this.api.get('/recent', { params: { limit } });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch recent announcements',
      };
    }
  }

  // Get single announcement by ID
  async getAnnouncementById(id) {
    try {
      const response = await this.api.get(`/${id}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch announcement',
      };
    }
  }

  // Create new announcement (admin only)
  async createAnnouncement(announcementData) {
    try {
      const response = await this.api.post('/', announcementData);
      return {
        success: true,
        data: response.data,
        message: 'Announcement created successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create announcement',
      };
    }
  }

  // Update existing announcement (admin only)
  async updateAnnouncement(id, announcementData) {
    try {
      const response = await this.api.put(`/${id}`, announcementData);
      return {
        success: true,
        data: response.data,
        message: 'Announcement updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update announcement',
      };
    }
  }

  // Delete announcement (admin only)
  async deleteAnnouncement(id) {
    try {
      await this.api.delete(`/${id}`);
      return {
        success: true,
        message: 'Announcement deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete announcement',
      };
    }
  }

  // Archive announcement (admin only)
  async archiveAnnouncement(id) {
    try {
      const response = await this.api.patch(`/${id}/archive`);
      return {
        success: true,
        data: response.data,
        message: 'Announcement archived successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to archive announcement',
      };
    }
  }

  // Restore archived announcement (admin only)
  async restoreAnnouncement(id) {
    try {
      const response = await this.api.patch(`/${id}/restore`);
      return {
        success: true,
        data: response.data,
        message: 'Announcement restored successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to restore announcement',
      };
    }
  }

  // Get archived announcements (admin only)
  async getArchivedAnnouncements() {
    try {
      const response = await this.api.get('/archived');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch archived announcements',
      };
    }
  }

  // Quick post for dashboard widget
  async quickPost(title, content) {
    try {
      const response = await this.api.post('/quick', {
        title,
        content,
        priority: 'normal',
      });
      return {
        success: true,
        data: response.data,
        message: 'Quick announcement posted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to post quick announcement',
      };
    }
  }

  // Get announcement statistics (admin only)
  async getAnnouncementStats() {
    try {
      const response = await this.api.get('/stats');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch announcement statistics',
      };
    }
  }

  // Validate announcement data before submission
  validateAnnouncementData(data) {
    const errors = {};

    if (!data.title || data.title.trim().length === 0) {
      errors.title = 'Title is required';
    } else if (data.title.trim().length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    if (!data.content || data.content.trim().length === 0) {
      errors.content = 'Content is required';
    } else if (data.content.trim().length > 5000) {
      errors.content = 'Content must be less than 5000 characters';
    }

    if (data.expirationDate) {
      const expDate = new Date(data.expirationDate);
      const now = new Date();
      if (expDate <= now) {
        errors.expirationDate = 'Expiration date must be in the future';
      }
    }

    if (data.priority && !['low', 'normal', 'high', 'urgent'].includes(data.priority)) {
      errors.priority = 'Invalid priority level';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  // Format announcement for display
  formatAnnouncement(announcement) {
    if (!announcement) return null;

    return {
      ...announcement,
      createdAt: new Date(announcement.createdAt),
      updatedAt: new Date(announcement.updatedAt),
      expirationDate: announcement.expirationDate ? new Date(announcement.expirationDate) : null,
      isExpired: announcement.expirationDate ? new Date(announcement.expirationDate) < new Date() : false,
      isActive: announcement.status === 'active' && (!announcement.expirationDate || new Date(announcement.expirationDate) > new Date()),
    };
  }

  // Format multiple announcements
  formatAnnouncements(announcements) {
    if (!Array.isArray(announcements)) return [];
    return announcements.map(announcement => this.formatAnnouncement(announcement));
  }
}

// Create and export singleton instance
const announcementService = new AnnouncementService();
export default announcementService;

// Export the class as well for testing purposes
export { AnnouncementService };