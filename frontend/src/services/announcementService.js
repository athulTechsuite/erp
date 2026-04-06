import api from './api';

export const announcementService = {
  // Get all announcements (available to all authenticated users)
  getAll: async () => {
    try {
      const response = await api.get('/announcements');
      return response.data;
    } catch (error) {
      console.error('Error fetching announcements:', error);
      throw error;
    }
  },

  // Get announcement by ID (available to all authenticated users)
  getById: async (id) => {
    try {
      const response = await api.get(`/announcements/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching announcement:', error);
      throw error;
    }
  },

  // Create new announcement (admin only)
  create: async (announcementData) => {
    try {
      const response = await api.post('/announcements', announcementData);
      return response.data;
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw error;
    }
  },

  // Update announcement (admin only)
  update: async (id, announcementData) => {
    try {
      const response = await api.put(`/announcements/${id}`, announcementData);
      return response.data;
    } catch (error) {
      console.error('Error updating announcement:', error);
      throw error;
    }
  },

  // Delete announcement (admin only)
  delete: async (id) => {
    try {
      const response = await api.delete(`/announcements/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting announcement:', error);
      throw error;
    }
  },

  // Get active announcements for dashboard display
  getActive: async () => {
    try {
      const response = await api.get('/announcements/active');
      return response.data;
    } catch (error) {
      console.error('Error fetching active announcements:', error);
      throw error;
    }
  }
};

export default announcementService;