import api from './api';

class AnnouncementService {
  /**
   * Get all announcements (for employees to view on dashboard)
   */
  async getAllAnnouncements() {
    try {
      const response = await api.get('/announcements');
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
      const response = await api.get('/admin/announcements');
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
      const response = await api.get(`/announcements/${id}`);
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
      const response = await api.post('/admin/announcements', announcementData);
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
      const response = await api.put(`/admin/announcements/${id}`, announcementData);
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
      const response = await api.delete(`/admin/announcements/${id}`);
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
      const response = await api.patch(`/admin/announcements/${id}/toggle-status`);
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
      const response = await api.get('/admin/announcements/stats');
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
      const response = await api.get(`/admin/announcements/search?${params}`);
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
      const response = await api.post('/admin/announcements/bulk-delete', {
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