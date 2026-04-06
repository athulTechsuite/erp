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

// Error types for better error handling
const ERROR_TYPES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  FORBIDDEN_ERROR: 'FORBIDDEN_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED'
};

// Retry configuration
const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_MULTIPLIER: 2,
  RETRYABLE_STATUS_CODES: [500, 502, 503, 504, 408, 429],
  RETRYABLE_ERROR_TYPES: [ERROR_TYPES.NETWORK_ERROR, ERROR_TYPES.TIMEOUT_ERROR]
};

class AnnouncementService {
  constructor() {
    // Track ongoing requests to prevent duplicates
    this.requestCache = new Map();
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateRetryDelay(attempt) {
    const delay = Math.min(
      RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1),
      RETRY_CONFIG.MAX_DELAY
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error) {
    // Network errors (no response)
    if (!error.response) {
      return true;
    }

    // Specific status codes
    if (RETRY_CONFIG.RETRYABLE_STATUS_CODES.includes(error.response.status)) {
      return true;
    }

    // Rate limiting
    if (error.response.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * Execute API request with retry mechanism
   */
  async executeWithRetry(requestFn, context = 'API request', maxRetries = RETRY_CONFIG.MAX_RETRIES) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await requestFn();
        
        // Clear any cached error state on success
        if (attempt > 1) {
          console.log(`${context} succeeded after ${attempt - 1} retries`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Don't retry on the last attempt
        if (attempt > maxRetries) {
          break;
        }

        // Don't retry if error is not retryable
        if (!this.isRetryableError(error)) {
          console.warn(`${context} failed with non-retryable error:`, error.message);
          break;
        }

        const delay = this.calculateRetryDelay(attempt);
        const retryAfter = error.response?.headers?.['retry-after'];
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;

        console.warn(`${context} failed (attempt ${attempt}/${maxRetries + 1}), retrying in ${Math.round(waitTime)}ms:`, error.message);
        
        await this.sleep(waitTime);
      }
    }

    // All retries exhausted
    console.error(`${context} failed after ${maxRetries + 1} attempts`);
    
    const retryError = this.handleError(lastError, context);
    retryError.type = ERROR_TYPES.RETRY_EXHAUSTED;
    retryError.attempts = maxRetries + 1;
    
    throw retryError;
  }

  /**
   * Create a cache key for request deduplication
   */
  createCacheKey(method, url, data = null) {
    return `${method}:${url}:${data ? JSON.stringify(data) : ''}`;
  }

  /**
   * Execute request with caching for GET requests to prevent duplicates
   */
  async executeWithCache(requestFn, cacheKey, context) {
    // Only cache GET requests
    if (cacheKey && cacheKey.startsWith('GET:')) {
      const cachedPromise = this.requestCache.get(cacheKey);
      if (cachedPromise) {
        console.log(`Using cached request for ${context}`);
        return cachedPromise;
      }
    }

    const requestPromise = this.executeWithRetry(requestFn, context);
    
    // Cache the promise
    if (cacheKey && cacheKey.startsWith('GET:')) {
      this.requestCache.set(cacheKey, requestPromise);
      
      // Clear cache after request completes (success or failure)
      requestPromise
        .finally(() => {
          setTimeout(() => {
            this.requestCache.delete(cacheKey);
          }, 5000); // Keep cache for 5 seconds
        })
        .catch(() => {}); // Prevent unhandled rejection
    }

    return requestPromise;
  }

  /**
   * Handle API errors and provide meaningful error messages
   */
  handleError(error, context = 'API request') {
    let errorType = ERROR_TYPES.SERVER_ERROR;
    let userMessage = 'An unexpected error occurred. Please try again.';
    
    if (!error.response) {
      // Network error or timeout
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorType = ERROR_TYPES.TIMEOUT_ERROR;
        userMessage = 'Request timed out. Please check your connection and try again.';
      } else {
        errorType = ERROR_TYPES.NETWORK_ERROR;
        userMessage = 'Network error. Please check your internet connection and try again.';
      }
    } else {
      const status = error.response.status;
      
      switch (status) {
        case 400:
          errorType = ERROR_TYPES.VALIDATION_ERROR;
          userMessage = error.response.data?.message || 'Invalid request data.';
          break;
        case 401:
          errorType = ERROR_TYPES.AUTH_ERROR;
          userMessage = 'You are not authorized. Please log in and try again.';
          break;
        case 403:
          errorType = ERROR_TYPES.FORBIDDEN_ERROR;
          userMessage = 'You do not have permission to perform this action.';
          break;
        case 404:
          errorType = ERROR_TYPES.NOT_FOUND_ERROR;
          userMessage = 'The requested resource was not found.';
          break;
        case 408:
          errorType = ERROR_TYPES.TIMEOUT_ERROR;
          userMessage = 'Request timed out. Please try again.';
          break;
        case 422:
          errorType = ERROR_TYPES.VALIDATION_ERROR;
          userMessage = error.response.data?.message || 'Validation failed.';
          break;
        case 429:
          errorType = ERROR_TYPES.SERVER_ERROR;
          userMessage = 'Too many requests. Please wait a moment and try again.';
          break;
        case 500:
          errorType = ERROR_TYPES.SERVER_ERROR;
          userMessage = 'Server error. Please try again later.';
          break;
        case 502:
        case 503:
        case 504:
          errorType = ERROR_TYPES.SERVER_ERROR;
          userMessage = 'Server is temporarily unavailable. Please try again later.';
          break;
        default:
          userMessage = error.response.data?.message || `Request failed with status ${status}`;
      }
    }

    console.error(`${context} failed:`, {
      errorType,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
      retryable: this.isRetryableError(error)
    });

    const enhancedError = new Error(userMessage);
    enhancedError.type = errorType;
    enhancedError.originalError = error;
    enhancedError.status = error.response?.status;
    enhancedError.retryable = this.isRetryableError(error);
    
    return enhancedError;
  }

  /**
   * Validate API response structure
   */
  validateResponse(response, expectedFields = []) {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format received from server');
    }

    if (expectedFields.length > 0) {
      const missingFields = expectedFields.filter(field => !(field in response));
      if (missingFields.length > 0) {
        throw new Error(`Response missing required fields: ${missingFields.join(', ')}`);
      }
    }

    return true;
  }

  /**
   * Get all announcements (for employees to view on dashboard)
   */
  async getAllAnnouncements() {
    const cacheKey = this.createCacheKey('GET', API_ENDPOINTS.ANNOUNCEMENTS);
    
    return this.executeWithCache(
      async () => {
        const response = await api.get(API_ENDPOINTS.ANNOUNCEMENTS);
        
        if (!response || !response.data) {
          throw new Error('Invalid response format');
        }

        const data = response.data;
        
        // Validate response structure
        if (Array.isArray(data)) {
          // Validate each announcement has required fields
          data.forEach((announcement, index) => {
            if (!announcement.id || !announcement.title) {
              console.warn(`Announcement at index ${index} is missing required fields`);
            }
          });
        } else if (data.data && Array.isArray(data.data)) {
          // Handle paginated response
          data.data.forEach((announcement, index) => {
            if (!announcement.id || !announcement.title) {
              console.warn(`Announcement at index ${index} is missing required fields`);
            }
          });
        }
        
        return data;
      },
      cacheKey,
      'Fetching announcements'
    );
  }

  /**
   * Get announcements for admin management (includes inactive ones)
   */
  async getAnnouncementsForAdmin() {
    const cacheKey = this.createCacheKey('GET', API_ENDPOINTS.ADMIN_ANNOUNCEMENTS);
    
    return this.executeWithCache(
      async () => {
        const response = await api.get(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS);
        
        if (!response || !response.data) {
          throw new Error('Invalid response format');
        }

        return response.data;
      },
      cacheKey,
      'Fetching admin announcements'
    );
  }

  /**
   * Get a specific announcement by ID
   */
  async getAnnouncementById(id) {
    if (!id) {
      throw new Error('Announcement ID is required');
    }

    const cacheKey = this.createCacheKey('GET', `${API_ENDPOINTS.ANNOUNCEMENTS}/${id}`);
    
    return this.executeWithCache(
      async () => {
        const response = await api.get(`${API_ENDPOINTS.ANNOUNCEMENTS}/${id}`);
        
        if (!response || !response.data) {
          throw new Error('Invalid response format');
        }

        const announcement = response.data;
        this.validateResponse(announcement, ['id', 'title', 'content']);
        
        return announcement;
      },
      cacheKey,
      'Fetching announcement'
    );
  }

  /**
   * Create a new announcement (admin only)
   */
  async createAnnouncement(announcementData) {
    if (!announcementData) {
      throw new Error('Announcement data is required');
    }

    // Validate data before sending
    const validation = this.validateAnnouncementData(announcementData);
    if (!validation.isValid) {
      const validationError = new Error('Validation failed');
      validationError.type = ERROR_TYPES.VALIDATION_ERROR;
      validationError.validationErrors = validation.errors;
      throw validationError;
    }

    return this.executeWithRetry(
      async () => {
        const response = await api.post(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS, announcementData);
        
        if (!response || !response.data) {
          throw new Error('Invalid response format');
        }

        const createdAnnouncement = response.data;
        this.validateResponse(createdAnnouncement, ['id', 'title']);
        
        return createdAnnouncement;
      },
      'Creating announcement'
    );
  }

  /**
   * Update an existing announcement (admin only)
   */
  async updateAnnouncement(id, announcementData) {
    if (!id) {
      throw new Error('Announcement ID is required');
    }
    
    if (!announcementData) {
      throw new Error('Announcement data is required');
    }

    // Validate data before sending
    const validation = this.validateAnnouncementData(announcementData);
    if (!validation.isValid) {
      const validationError = new Error('Validation failed');
      validationError.type = ERROR_TYPES.VALIDATION_ERROR;
      validationError.validationErrors = validation.errors;
      throw validationError;
    }

    return this.executeWithRetry(
      async () => {
        const response = await api.put(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS}/${id}`, announcementData);
        
        if (!response || !response.data) {
          throw new Error('Invalid response format');
        }

        const updatedAnnouncement = response.data;
        this.validateResponse(updatedAnnouncement, ['id', 'title']);
        
        return updatedAnnouncement;
      },
      'Updating announcement'
    );
  }

  /**
   * Delete an announcement (admin only)
   */
  async deleteAnnouncement(id) {
    if (!id) {
      throw new Error('Announcement ID is required');
    }

    return this.executeWithRetry(
      async () => {
        const response = await api.delete(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS}/${id}`);
        
        if (!response) {
          throw new Error('Invalid response format');
        }

        return response.data || { success: true };
      },
      'Deleting announcement',
      2 // Lower retry count for delete operations
    );
  }

  /**
   * Toggle announcement active status (admin only)
   */
  async toggleAnnouncementStatus(id) {
    if (!id) {
      throw new Error('Announcement ID is required');
    }

    return this.executeWithRetry(
      async () => {
        const response = await api.patch(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS}/${id}/toggle-status`);
        
        if (!response || !response.data) {
          throw new Error('Invalid response format');
        }

        const updatedAnnouncement = response.data;
        this.validateResponse(updatedAnnouncement, ['id', 'is_active']);
        
        return updatedAnnouncement;
      },
      'Toggling announcement status'
    );
  }

  /**
   * Get announcement statistics (admin only)
   */
  async getAnnouncementStats() {
    const cacheKey = this.createCacheKey('GET', API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_STATS);
    
    return this.executeWithCache(
      async () => {
        const response = await api.get(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_STATS);
        
        if (!response || !response.data) {
          throw new Error('Invalid response format');
        }

        const stats = response.data;
        // Validate stats have expected numeric fields
        const expectedFields = ['total', 'active', 'inactive'];
        expectedFields.forEach(field => {
          if (stats[field] !== undefined && typeof stats[field] !== 'number') {
            console.warn(`Stats field '${field}' should be a number`);
          }
        });
        
        return stats;
      },
      cacheKey,
      'Fetching announcement stats'
    );
  }

  /**
   * Search announcements (admin only)
   */
  async searchAnnouncements(query, filters = {}) {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query is required and must be a string');
    }

    if (query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }

    const params = new URLSearchParams({
      q: query.trim(),
      ...filters
    });
    
    const cacheKey = this.createCacheKey('GET', `${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_SEARCH}?${params}`);

    return this.executeWithCache(
      async () => {
        const response = await api.get(`${API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_SEARCH}?${params}`);
        
        if (!response || !response.data) {
          throw new Error('Invalid response format');
        }

        const searchResults = response.data;
        
        // Validate search results structure
        if (searchResults.results && Array.isArray(searchResults.results)) {
          searchResults.results.forEach((announcement, index) => {
            if (!announcement.id || !announcement.title) {
              console.warn(`Search result at index ${index} is missing required fields`);
            }
          });
        } else if (Array.isArray(searchResults)) {
          searchResults.forEach((announcement, index) => {
            if (!announcement.id || !announcement.title) {
              console.warn(`Search result at index ${index} is missing required fields`);
            }
          });
        }
        
        return searchResults;
      },
      cacheKey,
      'Searching announcements'
    );
  }

  /**
   * Bulk delete announcements (admin only)
   */
  async bulkDeleteAnnouncements(announcementIds) {
    if (!Array.isArray(announcementIds) || announcementIds.length === 0) {
      throw new Error('Announcement IDs array is required and cannot be empty');
    }

    // Validate all IDs are present
    const invalidIds = announcementIds.filter(id => !id || (typeof id !== 'string' && typeof id !== 'number'));
    if (invalidIds.length > 0) {
      throw new Error('All announcement IDs must be valid');
    }

    return this.executeWithRetry(
      async () => {
        const response = await api.post(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_BULK_DELETE, {
          ids: announcementIds
        });
        
        if (!response || !response.data) {
          throw new Error('Invalid response format');
        }

        const result = response.data;
        
        // Validate bulk delete response
        if (result.deleted_count !== undefined && typeof result.deleted_count !== 'number') {
          console.warn('Bulk delete response should include numeric deleted_count');
        }
        
        return result;
      },
      'Bulk deleting announcements',
      2 // Lower retry count for bulk delete operations
    );
  }

  /**
   * Format announcement data for display
   */
  formatAnnouncement(announcement) {
    if (!announcement || typeof announcement !== 'object') {
      throw new Error('Valid announcement object is required');
    }

    try {
      return {
        ...announcement,
        formattedDate: announcement.created_at 
          ? new Date(announcement.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Date unavailable',
        shortContent: announcement.content && announcement.content.length > 150 
          ? announcement.content.substring(0, 150) + '...' 
          : announcement.content || ''
      };
    } catch (error) {
      console.error('Error formatting announcement:', error);
      return {
        ...announcement,
        formattedDate: 'Invalid date',
        shortContent: announcement.content || ''
      };
    }
  }

  /**
   * Validate announcement data before submission
   */
  validateAnnouncementData(data) {
    const errors = {};

    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: { general: 'Invalid announcement data' }
      };
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters long';
    }

    if (data.title && data.title.length > 200) {
      errors.title = 'Title must not exceed 200 characters';
    }

    if (!data.content || typeof data.content !== 'string' || data.content.trim().length < 10) {
      errors.content = 'Content must be at least 10 characters long';
    }

    if (data.content && data.content.length > 5000) {
      errors.content = 'Content must not exceed 5000 characters';
    }

    // Validate priority if provided
    if (data.priority !== undefined && !['low', 'medium', 'high'].includes(data.priority)) {
      errors.priority = 'Priority must be one of: low, medium, high';
    }

    // Validate is_active if provided
    if (data.is_active !== undefined && typeof data.is_active !== 'boolean') {
      errors.is_active = 'Active status must be a boolean value';
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
    const cacheKey = this.createCacheKey('GET', API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_CHECK_PERMISSION);
    
    try {
      return await this.executeWithCache(
        async () => {
          const response = await api.get(API_ENDPOINTS.ADMIN_ANNOUNCEMENTS_CHECK_PERMISSION);
          
          if (!response || !response.data) {
            console.warn('Invalid response format for permission check');
            return false;
          }

          const hasPermission = response.data.hasPermission;
          
          if (typeof hasPermission !== 'boolean') {
            console.warn('Permission check should return boolean value');
            return false;
          }
          
          return hasPermission;
        },
        cacheKey,
        'Checking announcement permission'
      );
    } catch (error) {
      console.error('Error checking announcement permission:', error);
      return false;
    }
  }

  /**
   * Clear request cache
   */
  clearCache() {
    this.requestCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.requestCache.size,
      keys: Array.from(this.requestCache.keys())
    };
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
  checkManagementPermission,
  clearCache,
  getCacheStats
} = announcementService;

// Export error types and retry config for use in components
export { ERROR_TYPES, RETRY_CONFIG };