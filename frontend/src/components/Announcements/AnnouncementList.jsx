import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Trash2, Edit, Plus, Save, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const AnnouncementList = () => {
  const { user, token } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/announcements', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized access');
        }
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      setAnnouncements(data.announcements || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    try {
      const url = editingId ? `/api/announcements/${editingId}` : '/api/announcements';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized access');
        }
        if (response.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error(editingId ? 'Failed to update announcement' : 'Failed to create announcement');
      }

      setSuccess(editingId ? 'Announcement updated successfully' : 'Announcement created successfully');
      setFormData({ title: '', content: '' });
      setShowCreateForm(false);
      setEditingId(null);
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (announcement) => {
    setFormData({
      title: announcement.title,
      content: announcement.content
    });
    setEditingId(announcement.id);
    setShowCreateForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized access');
        }
        if (response.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error('Failed to delete announcement');
      }

      setSuccess('Announcement deleted successfully');
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setFormData({ title: '', content: '' });
    setShowCreateForm(false);
    setEditingId(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Company Announcements</CardTitle>
          {isAdmin && !showCreateForm && (
            <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
              <Plus size={16} />
              New Announcement
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <AlertDescription className="text-green-700">{success}</AlertDescription>
            </Alert>
          )}

          {isAdmin && showCreateForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-gray-50">
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <Input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter announcement title"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                    Content
                  </label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Enter announcement content"
                    rows={4}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex items-center gap-2">
                    <Save size={16} />
                    {editingId ? 'Update' : 'Create'} Announcement
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel} className="flex items-center gap-2">
                    <X size={16} />
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          )}

          {announcements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No announcements available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{announcement.title}</h3>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(announcement)}
                          className="flex items-center gap-1"
                        >
                          <Edit size={14} />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(announcement.id)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-gray-700 mb-3 whitespace-pre-wrap">{announcement.content}</p>
                  <div className="text-sm text-gray-500">
                    Created: {formatDate(announcement.created_at)}
                    {announcement.updated_at !== announcement.created_at && (
                      <span className="ml-4">
                        Updated: {formatDate(announcement.updated_at)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnnouncementList;