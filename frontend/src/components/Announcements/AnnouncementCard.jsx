import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { announcementService } from '@/services/announcementService';
import { API_CONFIG } from '@/config/api';

const AnnouncementCard = ({ announcement, onDelete }) => {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isAdmin = user?.role === 'admin';

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDelete = async () => {
    if (!announcement?._id) {
      toast({
        title: "Error",
        description: "Invalid announcement ID",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      await announcementService.deleteAnnouncement(announcement._id);
      toast({
        title: "Success",
        description: "Announcement deleted successfully",
      });
      if (onDelete) {
        onDelete(announcement._id);
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete announcement",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // Construct the full URL for uploaded images using centralized API config
    return `${API_CONFIG.BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
  };

  if (!announcement) {
    return null;
  }

  return (
    <Card className="w-full shadow-sm border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {announcement.title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                Company Announcement
              </Badge>
              <span className="text-sm text-gray-500">
                {formatDate(announcement.createdAt)}
              </span>
            </div>
          </div>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Delete Announcement
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this announcement? This action cannot be undone.
                    The announcement will be removed from all user dashboards immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {announcement.content && (
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {announcement.content}
            </div>
          )}
          
          {announcement.image && !imageError && (
            <div className="mt-4">
              <img
                src={getImageUrl(announcement.image)}
                alt="Announcement"
                className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                style={{ maxHeight: '400px' }}
                onError={handleImageError}
                loading="lazy"
              />
            </div>
          )}

          {imageError && announcement.image && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Unable to load image</span>
              </div>
            </div>
          )}

          {announcement.createdBy && (
            <div className="text-sm text-gray-500 pt-2 border-t border-gray-100">
              Posted by: {announcement.createdBy.name || announcement.createdBy.email}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnnouncementCard;