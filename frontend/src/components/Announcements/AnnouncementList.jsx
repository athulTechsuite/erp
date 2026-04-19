import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Eye, EyeOff, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { announcementService } from '../../services/announcementService';
import { formatDate } from '../../utils/dateUtils';

const AnnouncementList = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, unread, urgent
  const { user } = useAuth();

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await announcementService.getAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      setError('Failed to load announcements');
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (announcementId) => {
    try {
      await announcementService.markAsRead(announcementId);
      setAnnouncements(announcements.map(announcement =>
        announcement.id === announcementId
          ? { ...announcement, isRead: true }
          : announcement
      ));
    } catch (err) {
      console.error('Error marking announcement as read:', err);
    }
  };

  const markAsUnread = async (announcementId) => {
    try {
      await announcementService.markAsUnread(announcementId);
      setAnnouncements(announcements.map(announcement =>
        announcement.id === announcementId
          ? { ...announcement, isRead: false }
          : announcement
      ));
    } catch (err) {
      console.error('Error marking announcement as unread:', err);
    }
  };

  const deleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      await announcementService.deleteAnnouncement(announcementId);
      setAnnouncements(announcements.filter(announcement => announcement.id !== announcementId));
    } catch (err) {
      console.error('Error deleting announcement:', err);
    }
  };

  const filteredAnnouncements = announcements.filter(announcement => {
    if (filter === 'unread') return !announcement.isRead;
    if (filter === 'urgent') return announcement.priority === 'urgent';
    return true;
  });

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle size={12} className="mr-1" />
            Urgent
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            Priority
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchAnnouncements}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Announcements
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Unread
        </button>
        <button
          onClick={() => setFilter('urgent')}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'urgent'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Urgent
        </button>
      </div>

      {/* Announcements List */}
      {filteredAnnouncements.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {filter === 'all' 
            ? 'No announcements available'
            : `No ${filter} announcements`
          }
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className={`bg-white rounded-lg shadow-sm border transition-shadow hover:shadow-md ${
                !announcement.isRead ? 'border-l-4 border-l-blue-600' : 'border-gray-200'
              }`}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`text-lg font-semibold ${
                        !announcement.isRead ? 'text-gray-900' : 'text-gray-700'
                      }`}>
                        {announcement.title}
                      </h3>
                      {getPriorityBadge(announcement.priority)}
                      {!announcement.isRead && (
                        <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500 gap-4">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>Published {formatDate(announcement.publishedAt)}</span>
                      </div>
                      {announcement.expiresAt && (
                        <span>Expires {formatDate(announcement.expiresAt)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => announcement.isRead ? markAsUnread(announcement.id) : markAsRead(announcement.id)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      title={announcement.isRead ? 'Mark as unread' : 'Mark as read'}
                    >
                      {announcement.isRead ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    
                    {user?.role === 'admin' && (
                      <>
                        <button
                          onClick={() => {/* TODO: Implement edit functionality */}}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Edit announcement"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => deleteAnnouncement(announcement.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete announcement"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div 
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: announcement.content }}
                />

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    By {announcement.author?.name || 'System Admin'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementList;