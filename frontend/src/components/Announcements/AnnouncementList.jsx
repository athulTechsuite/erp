import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import AnnouncementForm from './AnnouncementForm';

const AnnouncementList = ({ isDashboardWidget = false, maxItems = null }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleting, setDeleting] = useState(null);
  
  const { user, token } = useAuth();
  const { addNotification } = useNotifications();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/announcements', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      let announcementsData = data.announcements || [];
      
      // Limit items for dashboard widget
      if (isDashboardWidget && maxItems) {
        announcementsData = announcementsData.slice(0, maxItems);
      }
      
      setAnnouncements(announcementsData);
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (announcementData) => {
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(announcementData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create announcement');
      }

      const data = await response.json();
      
      // Add new announcement to the beginning of the list
      setAnnouncements(prev => [data.announcement, ...prev]);
      setShowCreateForm(false);
      
      addNotification({
        type: 'success',
        message: 'Announcement created successfully',
      });

      return { success: true };
    } catch (err) {
      console.error('Error creating announcement:', err);
      addNotification({
        type: 'error',
        message: err.message || 'Failed to create announcement',
      });
      return { success: false, error: err.message };
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(announcementId);
      
      const response = await fetch(`/api/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete announcement');
      }

      // Remove announcement from list
      setAnnouncements(prev => prev.filter(ann => ann.id !== announcementId));
      
      addNotification({
        type: 'success',
        message: 'Announcement deleted successfully',
      });
    } catch (err) {
      console.error('Error deleting announcement:', err);
      addNotification({
        type: 'error',
        message: err.message || 'Failed to delete announcement',
      });
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card className={isDashboardWidget ? 'h-full' : ''}>
        <CardHeader>
          <h3 className="text-lg font-semibold">Company Announcements</h3>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={isDashboardWidget ? 'h-full' : ''}>
        <CardHeader>
          <h3 className="text-lg font-semibold">Company Announcements</h3>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
          <div className="text-center mt-4">
            <Button onClick={fetchAnnouncements} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isDashboardWidget ? 'h-full' : ''}>
      <CardHeader className="flex flex-row items-center justify-between">
        <h3 className="text-lg font-semibold">Company Announcements</h3>
        {isAdmin && !isDashboardWidget && (
          <Button
            onClick={() => setShowCreateForm(true)}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        )}
      </CardHeader>
      
      <CardContent className={isDashboardWidget ? 'flex-1 overflow-y-auto' : ''}>
        {showCreateForm && (
          <div className="mb-6">
            <AnnouncementForm
              onSubmit={handleCreateAnnouncement}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}

        {announcements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No announcements yet</p>
            {isAdmin && (
              <p className="text-sm mt-2">Create your first announcement to get started</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      {announcement.title}
                    </h4>
                    <p className="text-gray-700 mb-3 whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>By {announcement.created_by_name || 'Unknown'}</span>
                      <span>•</span>
                      <span>{formatDate(announcement.created_at)}</span>
                    </div>
                  </div>
                  
                  {isAdmin && !isDashboardWidget && (
                    <div className="ml-4">
                      <Button
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={deleting === announcement.id}
                      >
                        {deleting === announcement.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isDashboardWidget && announcements.length >= (maxItems || 5) && (
              <div className="text-center pt-4 border-t">
                <Button
                  onClick={() => window.location.href = '/announcements'}
                  variant="outline"
                  size="sm"
                >
                  View All Announcements
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnnouncementList;