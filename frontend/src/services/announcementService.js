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

class AnnouncementService {
  /**
   * Get all announcements (for employees to view on dashboard)
   */
  async getAllAnnouncements() {
    try {
      const response = await api.get(API_ENDPOINTS.ANNOUNCEMENTS);
      return response.data;
    } catch (error) {
      console.error('Error fetching announcements:', error);
      throw error;
    }
  }

  /**
   * Get announcements for admin management (includes inactive ones)
   */
  async getAnnouncementsForAdmin() {
    try {
      const response = await api.get(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS);
      return response.data;
    } catch (error) {
      console.error('Error fetching admin announcements:', error);
      throw error;
    }
  }

  /**
   * Get a specific announcement by ID
   */
  async getAnnouncementById(id) {
    try {
      const response = await api.get(`${API_ENDPOINTS.ANNOUNCEMENTS}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching announcement:', error);
      throw error;
    }
  }

  /**
   * Create a new announcement (admin only)
   */
  async createAnnouncement(announcementData) {
    try {
      const response = await api.post(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS, announcementData);
      return response.data;
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw error;
    }
  }

  /**
   * Update an existing announcement (admin only)
   */
  async updateAnnouncement(id, announcementData) {
    try {
      const response = await api.put(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS}/${id}`, announcementData);
      return response.data;
    } catch (error) {
      console.error('Error updating announcement:', error);
      throw error;
    }
  }

  /**
   * Delete an announcement (admin only)
   */
  async deleteAnnouncement(id) {
    try {
      const response = await api.delete(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting announcement:', error);
      throw error;
    }
  }

  /**
   * Toggle announcement active status (admin only)
   */
  async toggleAnnouncementStatus(id) {
    try {
      const response = await api.patch(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS}/${id}/toggle-status`);
      return response.data;
    } catch (error) {
      console.error('Error toggling announcement status:', error);
      throw error;
    }
  }

  /**
   * Get announcement statistics (admin only)
   */
  async getAnnouncementStats() {
    try {
      const response = await api.get(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_STATS);
      return response.data;
    } catch (error) {
      console.error('Error fetching announcement stats:', error);
      throw error;
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
      const response = await api.get(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_SEARCH}?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error searching announcements:', error);
      throw error;
    }
  }

  /**
   * Bulk delete announcements (admin only)
   */
  async bulkDeleteAnnouncements(announcementIds) {
    try {
      const response = await api.post(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_BULK_DELETE, {
        ids: announcementIds
      });
      return response.data;
    } catch (error) {
      console.error('Error bulk deleting announcements:', error);
      throw error;
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
      const response = await api.get(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_CHECK_PERMISSION);
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