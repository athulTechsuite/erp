import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Alert } from '../ui/Alert';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { 
  PlusIcon, 
  TrashIcon, 
  SpeakerphoneIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

const AnnouncementsWidget = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal'
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
    
    // Set up polling for new announcements
    const interval = setInterval(fetchAnnouncements, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch('/api/announcements', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      
      // Check for new announcements and show notifications
      if (announcements.length > 0) {
        const newAnnouncements = data.filter(announcement => 
          !announcements.some(existing => existing.id === announcement.id)
        );
        
        newAnnouncements.forEach(announcement => {
          showNotification({
            type: 'info',
            title: 'New Company Announcement',
            message: announcement.title,
            duration: 5000
          });
        });
      }
      
      setAnnouncements(data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load announcements');
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      errors.title = 'Title must be less than 100 characters';
    }
    
    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    } else if (formData.content.length > 1000) {
      errors.content = 'Content must be less than 1000 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create announcement');
      }

      const newAnnouncement = await response.json();
      setAnnouncements(prev => [newAnnouncement, ...prev]);
      setFormData({ title: '', content: '', priority: 'normal' });
      setShowCreateForm(false);
      setFormErrors({});
      
      showNotification({
        type: 'success',
        title: 'Success',
        message: 'Announcement created successfully'
      });
      
    } catch (err) {
      showNotification({
        type: 'error',
        title: 'Error',
        message: err.message || 'Failed to create announcement'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      const response = await fetch(`/api/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete announcement');
      }

      setAnnouncements(prev => prev.filter(ann => ann.id !== announcementId));
      
      showNotification({
        type: 'success',
        title: 'Success',
        message: 'Announcement deleted successfully'
      });
      
    } catch (err) {
      showNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete announcement'
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      case 'important':
        return <SpeakerphoneIcon className="h-4 w-4 text-yellow-500" />;
      default:
        return <SpeakerphoneIcon className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500';
      case 'important':
        return 'border-l-yellow-500';
      default:
        return 'border-l-blue-500';
    }
  };

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SpeakerphoneIcon className="h-5 w-5" />
            Company Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading announcements...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <SpeakerphoneIcon className="h-5 w-5" />
            Company Announcements
          </CardTitle>
          {isAdmin && (
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <PlusIcon className="h-4 w-4" />
              New Announcement
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert type="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Create Announcement Form */}
        {isAdmin && showCreateForm && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-medium mb-4">Create New Announcement</h3>
            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <Input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter announcement title"
                  className={formErrors.title ? 'border-red-500' : ''}
                />
                {formErrors.title && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.title}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content *
                </label>
                <Textarea
                  name="content"
                  value={formData.content}
                  onChange={handleInputChange}
                  placeholder="Enter announcement content"
                  rows={4}
                  className={formErrors.content ? 'border-red-500' : ''}
                />
                {formErrors.content && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.content}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({ title: '', content: '', priority: 'normal' });
                    setFormErrors({});
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Announcement'
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Announcements List */}
        {announcements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <SpeakerphoneIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No announcements at this time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className={`border-l-4 ${getPriorityColor(announcement.priority)} bg-white p-4 rounded-r-lg shadow-sm`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getPriorityIcon(announcement.priority)}
                      <h4 className="font-semibold text-gray-900">
                        {announcement.title}
                      </h4>
                    </div>
                    <p className="text-gray-700 mb-3 whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>
                        By {announcement.author?.name || 'Administrator'} • {' '}
                        {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <Button
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-4"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!isAdmin && (
          <div className="mt-4 text-xs text-gray-500 text-center">
            Only administrators can create and manage announcements
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnnouncementsWidget;