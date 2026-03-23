/**
 * Announcement utilities for managing company announcements
 * Handles priority levels, scheduling, read/unread tracking, and archiving
 */

// Priority levels for announcements
export const PRIORITY_LEVELS = {
  NORMAL: 'normal',
  IMPORTANT: 'important',
  URGENT: 'urgent'
};

// Priority level display configurations
export const PRIORITY_CONFIG = {
  [PRIORITY_LEVELS.NORMAL]: {
    label: 'Normal',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: 'info'
  },
  [PRIORITY_LEVELS.IMPORTANT]: {
    label: 'Important',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    icon: 'warning'
  },
  [PRIORITY_LEVELS.URGENT]: {
    label: 'Urgent',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    icon: 'alert'
  }
};

/**
 * Formats announcement date for display
 * @param {Date|string} date - The date to format
 * @param {boolean} includeTime - Whether to include time in the format
 * @returns {string} Formatted date string
 */
export const formatAnnouncementDate = (date, includeTime = true) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (includeTime) {
    return dateObj.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Checks if an announcement is scheduled for future publication
 * @param {Object} announcement - The announcement object
 * @returns {boolean} True if announcement is scheduled
 */
export const isScheduled = (announcement) => {
  if (!announcement.publishedAt) return false;
  return new Date(announcement.publishedAt) > new Date();
};

/**
 * Checks if an announcement is published and visible
 * @param {Object} announcement - The announcement object
 * @returns {boolean} True if announcement is published
 */
export const isPublished = (announcement) => {
  if (!announcement.publishedAt) return false;
  return new Date(announcement.publishedAt) <= new Date();
};

/**
 * Checks if an announcement should be archived (older than 6 months)
 * @param {Object} announcement - The announcement object
 * @returns {boolean} True if announcement should be archived
 */
export const shouldArchive = (announcement) => {
  if (!announcement.publishedAt) return false;
  
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  return new Date(announcement.publishedAt) < sixMonthsAgo;
};

/**
 * Sorts announcements by priority and publication date
 * @param {Array} announcements - Array of announcement objects
 * @returns {Array} Sorted announcements array
 */
export const sortAnnouncements = (announcements) => {
  const priorityOrder = {
    [PRIORITY_LEVELS.URGENT]: 3,
    [PRIORITY_LEVELS.IMPORTANT]: 2,
    [PRIORITY_LEVELS.NORMAL]: 1
  };

  return announcements.sort((a, b) => {
    // First sort by priority
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then sort by publication date (newest first)
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });
};

/**
 * Filters announcements based on criteria
 * @param {Array} announcements - Array of announcement objects
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered announcements array
 */
export const filterAnnouncements = (announcements, filters = {}) => {
  return announcements.filter(announcement => {
    // Filter by priority
    if (filters.priority && announcement.priority !== filters.priority) {
      return false;
    }
    
    // Filter by published status
    if (filters.published !== undefined) {
      const published = isPublished(announcement);
      if (filters.published !== published) return false;
    }
    
    // Filter by read status for specific user
    if (filters.unreadOnly && filters.userId) {
      const isRead = announcement.readBy?.includes(filters.userId);
      if (isRead) return false;
    }
    
    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const titleMatch = announcement.title.toLowerCase().includes(query);
      const contentMatch = announcement.content.toLowerCase().includes(query);
      if (!titleMatch && !contentMatch) return false;
    }
    
    // Filter by date range
    if (filters.startDate || filters.endDate) {
      const announcementDate = new Date(announcement.publishedAt);
      if (filters.startDate && announcementDate < new Date(filters.startDate)) {
        return false;
      }
      if (filters.endDate && announcementDate > new Date(filters.endDate)) {
        return false;
      }
    }
    
    return true;
  });
};

/**
 * Calculates read statistics for an announcement
 * @param {Object} announcement - The announcement object
 * @param {number} totalEmployees - Total number of employees
 * @returns {Object} Read statistics object
 */
export const calculateReadStats = (announcement, totalEmployees) => {
  const readCount = announcement.readBy?.length || 0;
  const unreadCount = totalEmployees - readCount;
  const readPercentage = totalEmployees > 0 ? (readCount / totalEmployees * 100).toFixed(1) : 0;
  
  return {
    readCount,
    unreadCount,
    totalEmployees,
    readPercentage: parseFloat(readPercentage)
  };
};

/**
 * Validates announcement data before saving
 * @param {Object} announcementData - The announcement data to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateAnnouncement = (announcementData) => {
  const errors = [];
  
  // Required fields validation
  if (!announcementData.title?.trim()) {
    errors.push('Title is required');
  }
  
  if (!announcementData.content?.trim()) {
    errors.push('Content is required');
  }
  
  if (!announcementData.priority || !Object.values(PRIORITY_LEVELS).includes(announcementData.priority)) {
    errors.push('Valid priority level is required');
  }
  
  // Title length validation
  if (announcementData.title?.length > 200) {
    errors.push('Title must be less than 200 characters');
  }
  
  // Content length validation
  if (announcementData.content?.length > 10000) {
    errors.push('Content must be less than 10,000 characters');
  }
  
  // Publication date validation
  if (announcementData.publishedAt) {
    const publishDate = new Date(announcementData.publishedAt);
    if (isNaN(publishDate.getTime())) {
      errors.push('Invalid publication date');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Generates notification message for new announcements
 * @param {Object} announcement - The announcement object
 * @returns {Object} Notification message object
 */
export const generateNotificationMessage = (announcement) => {
  const priorityConfig = PRIORITY_CONFIG[announcement.priority];
  
  return {
    title: `New ${priorityConfig.label} Announcement`,
    message: announcement.title,
    priority: announcement.priority,
    data: {
      announcementId: announcement.id,
      type: 'announcement'
    }
  };
};

/**
 * Formats file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size string
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Checks if file type is allowed for attachments
 * @param {string} fileType - MIME type of the file
 * @returns {boolean} True if file type is allowed
 */
export const isAllowedFileType = (fileType) => {
  const allowedTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    
    // Archives
    'application/zip',
    'application/x-rar-compressed'
  ];
  
  return allowedTypes.includes(fileType);
};

/**
 * Gets time until announcement publication
 * @param {Object} announcement - The announcement object
 * @returns {string} Human readable time until publication
 */
export const getTimeUntilPublication = (announcement) => {
  if (!isScheduled(announcement)) return null;
  
  const now = new Date();
  const publishDate = new Date(announcement.publishedAt);
  const diffMs = publishDate - now;
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
  } else if (diffHours < 24) {
    return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  } else {
    return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }
};

/**
 * Creates a summary object for dashboard display
 * @param {Array} announcements - Array of all announcements
 * @param {string} userId - Current user ID
 * @returns {Object} Announcement summary statistics
 */
export const getAnnouncementSummary = (announcements, userId) => {
  const published = announcements.filter(isPublished);
  const scheduled = announcements.filter(isScheduled);
  const urgent = published.filter(a => a.priority === PRIORITY_LEVELS.URGENT);
  const unread = published.filter(a => !a.readBy?.includes(userId));
  
  return {
    totalPublished: published.length,
    totalScheduled: scheduled.length,
    urgentCount: urgent.length,
    unreadCount: unread.length,
    recentCount: published.filter(a => {
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 1);
      return new Date(a.publishedAt) > dayAgo;
    }).length
  };
};