import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const API_URL = `${API_BASE_URL}/api/announcements`;

// Get authentication token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Configure axios instance with auth headers
const apiClient = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const announcementService = {
  // Get all announcements (for regular users - dashboard view)
  getAllAnnouncements: async () => {
    try {
      const response = await apiClient.get('/');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch announcements');
    }
  },

  // Get announcements for admin management (includes additional metadata)
  getAnnouncementsForAdmin: async () => {
    try {
      const response = await apiClient.get('/admin');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch announcements');
    }
  },

  // Create new announcement (admin only)
  createAnnouncement: async (announcementData) => {
    try {
      const response = await apiClient.post('/', announcementData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to create announcement');
    }
  },

  // Update existing announcement (admin only)
  updateAnnouncement: async (id, announcementData) => {
    try {
      const response = await apiClient.put(`/${id}`, announcementData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to update announcement');
    }
  },

  // Delete announcement (admin only)
  deleteAnnouncement: async (id) => {
    try {
      const response = await apiClient.delete(`/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to delete announcement');
    }
  },

  // Get single announcement by ID
  getAnnouncementById: async (id) => {
    try {
      const response = await apiClient.get(`/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch announcement');
    }
  },

  // Mark announcement as read by current user
  markAsRead: async (id) => {
    try {
      const response = await apiClient.post(`/${id}/read`);
      return response.data;
    } catch (error) {
      // Non-critical error, don't throw
      console.error('Failed to mark announcement as read:', error);
      return null;
    }
  },

  // Get unread announcements count for current user
  getUnreadCount: async () => {
    try {
      const response = await apiClient.get('/unread/count');
      return response.data.count || 0;
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
      return 0;
    }
  },

  // Resend announcement emails (admin only)
  resendEmails: async (id) => {
    try {
      const response = await apiClient.post(`/${id}/resend-emails`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to resend announcement emails');
    }
  },

  // Get email delivery status for announcement (admin only)
  getEmailStatus: async (id) => {
    try {
      const response = await apiClient.get(`/${id}/email-status`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch email status');
    }
  }
};

export default announcementService;