import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Trash2, Edit, Calendar, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import announcementService from '../../services/announcementService';
import DOMPurify from 'dompurify';

// Error Boundary Component
class AnnouncementErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AnnouncementList Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Something went wrong while loading announcements. Please refresh the page or try again later.
            <button 
              onClick={() => window.location.reload()} 
              className="ml-2 underline hover:no-underline"
            >
              Refresh page
            </button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

const LoadingSpinner = ({ className = "" }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
    <span className="ml-2 text-gray-500">Loading announcements...</span>
  </div>
);

const AnnouncementListContent = ({ showActions = false, maxItems = null }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await announcementService.getAllAnnouncements();
      const sortedAnnouncements = data.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      setAnnouncements(maxItems ? sortedAnnouncements.slice(0, maxItems) : sortedAnnouncements);
    } catch (err) {
      setError('Failed to load announcements');
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      setDeleting(id);
      await announcementService.deleteAnnouncement(id);
      setAnnouncements(announcements.filter(announcement => announcement.id !== id));
    } catch (err) {
      setError('Failed to delete announcement');
      console.error('Error deleting announcement:', err);
    } finally {
      setDeleting(null);
    }
  };

  const handleRetry = () => {
    fetchAnnouncements();
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

  const renderSafeContent = (content) => {
    // Sanitize content and strip HTML tags to ensure safe plain text rendering
    const textContent = DOMPurify.sanitize(content, { 
      ALLOWED_TAGS: [], 
      KEEP_CONTENT: true 
    });
    
    // Split by line breaks and render as paragraphs
    return textContent.split('\n').map((line, index) => (
      line.trim() ? (
        <p key={index} className="mb-2 last:mb-0">
          {line.trim()}
        </p>
      ) : (
        <br key={index} />
      )
    ));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSpinner className="py-8" />
        {[...Array(3)].map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <button 
            onClick={handleRetry}
            className="ml-4 px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors text-sm"
            disabled={loading}
          >
            {loading ? 'Retrying...' : 'Retry'}
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  if (announcements.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">No announcements available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {announcements.map((announcement) => (
        <Card key={announcement.id} className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {announcement.title}
                </h3>
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span>Published {formatDate(announcement.createdAt)}</span>
                  {announcement.author && (
                    <span className="ml-2">by {announcement.author.name}</span>
                  )}
                </div>
              </div>
              {showActions && (
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => window.location.href = `/admin/announcements/edit/${announcement.id}`}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit announcement"
                    disabled={deleting === announcement.id}
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(announcement.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete announcement"
                    disabled={deleting === announcement.id}
                  >
                    {deleting === announcement.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="prose prose-sm max-w-none">
              <div className="text-gray-700 leading-relaxed">
                {renderSafeContent(announcement.content)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const AnnouncementList = (props) => {
  return (
    <AnnouncementErrorBoundary>
      <AnnouncementListContent {...props} />
    </AnnouncementErrorBoundary>
  );
};

export default AnnouncementList;