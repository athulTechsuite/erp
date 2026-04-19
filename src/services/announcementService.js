import { apiClient } from './apiClient';
import { emailService } from './emailService';
import { userService } from './userService';

class AnnouncementService {
  constructor() {
    this.baseUrl = '/api/announcements';
  }

  /**
   * Create a new announcement
   * @param {Object} announcementData - The announcement data
   * @param {string} announcementData.title - Announcement title
   * @param {string} announcementData.content - Rich text content
   * @param {Date} announcementData.publishDate - Publication date
   * @param {Date} announcementData.expirationDate - Expiration date
   * @param {boolean} announcementData.isUrgent - Whether announcement is urgent
   * @param {boolean} announcementData.isPriority - Whether announcement is priority
   * @returns {Promise<Object>} Created announcement
   */
  async createAnnouncement(announcementData) {
    try {
      const response = await apiClient.post(this.baseUrl, {
        ...announcementData,
        createdAt: new Date().toISOString(),
        status: 'active'
      });

      // Send email notifications for urgent announcements
      if (announcementData.isUrgent) {
        await this.sendUrgentAnnouncementNotification(response.data);
      }

      return response.data;
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw new Error('Failed to create announcement');
    }
  }

  /**
   * Get all active announcements
   * @param {Object} filters - Filter options
   * @param {boolean} filters.includeExpired - Include expired announcements
   * @param {string} filters.priority - Filter by priority level
   * @returns {Promise<Array>} List of announcements
   */
  async getAnnouncements(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (!filters.includeExpired) {
        params.append('active', 'true');
      }
      
      if (filters.priority) {
        params.append('priority', filters.priority);
      }

      const response = await apiClient.get(`${this.baseUrl}?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching announcements:', error);
      throw new Error('Failed to fetch announcements');
    }
  }

  /**
   * Get a specific announcement by ID
   * @param {string} announcementId - Announcement ID
   * @returns {Promise<Object>} Announcement data
   */
  async getAnnouncementById(announcementId) {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${announcementId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching announcement:', error);
      throw new Error('Failed to fetch announcement');
    }
  }

  /**
   * Update an existing announcement
   * @param {string} announcementId - Announcement ID
   * @param {Object} updateData - Updated announcement data
   * @returns {Promise<Object>} Updated announcement
   */
  async updateAnnouncement(announcementId, updateData) {
    try {
      const response = await apiClient.put(`${this.baseUrl}/${announcementId}`, {
        ...updateData,
        updatedAt: new Date().toISOString()
      });

      // Send notifications if announcement becomes urgent
      if (updateData.isUrgent && !response.data.previouslyUrgent) {
        await this.sendUrgentAnnouncementNotification(response.data);
      }

      return response.data;
    } catch (error) {
      console.error('Error updating announcement:', error);
      throw new Error('Failed to update announcement');
    }
  }

  /**
   * Delete an announcement
   * @param {string} announcementId - Announcement ID
   * @returns {Promise<void>}
   */
  async deleteAnnouncement(announcementId) {
    try {
      await apiClient.delete(`${this.baseUrl}/${announcementId}`);
    } catch (error) {
      console.error('Error deleting announcement:', error);
      throw new Error('Failed to delete announcement');
    }
  }

  /**
   * Mark announcement as read for current user
   * @param {string} announcementId - Announcement ID
   * @returns {Promise<void>}
   */
  async markAsRead(announcementId) {
    try {
      const currentUser = await userService.getCurrentUser();
      await apiClient.post(`${this.baseUrl}/${announcementId}/read`, {
        userId: currentUser.id,
        readAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking announcement as read:', error);
      throw new Error('Failed to mark announcement as read');
    }
  }

  /**
   * Mark announcement as unread for current user
   * @param {string} announcementId - Announcement ID
   * @returns {Promise<void>}
   */
  async markAsUnread(announcementId) {
    try {
      const currentUser = await userService.getCurrentUser();
      await apiClient.delete(`${this.baseUrl}/${announcementId}/read`, {
        data: { userId: currentUser.id }
      });
    } catch (error) {
      console.error('Error marking announcement as unread:', error);
      throw new Error('Failed to mark announcement as unread');
    }
  }

  /**
   * Get unread announcements count for current user
   * @returns {Promise<number>} Count of unread announcements
   */
  async getUnreadCount() {
    try {
      const currentUser = await userService.getCurrentUser();
      const response = await apiClient.get(`${this.baseUrl}/unread-count?userId=${currentUser.id}`);
      return response.data.count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  /**
   * Archive expired announcements
   * @returns {Promise<number>} Number of archived announcements
   */
  async archiveExpiredAnnouncements() {
    try {
      const response = await apiClient.post(`${this.baseUrl}/archive-expired`);
      return response.data.archivedCount;
    } catch (error) {
      console.error('Error archiving expired announcements:', error);
      throw new Error('Failed to archive expired announcements');
    }
  }

  /**
   * Get announcements by priority level
   * @param {string} priority - Priority level ('urgent', 'priority', 'normal')
   * @returns {Promise<Array>} Filtered announcements
   */
  async getAnnouncementsByPriority(priority) {
    try {
      const response = await apiClient.get(`${this.baseUrl}?priority=${priority}&active=true`);
      return response.data;
    } catch (error) {
      console.error('Error fetching announcements by priority:', error);
      throw new Error('Failed to fetch announcements by priority');
    }
  }

  /**
   * Send email notifications for urgent announcements
   * @param {Object} announcement - Announcement data
   * @returns {Promise<void>}
   * @private
   */
  async sendUrgentAnnouncementNotification(announcement) {
    try {
      // Get all active employees
      const employees = await userService.getAllEmployees();
      
      const emailData = {
        subject: `🚨 Urgent Announcement: ${announcement.title}`,
        template: 'urgent-announcement',
        data: {
          title: announcement.title,
          content: announcement.content,
          publishDate: announcement.publishDate,
          announcementUrl: `${window.location.origin}/announcements/${announcement.id}`
        }
      };

      // Send batch email notifications
      const emailPromises = employees.map(employee => 
        emailService.sendEmail({
          ...emailData,
          to: employee.email,
          data: {
            ...emailData.data,
            recipientName: employee.name
          }
        })
      );

      await Promise.allSettled(emailPromises);
    } catch (error) {
      console.error('Error sending urgent announcement notifications:', error);
      // Don't throw error here as announcement creation should still succeed
    }
  }

  /**
   * Schedule announcement for future publication
   * @param {Object} announcementData - Announcement data with future publish date
   * @returns {Promise<Object>} Scheduled announcement
   */
  async scheduleAnnouncement(announcementData) {
    try {
      const response = await apiClient.post(`${this.baseUrl}/schedule`, {
        ...announcementData,
        status: 'scheduled',
        createdAt: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Error scheduling announcement:', error);
      throw new Error('Failed to schedule announcement');
    }
  }

  /**
   * Publish scheduled announcements
   * @returns {Promise<Array>} Published announcements
   */
  async publishScheduledAnnouncements() {
    try {
      const response = await apiClient.post(`${this.baseUrl}/publish-scheduled`);
      
      // Send urgent notifications for any newly published urgent announcements
      const urgentAnnouncements = response.data.filter(announcement => announcement.isUrgent);
      
      for (const announcement of urgentAnnouncements) {
        await this.sendUrgentAnnouncementNotification(announcement);
      }

      return response.data;
    } catch (error) {
      console.error('Error publishing scheduled announcements:', error);
      throw new Error('Failed to publish scheduled announcements');
    }
  }

  /**
   * Get announcement read status for users (admin only)
   * @param {string} announcementId - Announcement ID
   * @returns {Promise<Object>} Read status statistics
   */
  async getReadStatistics(announcementId) {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${announcementId}/statistics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching read statistics:', error);
      throw new Error('Failed to fetch read statistics');
    }
  }

  /**
   * Validate announcement data
   * @param {Object} announcementData - Announcement data to validate
   * @returns {Object} Validation result
   */
  validateAnnouncementData(announcementData) {
    const errors = [];

    if (!announcementData.title || announcementData.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!announcementData.content || announcementData.content.trim().length === 0) {
      errors.push('Content is required');
    }

    if (announcementData.title && announcementData.title.length > 200) {
      errors.push('Title must be less than 200 characters');
    }

    if (announcementData.publishDate && new Date(announcementData.publishDate) < new Date()) {
      errors.push('Publish date cannot be in the past');
    }

    if (announcementData.expirationDate && announcementData.publishDate) {
      if (new Date(announcementData.expirationDate) <= new Date(announcementData.publishDate)) {
        errors.push('Expiration date must be after publish date');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const announcementService = new AnnouncementService();
export default announcementService;