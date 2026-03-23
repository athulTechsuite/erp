import { useState, useEffect, useCallback } from 'react';
import { announcementsAPI } from '../services/api';
import { useAuth } from './useAuth';
import { useNotification } from './useNotification';

export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // Fetch announcements based on user role
  const fetchAnnouncements = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = user?.isAdmin 
        ? await announcementsAPI.getAll(filters)
        : await announcementsAPI.getPublished(filters);
      
      setAnnouncements(response.data);
    } catch (err) {
      setError(err.message);
      showNotification('Failed to fetch announcements', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.isAdmin, showNotification]);

  // Create new announcement (admin only)
  const createAnnouncement = useCallback(async (announcementData) => {
    if (!user?.isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await announcementsAPI.create(announcementData);
      setAnnouncements(prev => [response.data, ...prev]);
      showNotification('Announcement created successfully', 'success');
      return response.data;
    } catch (err) {
      setError(err.message);
      showNotification('Failed to create announcement', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.isAdmin, showNotification]);

  // Update announcement (admin only)
  const updateAnnouncement = useCallback(async (id, updates) => {
    if (!user?.isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await announcementsAPI.update(id, updates);
      setAnnouncements(prev =>
        prev.map(announcement =>
          announcement.id === id ? response.data : announcement
        )
      );
      showNotification('Announcement updated successfully', 'success');
      return response.data;
    } catch (err) {
      setError(err.message);
      showNotification('Failed to update announcement', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.isAdmin, showNotification]);

  // Delete announcement (admin only)
  const deleteAnnouncement = useCallback(async (id) => {
    if (!user?.isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    setLoading(true);
    setError(null);

    try {
      await announcementsAPI.delete(id);
      setAnnouncements(prev =>
        prev.filter(announcement => announcement.id !== id)
      );
      showNotification('Announcement deleted successfully', 'success');
    } catch (err) {
      setError(err.message);
      showNotification('Failed to delete announcement', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.isAdmin, showNotification]);

  // Mark announcement as read
  const markAsRead = useCallback(async (announcementId) => {
    try {
      await announcementsAPI.markAsRead(announcementId);
      setAnnouncements(prev =>
        prev.map(announcement =>
          announcement.id === announcementId
            ? { ...announcement, isRead: true }
            : announcement
        )
      );
    } catch (err) {
      setError(err.message);
      showNotification('Failed to mark announcement as read', 'error');
    }
  }, [showNotification]);

  // Mark announcement as unread
  const markAsUnread = useCallback(async (announcementId) => {
    try {
      await announcementsAPI.markAsUnread(announcementId);
      setAnnouncements(prev =>
        prev.map(announcement =>
          announcement.id === announcementId
            ? { ...announcement, isRead: false }
            : announcement
        )
      );
    } catch (err) {
      setError(err.message);
      showNotification('Failed to mark announcement as unread', 'error');
    }
  }, [showNotification]);

  // Fetch announcement statistics (admin only)
  const fetchStats = useCallback(async (announcementId) => {
    if (!user?.isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    try {
      const response = await announcementsAPI.getStats(announcementId);
      setStats(response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      showNotification('Failed to fetch announcement statistics', 'error');
      throw err;
    }
  }, [user?.isAdmin, showNotification]);

  // Upload attachment for announcement
  const uploadAttachment = useCallback(async (announcementId, file) => {
    if (!user?.isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await announcementsAPI.uploadAttachment(announcementId, formData);
      showNotification('File uploaded successfully', 'success');
      return response.data;
    } catch (err) {
      setError(err.message);
      showNotification('Failed to upload file', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.isAdmin, showNotification]);

  // Remove attachment from announcement
  const removeAttachment = useCallback(async (announcementId, attachmentId) => {
    if (!user?.isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    try {
      await announcementsAPI.removeAttachment(announcementId, attachmentId);
      showNotification('Attachment removed successfully', 'success');
    } catch (err) {
      setError(err.message);
      showNotification('Failed to remove attachment', 'error');
      throw err;
    }
  }, [user?.isAdmin, showNotification]);

  // Get unread announcements count
  const getUnreadCount = useCallback(() => {
    return announcements.filter(announcement => !announcement.isRead).length;
  }, [announcements]);

  // Get announcements by priority
  const getAnnouncementsByPriority = useCallback((priority) => {
    return announcements.filter(announcement => announcement.priority === priority);
  }, [announcements]);

  // Get urgent announcements
  const getUrgentAnnouncements = useCallback(() => {
    return getAnnouncementsByPriority('urgent');
  }, [getAnnouncementsByPriority]);

  // Initial fetch on mount
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return {
    // Data
    announcements,
    stats,
    loading,
    error,
    
    // Actions
    fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    markAsRead,
    markAsUnread,
    fetchStats,
    uploadAttachment,
    removeAttachment,
    
    // Utilities
    getUnreadCount,
    getAnnouncementsByPriority,
    getUrgentAnnouncements,
    
    // Computed values
    unreadCount: getUnreadCount(),
    urgentAnnouncements: getUrgentAnnouncements(),
    isAdmin: user?.isAdmin || false
  };
};

export default useAnnouncements;