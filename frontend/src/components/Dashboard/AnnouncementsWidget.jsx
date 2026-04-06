import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, AlertCircle, Megaphone, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const AnnouncementsWidget = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/announcements/published', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      setAnnouncements(data.slice(0, 5)); // Limit to 5 announcements
      setError(null);
    } catch (err) {
      setError('Unable to load company announcements. Please try again later.');
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchAnnouncements, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (err) {
      return 'Invalid date';
    }
  };

  const truncateContent = (content, maxLength = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5" />
            Company Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">Loading announcements...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5" />
            Company Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Megaphone className="h-5 w-5" />
          Company Announcements
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {announcements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No announcements at this time.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-md hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 text-sm leading-tight">
                    {announcement.title}
                  </h4>
                  <div className="flex items-center text-xs text-gray-500 ml-2 flex-shrink-0">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(announcement.created_at)}
                  </div>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {truncateContent(announcement.content)}
                </p>
                {announcement.content.length > 200 && (
                  <button 
                    className="text-blue-600 hover:text-blue-800 text-xs mt-1 font-medium"
                    onClick={() => {
                      // Toggle full content display
                      const updatedAnnouncements = announcements.map(a => 
                        a.id === announcement.id 
                          ? { ...a, showFull: !a.showFull }
                          : a
                      );
                      setAnnouncements(updatedAnnouncements);
                    }}
                  >
                    {announcement.showFull ? 'Show Less' : 'Read More'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnnouncementsWidget;