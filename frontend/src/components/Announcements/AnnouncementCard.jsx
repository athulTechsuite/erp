import React, { useState } from 'react';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
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

  const sanitizeContent = (content) => {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
      ALLOWED_ATTR: []
    });
  };

  const validateAnnouncementId = (id) => {
    // Check if id exists and is a valid MongoDB ObjectId format (24 character hex string)
    if (!id || typeof id !== 'string') {
      return false;
    }
    
    // MongoDB ObjectId format validation
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(id);
  };

  const handleDelete = async () => {
    if (!validateAnnouncementId(announcement?._id)) {
      toast({
        title: "Error",
        description: "Invalid announcement ID",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Add version/timestamp check for optimistic locking
      const deletePayload = {
        id: announcement._id,
        version: announcement.version || announcement.updatedAt || announcement.createdAt
      };
      
      await announcementService.deleteAnnouncement(deletePayload);
      toast({
        title: "Success",
        description: "Announcement deleted successfully",
      });
      if (onDelete) {
        onDelete(announcement._id);
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      
      // Handle specific race condition errors
      if (error.response?.status === 409 || error.response?.data?.error?.includes('version')) {
        toast({
          title: "Error",
          description: "This announcement was modified by another user. Please refresh and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.response?.data?.error || "Failed to delete announcement",
          variant: "destructive",
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const sanitizeImagePath = (imagePath) => {
    if (!imagePath || typeof imagePath !== 'string') {
      return null;
    }

    // Remove any potential script injections or harmful characters
    const sanitized = imagePath.replace(/[<>'"]/g, '').trim();
    
    // Prevent directory traversal attacks - be more strict
    if (sanitized.includes('..') || sanitized.includes('\\') || sanitized.includes('//')) {
      console.warn('Potential path traversal attempt blocked:', imagePath);
      return null;
    }

    // Only allow specific safe characters and patterns for file paths
    const allowedPathRegex = /^[a-zA-Z0-9\-_./]+$/;
    if (!allowedPathRegex.test(sanitized)) {
      console.warn('Invalid characters in image path:', imagePath);
      return null;
    }

    // Ensure path doesn't start with potentially dangerous patterns
    if (sanitized.startsWith('/etc/') || sanitized.startsWith('/var/') || 
        sanitized.startsWith('/home/') || sanitized.startsWith('/root/') ||
        sanitized.startsWith('file://') || sanitized.startsWith('data:')) {
      console.warn('Dangerous path pattern blocked:', imagePath);
      return null;
    }

    return sanitized;
  };

  const getImageUrl = (imagePath) => {
    const sanitizedPath = sanitizeImagePath(imagePath);
    if (!sanitizedPath) return null;
    
    // If it's already a full URL, validate it's from allowed domains
    if (sanitizedPath.startsWith('http')) {
      try {
        const url = new URL(sanitizedPath);
        // Only allow same origin or explicitly trusted domains
        const allowedDomains = [window.location.hostname, 'localhost'];
        if (!allowedDomains.includes(url.hostname)) {
          console.warn('Image URL from untrusted domain blocked:', url.hostname);
          return null;
        }
        return sanitizedPath;
      } catch (error) {
        console.warn('Invalid image URL:', sanitizedPath);
        return null;
      }
    }
    
    // For relative paths, ensure they're properly formatted and safe
    const cleanPath = sanitizedPath.startsWith('/') ? sanitizedPath : `/${sanitizedPath}`;
    
    // Construct the full URL using centralized API config with additional validation
    const baseUrl = API_CONFIG.BASE_URL;
    if (!baseUrl || typeof baseUrl !== 'string') {
      console.warn('Invalid API base URL configuration');
      return null;
    }
    
    return `${baseUrl}${cleanPath}`;
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
            <div 
              className="text-gray-700 whitespace-pre-wrap leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeContent(announcement.content) }}
            />
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

AnnouncementCard.propTypes = {
  announcement: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string,
    image: PropTypes.string,
    createdAt: PropTypes.string.isRequired,
    updatedAt: PropTypes.string,
    version: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    createdBy: PropTypes.shape({
      name: PropTypes.string,
      email: PropTypes.string
    })
  }),
  onDelete: PropTypes.func
};

AnnouncementCard.defaultProps = {
  announcement: null,
  onDelete: null
};

export default AnnouncementCard;