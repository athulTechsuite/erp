import { useState, useEffect } from 'react';
import axios from 'axios';

const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/announcements');
      
      // Sort announcements by creation date (newest first) and limit to 5
      const sortedAnnouncements = response.data
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
      
      setAnnouncements(sortedAnnouncements);
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError('Failed to load company announcements');
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  const createAnnouncement = async (announcementData) => {
    try {
      const response = await axios.post('/api/announcements', announcementData);
      
      // Add new announcement to the beginning of the list and maintain limit of 5
      setAnnouncements(prevAnnouncements => {
        const updatedAnnouncements = [response.data, ...prevAnnouncements];
        return updatedAnnouncements
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5);
      });
      
      return response.data;
    } catch (err) {
      console.error('Error creating announcement:', err);
      throw err;
    }
  };

  const updateAnnouncement = async (id, announcementData) => {
    try {
      const response = await axios.put(`/api/announcements/${id}`, announcementData);
      
      setAnnouncements(prevAnnouncements => {
        const updated = prevAnnouncements.map(announcement =>
          announcement.id === id ? response.data : announcement
        );
        return updated
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5);
      });
      
      return response.data;
    } catch (err) {
      console.error('Error updating announcement:', err);
      throw err;
    }
  };

  const deleteAnnouncement = async (id) => {
    try {
      await axios.delete(`/api/announcements/${id}`);
      
      setAnnouncements(prevAnnouncements =>
        prevAnnouncements.filter(announcement => announcement.id !== id)
      );
      
      // Fetch fresh data to fill the gap if we had exactly 5 announcements
      if (announcements.length === 5) {
        fetchAnnouncements();
      }
    } catch (err) {
      console.error('Error deleting announcement:', err);
      throw err;
    }
  };

  // Auto-refresh announcements every 5 minutes
  useEffect(() => {
    fetchAnnouncements();
    
    const intervalId = setInterval(() => {
      fetchAnnouncements();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(intervalId);
  }, []);

  // Manual refresh function for immediate updates
  const refreshAnnouncements = () => {
    fetchAnnouncements();
  };

  return {
    announcements,
    loading,
    error,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    refreshAnnouncements
  };
};

export default useAnnouncements;