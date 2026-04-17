import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Spinner } from '../ui/spinner';
import { toast } from '../ui/use-toast';

import { useAuth } from '../../hooks/useAuth';
import AnnouncementForm from './AnnouncementForm';
import './AnnouncementsList.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';
const ANNOUNCEMENTS_ENDPOINT = `${API_BASE_URL}/api/announcements`;

const AnnouncementsList = ({ showCreateButton = true, maxHeight = null }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const { user, token } = useAuth();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch(ANNOUNCEMENTS_ENDPOINT, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      setAnnouncements(data.announcements || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast({
        title: "Error",
        description: "Failed to load announcements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (announcementData) => {
    try {
      const formData = new FormData();
      formData.append('title', announcementData.title);
      formData.append('content', announcementData.content);
      if (announcementData.image) {
        formData.append('image', announcementData.image);
      }

      const response = await fetch(ANNOUNCEMENTS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create announcement');
      }

      toast({
        title: "Success",
        description: "Announcement created successfully",
      });
      setCreateModalVisible(false);
      fetchAnnouncements();
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create announcement",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    try {
      setDeleteLoading(announcementId);
      const response = await fetch(`${ANNOUNCEMENTS_ENDPOINT}/${announcementId}`, {
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

      toast({
        title: "Success",
        description: "Announcement deleted successfully",
      });
      fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete announcement",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(null);
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

  if (loading) {
    return (
      <div className="announcements-loading flex justify-center items-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="announcements-list">
      {showCreateButton && isAdmin && (
        <div className="announcements-header mb-6">
          <Dialog open={createModalVisible} onOpenChange={setCreateModalVisible}>
            <DialogTrigger asChild>
              <Button className="create-announcement-btn">
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Announcement</DialogTitle>
              </DialogHeader>
              <AnnouncementForm
                onSubmit={handleCreateAnnouncement}
                onCancel={() => setCreateModalVisible(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div 
        className="announcements-container"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : {}}
      >
        {announcements.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No announcements available</div>
          </div>
        ) : (
          <div className="announcements-grid grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className="announcement-card">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="announcement-title text-lg font-semibold">
                    {announcement.title}
                  </CardTitle>
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={deleteLoading === announcement.id}
                        >
                          {deleteLoading === announcement.id ? (
                            <Spinner size="sm" />
                          ) : (
                            <TrashIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                            Delete Announcement
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{announcement.title}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteAnnouncement(announcement.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Yes, Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="announcement-content">
                    {announcement.image_url && (
                      <div className="announcement-image mb-4">
                        <img
                          src={announcement.image_url}
                          alt="Announcement"
                          className="w-full max-h-48 object-cover rounded-md"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    <p className="announcement-text text-gray-700 mb-4 leading-relaxed">
                      {announcement.content}
                    </p>

                    <div className="announcement-meta text-sm text-gray-500 space-y-1">
                      <div className="announcement-date">
                        {formatDate(announcement.created_at)}
                      </div>
                      <div className="announcement-author">
                        By: {announcement.created_by_name}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnouncementsList;