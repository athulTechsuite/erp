import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Trash2, Edit2, Plus, Save, X } from 'lucide-react';

const AnnouncementsManagement = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isPublished: true
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/announcements', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      setAnnouncements(data);
    } catch (err) {
      setError('Failed to load announcements. Please try again.');
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  };

  const validateForm = () => {
    const errors = {};
    
    const sanitizedTitle = sanitizeInput(formData.title);
    const sanitizedContent = sanitizeInput(formData.content);
    
    if (!sanitizedTitle.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!sanitizedContent.trim()) {
      errors.content = 'Content is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId 
        ? `/api/admin/announcements/${editingId}`
        : '/api/admin/announcements';
      
      const method = editingId ? 'PUT' : 'POST';
      
      // Sanitize form data before sending
      const sanitizedFormData = {
        ...formData,
        title: sanitizeInput(formData.title),
        content: sanitizeInput(formData.content)
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sanitizedFormData)
      });

      if (!response.ok) {
        throw new Error('Failed to save announcement');
      }

      const savedAnnouncement = await response.json();
      
      if (editingId) {
        setAnnouncements(prev => 
          prev.map(ann => ann.id === editingId ? savedAnnouncement : ann)
        );
      } else {
        setAnnouncements(prev => [savedAnnouncement, ...prev]);
      }

      resetForm();
      
      // Trigger dashboard widget refresh
      window.dispatchEvent(new CustomEvent('announcementsUpdated'));
      
    } catch (err) {
      setError('Failed to save announcement. Please try again.');
      console.error('Error saving announcement:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (announcement) => {
    setFormData({
      title: announcement.title,
      content: announcement.content,
      isPublished: announcement.isPublished
    });
    setEditingId(announcement.id);
    setShowCreateForm(true);
    setFormErrors({});
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete announcement');
      }

      setAnnouncements(prev => prev.filter(ann => ann.id !== id));
      
      // Trigger dashboard widget refresh
      window.dispatchEvent(new CustomEvent('announcementsUpdated'));
      
    } catch (err) {
      setError('Failed to delete announcement. Please try again.');
      console.error('Error deleting announcement:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      isPublished: true
    });
    setShowCreateForm(false);
    setEditingId(null);
    setFormErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const escapeHtml = (text) => {
    if (typeof text !== 'string') return text;
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-bold">Company Announcements</h2>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Company Announcements</h2>
          {!showCreateForm && (
            <Button 
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2"
            >
              <Plus size={16} />
              Create Announcement
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {showCreateForm && (
          <Card className="mb-6 border-blue-200">
            <CardHeader>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  {editingId ? 'Edit Announcement' : 'Create New Announcement'}
                </h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={resetForm}
                  className="flex items-center gap-2"
                >
                  <X size={16} />
                  Cancel
                </Button>
              </div>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter announcement title"
                    className={formErrors.title ? 'border-red-500' : ''}
                  />
                  {formErrors.title && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Content <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => handleInputChange('content', e.target.value)}
                    placeholder="Enter announcement content"
                    rows={4}
                    className={formErrors.content ? 'border-red-500' : ''}
                  />
                  {formErrors.content && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.content}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPublished"
                    checked={formData.isPublished}
                    onChange={(e) => handleInputChange('isPublished', e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                  <label htmlFor="isPublished" className="text-sm font-medium">
                    Publish immediately
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    disabled={submitting}
                    className="flex items-center gap-2"
                  >
                    <Save size={16} />
                    {submitting ? 'Saving...' : 'Save Announcement'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No announcements created yet.</p>
              <p className="text-sm">Create your first announcement to get started.</p>
            </div>
          ) : (
            announcements.map((announcement) => (
              <Card key={announcement.id} className="border-gray-200">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{escapeHtml(announcement.title)}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          announcement.isPublished 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {announcement.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-2">{escapeHtml(announcement.content)}</p>
                      <p className="text-sm text-gray-500">
                        Created: {formatDate(announcement.createdAt)}
                        {announcement.updatedAt !== announcement.createdAt && (
                          <span> • Updated: {formatDate(announcement.updatedAt)}</span>
                        )}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(announcement)}
                        className="flex items-center gap-1"
                      >
                        <Edit2 size={14} />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(announcement.id)}
                        className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnnouncementsManagement;