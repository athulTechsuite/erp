import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  CheckCircle,
  X,
  Save
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { announcementService } from '../../services/announcementService';

const AnnouncementWidget = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    expirationDate: ''
  });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await announcementService.getAll();
      setAnnouncements(data.slice(0, 5)); // Show only 5 most recent in widget
    } catch (err) {
      setError('Failed to load announcements');
      console.error('Error fetching announcements:', err);
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
      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        expirationDate: formData.expirationDate || null
      };

      if (editingId) {
        await announcementService.update(editingId, payload);
        setSuccess('Announcement updated successfully');
      } else {
        await announcementService.create(payload);
        setSuccess('Announcement created successfully');
      }

      resetForm();
      fetchAnnouncements();
    } catch (err) {
      setError(editingId ? 'Failed to update announcement' : 'Failed to create announcement');
      console.error('Error saving announcement:', err);
    }
  };

  const handleEdit = (announcement) => {
    setEditingId(announcement.id);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      expirationDate: announcement.expirationDate ? 
        new Date(announcement.expirationDate).toISOString().split('T')[0] : ''
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      await announcementService.delete(id);
      setSuccess('Announcement deleted successfully');
      fetchAnnouncements();
    } catch (err) {
      setError('Failed to delete announcement');
      console.error('Error deleting announcement:', err);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', content: '', expirationDate: '' });
    setShowCreateForm(false);
    setEditingId(null);
    setError('');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isExpiringSoon = (expirationDate) => {
    if (!expirationDate) return false;
    const expiry = new Date(expirationDate);
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    return expiry <= threeDaysFromNow;
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Company Announcements</CardTitle>
        {isAdmin && (
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            size="sm"
            variant={showCreateForm ? "outline" : "default"}
            className="flex items-center gap-1"
          >
            {showCreateForm ? (
              <>
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Cancel</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add</span>
              </>
            )}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Alert Messages */}
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              {error}
              <Button variant="ghost" size="sm" onClick={clearMessages}>
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="py-2 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="flex items-center justify-between text-green-700">
              {success}
              <Button variant="ghost" size="sm" onClick={clearMessages}>
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Create/Edit Form */}
        {isAdmin && showCreateForm && (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
            <h3 className="font-medium">
              {editingId ? 'Edit Announcement' : 'Create New Announcement'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                placeholder="Announcement title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full"
                maxLength={100}
              />
              
              <Textarea
                placeholder="Announcement content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full min-h-[80px] resize-none"
                maxLength={500}
              />
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="date"
                  placeholder="Expiration date (optional)"
                  value={formData.expirationDate}
                  onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1"
                />
                
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="flex items-center gap-1">
                    <Save className="h-4 w-4" />
                    {editingId ? 'Update' : 'Create'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Announcements List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Loading announcements...</span>
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No announcements yet</p>
              {isAdmin && (
                <p className="text-xs mt-1">Click "Add" to create your first announcement</p>
              )}
            </div>
          ) : (
            announcements.map((announcement) => (
              <div 
                key={announcement.id} 
                className="border rounded-lg p-3 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-medium text-sm leading-tight flex-1">
                    {announcement.title}
                  </h4>
                  
                  {isAdmin && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(announcement)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(announcement.id)}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                  {announcement.content}
                </p>
                
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Calendar className="h-3 w-3" />
                    {formatDate(announcement.createdAt)}
                  </div>
                  
                  {announcement.expirationDate && (
                    <Badge 
                      variant={isExpiringSoon(announcement.expirationDate) ? "destructive" : "secondary"}
                      className="text-xs px-1 py-0"
                    >
                      Expires {formatDate(announcement.expirationDate)}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* View All Link */}
        {announcements.length > 0 && (
          <div className="text-center pt-2 border-t">
            <Button 
              variant="link" 
              size="sm" 
              onClick={() => window.location.href = '/announcements'}
              className="text-xs"
            >
              View all announcements
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnnouncementWidget;