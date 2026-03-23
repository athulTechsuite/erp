import axios from 'axios';

const API_BASE_URL = '/api/announcements';

class AnnouncementService {
  /**
   * Get all announcements with optional filtering
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Response with announcements data
   */
  async getAnnouncements(params = {}) {
    try {
      const response = await axios.get(API_BASE_URL, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get a specific announcement by ID
   * @param {string} id - Announcement ID
   * @returns {Promise<Object>} Announcement data
   */
  async getAnnouncementById(id) {
    try {
      const response = await axios.get(`${API_BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a new announcement
   * @param {Object} announcementData - Announcement data
   * @returns {Promise<Object>} Created announcement
   */
  async createAnnouncement(announcementData) {
    try {
      const formData = this.prepareFormData(announcementData);
      const response = await axios.post(API_BASE_URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update an existing announcement
   * @param {string} id - Announcement ID
   * @param {Object} announcementData - Updated announcement data
   * @returns {Promise<Object>} Updated announcement
   */
  async updateAnnouncement(id, announcementData) {
    try {
      const formData = this.prepareFormData(announcementData);
      const response = await axios.put(`${API_BASE_URL}/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete an announcement
   * @param {string} id - Announcement ID
   * @returns {Promise<void>}
   */
  async deleteAnnouncement(id) {
    try {
      await axios.delete(`${API_BASE_URL}/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Mark announcement as read for current user
   * @param {string} id - Announcement ID
   * @returns {Promise<void>}
   */
  async markAsRead(id) {
    try {
      await axios.post(`${API_BASE_URL}/${id}/mark-read`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Mark announcement as unread for current user
   * @param {string} id - Announcement ID
   * @returns {Promise<void>}
   */
  async markAsUnread(id) {
    try {
      await axios.post(`${API_BASE_URL}/${id}/mark-unread`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get read statistics for an announcement
   * @param {string} id - Announcement ID
   * @returns {Promise<Object>} Read statistics
   */
  async getReadStatistics(id) {
    try {
      const response = await axios.get(`${API_BASE_URL}/${id}/statistics`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Schedule announcement for future publication
   * @param {string} id - Announcement ID
   * @param {Date} publishDate - Publication date
   * @returns {Promise<Object>} Updated announcement
   */
  async scheduleAnnouncement(id, publishDate) {
    try {
      const response = await axios.post(`${API_BASE_URL}/${id}/schedule`, {
        publishDate: publishDate.toISOString(),
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get archived announcements
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Archived announcements
   */
  async getArchivedAnnouncements(params = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/archived`, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Archive announcement manually
   * @param {string} id - Announcement ID
   * @returns {Promise<void>}
   */
  async archiveAnnouncement(id) {
    try {
      await axios.post(`${API_BASE_URL}/${id}/archive`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Restore archived announcement
   * @param {string} id - Announcement ID
   * @returns {Promise<Object>} Restored announcement
   */
  async restoreAnnouncement(id) {
    try {
      const response = await axios.post(`${API_BASE_URL}/${id}/restore`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get unread announcements count for current user
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount() {
    try {
      const response = await axios.get(`${API_BASE_URL}/unread-count`);
      return response.data.count;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Upload attachment for announcement
   * @param {File} file - File to upload
   * @returns {Promise<Object>} Upload result
   */
  async uploadAttachment(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API_BASE_URL}/upload-attachment`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete attachment
   * @param {string} attachmentId - Attachment ID
   * @returns {Promise<void>}
   */
  async deleteAttachment(attachmentId) {
    try {
      await axios.delete(`${API_BASE_URL}/attachments/${attachmentId}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Prepare form data for announcement submission
   * @param {Object} data - Announcement data
   * @returns {FormData} Prepared form data
   */
  prepareFormData(data) {
    const formData = new FormData();
    
    // Add basic fields
    Object.keys(data).forEach(key => {
      if (key !== 'attachments' && data[key] !== undefined && data[key] !== null) {
        if (data[key] instanceof Date) {
          formData.append(key, data[key].toISOString());
        } else if (typeof data[key] === 'object') {
          formData.append(key, JSON.stringify(data[key]));
        } else {
          formData.append(key, data[key]);
        }
      }
    });

    // Add attachments
    if (data.attachments && Array.isArray(data.attachments)) {
      data.attachments.forEach((attachment, index) => {
        if (attachment instanceof File) {
          formData.append(`attachments`, attachment);
        } else if (typeof attachment === 'string') {
          // Existing attachment ID
          formData.append(`existingAttachments[${index}]`, attachment);
        }
      });
    }

    return formData;
  }

  /**
   * Handle API errors
   * @param {Error} error - Axios error
   * @returns {Error} Formatted error
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || 'An error occurred';
      const statusCode = error.response.status;
      
      const customError = new Error(message);
      customError.statusCode = statusCode;
      customError.response = error.response.data;
      
      return customError;
    } else if (error.request) {
      // Network error
      return new Error('Network error: Unable to connect to server');
    } else {
      // Other error
      return new Error(error.message || 'An unexpected error occurred');
    }
  }

  /**
   * Validate announcement data before submission
   * @param {Object} data - Announcement data
   * @returns {Object} Validation result
   */
  validateAnnouncement(data) {
    const errors = {};

    if (!data.title || data.title.trim().length === 0) {
      errors.title = 'Title is required';
    } else if (data.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    if (!data.content || data.content.trim().length === 0) {
      errors.content = 'Content is required';
    }

    if (!data.priority || !['normal', 'important', 'urgent'].includes(data.priority)) {
      errors.priority = 'Valid priority level is required';
    }

    if (data.publishDate && new Date(data.publishDate) < new Date()) {
      errors.publishDate = 'Publication date cannot be in the past';
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
  formatAnnouncement(announcement) {
    return {
      ...announcement,
      publishDate: announcement.publishDate ? new Date(announcement.publishDate) : null,
      createdAt: new Date(announcement.createdAt),
      updatedAt: new Date(announcement.updatedAt),
      isScheduled: announcement.publishDate && new Date(announcement.publishDate) > new Date(),
      isPublished: announcement.status === 'published' && 
                   (!announcement.publishDate || new Date(announcement.publishDate) <= new Date()),
      priorityLabel: this.getPriorityLabel(announcement.priority),
      attachmentCount: announcement.attachments ? announcement.attachments.length : 0
    };
  }

  /**
   * Get human-readable priority label
   * @param {string} priority - Priority level
   * @returns {string} Priority label
   */
  getPriorityLabel(priority) {
    const labels = {
      normal: 'Normal',
      important: 'Important',
      urgent: 'Urgent'
    };
    return labels[priority] || 'Normal';
  }

  /**
   * Get priority color class
   * @param {string} priority - Priority level
   * @returns {string} CSS class name
   */
  getPriorityColorClass(priority) {
    const classes = {
      normal: 'priority-normal',
      important: 'priority-important',
      urgent: 'priority-urgent'
    };
    return classes[priority] || 'priority-normal';
  }
}

export default new AnnouncementService();