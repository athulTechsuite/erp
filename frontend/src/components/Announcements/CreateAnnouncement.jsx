import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { useAuth } from '../../hooks/useAuth';
import { announcementService } from '../../services/announcementService';

const CreateAnnouncement = ({ onAnnouncementCreated }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear messages when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await announcementService.createAnnouncement({
        title: formData.title.trim(),
        content: formData.content.trim()
      });

      // Check if email sending failed but announcement was created
      if (response.emailWarning) {
        setSuccess('Announcement created successfully, but some emails failed to send. Administrators have been notified.');
      } else {
        setSuccess('Announcement created and sent to all employees successfully!');
      }

      // Reset form
      setFormData({
        title: '',
        content: ''
      });

      // Notify parent component to refresh the list
      if (onAnnouncementCreated) {
        onAnnouncementCreated(response.announcement);
      }

    } catch (err) {
      console.error('Error creating announcement:', err);
      setError(
        err.response?.data?.message || 
        'Failed to create announcement. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Only show to admin users
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Create New Announcement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Announcement Title *
            </label>
            <Input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter announcement title..."
              maxLength={200}
              disabled={isLoading}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">
              {formData.title.length}/200 characters
            </div>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              Announcement Content *
            </label>
            <Textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              placeholder="Enter announcement content..."
              rows={6}
              maxLength={2000}
              disabled={isLoading}
              className="w-full resize-vertical"
            />
            <div className="text-xs text-gray-500 mt-1">
              {formData.content.length}/2000 characters
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Note:</span> This announcement will be visible to all users and sent via email to all active employees.
            </div>
            <Button 
              type="submit" 
              disabled={isLoading || !formData.title.trim() || !formData.content.trim()}
              className="min-w-[150px]"
            >
              {isLoading ? 'Creating...' : 'Create Announcement'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateAnnouncement;