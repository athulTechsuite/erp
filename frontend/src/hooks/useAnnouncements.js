import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all announcements
  const fetchAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/announcements');
      setAnnouncements(response.data);
    } catch (err) {
      setError('Failed to fetch announcements');
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create new announcement (admin only)
  const createAnnouncement = async (announcementData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/announcements', announcementData);
      setAnnouncements(prev => [response.data, ...prev]);
      toast.success('Announcement created successfully');
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to create announcement';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update announcement (admin only)
  const updateAnnouncement = async (id, announcementData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.put(`/announcements/${id}`, announcementData);
      setAnnouncements(prev => 
        prev.map(announcement => 
          announcement._id === id ? response.data : announcement
        )
      );
      toast.success('Announcement updated successfully');
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update announcement';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete announcement (admin only)
  const deleteAnnouncement = async (id) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/announcements/${id}`);
      setAnnouncements(prev => prev.filter(announcement => announcement._id !== id));
      toast.success('Announcement deleted successfully');
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to delete announcement';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get single announcement by ID
  const getAnnouncementById = (id) => {
    return announcements.find(announcement => announcement._id === id);
  };

  // Toggle announcement status (admin only)
  const toggleAnnouncementStatus = async (id, isActive) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.patch(`/announcements/${id}/status`, { isActive });
      setAnnouncements(prev => 
        prev.map(announcement => 
          announcement._id === id ? response.data : announcement
        )
      );
      toast.success(`Announcement ${isActive ? 'activated' : 'deactivated'} successfully`);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update announcement status';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get active announcements only
  const getActiveAnnouncements = () => {
    return announcements.filter(announcement => announcement.isActive !== false);
  };

  // Initialize data fetch on hook mount
  useEffect(() => {
    fetchAnnouncements();
  }, []);

  return {
    announcements,
    loading,
    error,
    fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    getAnnouncementById,
    toggleAnnouncementStatus,
    getActiveAnnouncements,
    refreshAnnouncements: fetchAnnouncements
  };
};

export default useAnnouncements;