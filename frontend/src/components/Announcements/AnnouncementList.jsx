import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import AnnouncementForm from './AnnouncementForm';
import { toast } from 'react-hot-toast';
import { announcementService } from '../../services/announcementService';

const AnnouncementList = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const data = await announcementService.getAll();
      setAnnouncements(data);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAnnouncement(null);
    setShowForm(true);
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      await announcementService.delete(id);
      setAnnouncements(announcements.filter(a => a.id !== id));
      toast.success('Announcement deleted successfully');
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      let savedAnnouncement;
      
      if (editingAnnouncement) {
        savedAnnouncement = await announcementService.update(editingAnnouncement.id, formData);
        setAnnouncements(announcements.map(a => 
          a.id === editingAnnouncement.id ? savedAnnouncement : a
        ));
        toast.success('Announcement updated successfully');
      } else {
        savedAnnouncement = await announcementService.create(formData);
        setAnnouncements([savedAnnouncement, ...announcements]);
        toast.success('Announcement created successfully');
      }
      
      setShowForm(false);
      setEditingAnnouncement(null);
    } catch (error) {
      console.error('Error saving announcement:', error);
      toast.error('Failed to save announcement');
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingAnnouncement(null);
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-24 bg-gray-200 rounded mb-4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button for Admins */}
      {isAdmin && (
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Company Announcements</h2>
          <Button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Announcement
          </Button>
        </div>
      )}

      {/* Announcement Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <AnnouncementForm
              announcement={editingAnnouncement}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
            />
          </div>
        </div>
      )}

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500 text-lg">No announcements at this time.</p>
            {isAdmin && (
              <p className="text-gray-400 mt-2">
                Click "Add Announcement" to create the first announcement.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id} className="shadow-md">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {announcement.title}
                    </h3>
                    <div className="text-sm text-gray-500">
                      <span>By {announcement.author_name || 'Administrator'}</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(announcement.created_at)}</span>
                      {announcement.updated_at !== announcement.created_at && (
                        <>
                          <span className="mx-2">•</span>
                          <span className="italic">Updated {formatDate(announcement.updated_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Admin Actions */}
                  {isAdmin && (
                    <div className="flex space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(announcement)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(announcement.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {announcement.content}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementList;