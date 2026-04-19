import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: ''
  });
  const [errors, setErrors] = useState({});

  const { user, getToken } = useAuth();
  const navigate = useNavigate();

  // Check if user is admin
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/dashboard');
      toast.error('Access denied. Admin privileges required.');
    }
  }, [user, navigate]);

  // Fetch announcements on component mount
  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchAnnouncements();
    }
  }, [user]);

  const fetchAnnouncements = async () => {
    try {
      const token = getToken();
      const response = await fetch('/api/announcements', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      setAnnouncements(data);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!newAnnouncement.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (newAnnouncement.title.trim().length > 255) {
      newErrors.title = 'Title must be less than 255 characters';
    }

    if (!newAnnouncement.content.trim()) {
      newErrors.content = 'Content is required';
    } else if (newAnnouncement.content.trim().length > 5000) {
      newErrors.content = 'Content must be less than 5000 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsCreating(true);
    
    try {
      const token = getToken();
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newAnnouncement.title.trim(),
          content: newAnnouncement.content.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create announcement');
      }

      const createdAnnouncement = await response.json();
      
      // Add new announcement to the list
      setAnnouncements(prev => [createdAnnouncement, ...prev]);
      
      // Reset form
      setNewAnnouncement({ title: '', content: '' });
      setErrors({});
      
      toast.success('Announcement created successfully');

      // Check if there were any email delivery issues
      if (createdAnnouncement.emailErrors && createdAnnouncement.emailErrors.length > 0) {
        toast.warning('Announcement created but some emails failed to send. Check system logs.');
      }

    } catch (error) {
      console.error('Error creating announcement:', error);
      toast.error(error.message || 'Failed to create announcement');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
      return;
    }

    try {
      const token = getToken();
      const response = await fetch(`/api/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete announcement');
      }

      // Remove announcement from the list
      setAnnouncements(prev => prev.filter(ann => ann.id !== announcementId));
      toast.success('Announcement deleted successfully');

    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error(error.message || 'Failed to delete announcement');
    }
  };

  const handleInputChange = (field, value) => {
    setNewAnnouncement(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="announcements-page">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Company Announcements Management
          </h1>
          <p className="text-gray-600">
            Create and manage company-wide announcements that will be displayed on all user dashboards and sent via email.
          </p>
        </div>

        {/* Create Announcement Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Create New Announcement
          </h2>
          
          <form onSubmit={handleCreateAnnouncement}>
            <div className="mb-4">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                id="title"
                value={newAnnouncement.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 ${
                  errors.title 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Enter announcement title..."
                maxLength={255}
                disabled={isCreating}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            <div className="mb-6">
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                Content *
              </label>
              <textarea
                id="content"
                rows={6}
                value={newAnnouncement.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 ${
                  errors.content 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Enter announcement content..."
                maxLength={5000}
                disabled={isCreating}
              />
              {errors.content && (
                <p className="mt-1 text-sm text-red-600">{errors.content}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                {newAnnouncement.content.length}/5000 characters
              </p>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create Announcement'}
            </button>
          </form>
        </div>

        {/* Announcements List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Existing Announcements ({announcements.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {isLoading ? (
              <div className="px-6 py-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading announcements...</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <p>No announcements found. Create your first announcement above.</p>
              </div>
            ) : (
              announcements.map((announcement) => (
                <div key={announcement.id} className="px-6 py-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {announcement.title}
                      </h3>
                      <p className="text-gray-700 mb-3 whitespace-pre-wrap">
                        {announcement.content}
                      </p>
                      <div className="flex items-center text-sm text-gray-500">
                        <span>Created on {formatDate(announcement.created_at)}</span>
                        <span className="mx-2">•</span>
                        <span>by {announcement.created_by_name || 'System'}</span>
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <button
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementsPage;