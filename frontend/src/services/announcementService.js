import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
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
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const announcementService = {
  // Get all announcements (public access)
  getAnnouncements: async () => {
    try {
      const response = await apiClient.get('/announcements');
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
  },

  // Get single announcement by ID
  getAnnouncementById: async (id) => {
    try {
      const response = await apiClient.get(`/announcements/${id}`);
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
  },

  // Create new announcement (admin only)
  createAnnouncement: async (announcementData) => {
    try {
      const response = await apiClient.post('/announcements', announcementData);
      return {
        success: true,
        data: response.data,
        message: 'Announcement created successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create announcement',
        validationErrors: error.response?.data?.errors || null,
      };
    }
  },

  // Update existing announcement (admin only)
  updateAnnouncement: async (id, announcementData) => {
    try {
      const response = await apiClient.put(`/announcements/${id}`, announcementData);
      return {
        success: true,
        data: response.data,
        message: 'Announcement updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update announcement',
        validationErrors: error.response?.data?.errors || null,
      };
    }
  },

  // Delete announcement (admin only)
  deleteAnnouncement: async (id) => {
    try {
      await apiClient.delete(`/announcements/${id}`);
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
  },

  // Toggle announcement status (admin only)
  toggleAnnouncementStatus: async (id, status) => {
    try {
      const response = await apiClient.patch(`/announcements/${id}/status`, { status });
      return {
        success: true,
        data: response.data,
        message: `Announcement ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update announcement status',
      };
    }
  },

  // Get announcements with pagination and filtering (admin dashboard)
  getAnnouncementsAdmin: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.status) queryParams.append('status', params.status);
      if (params.search) queryParams.append('search', params.search);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const url = `/announcements/admin${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get(url);
      
      return {
        success: true,
        data: response.data.announcements || response.data,
        pagination: response.data.pagination || null,
        total: response.data.total || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch announcements',
      };
    }
  },

  // Validate announcement data before submission
  validateAnnouncementData: (data) => {
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
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  },

  // Get announcement statistics (admin only)
  getAnnouncementStats: async () => {
    try {
      const response = await apiClient.get('/announcements/stats');
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
  },

  // Search announcements
  searchAnnouncements: async (query, filters = {}) => {
    try {
      const params = new URLSearchParams();
      params.append('q', query);
      
      if (filters.status) params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.authorId) params.append('authorId', filters.authorId);
      
      const response = await apiClient.get(`/announcements/search?${params.toString()}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to search announcements',
      };
    }
  },
};

export default announcementService;