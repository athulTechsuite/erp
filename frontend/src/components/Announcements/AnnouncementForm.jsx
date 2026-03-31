import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { useAuth } from '../../contexts/AuthContext';
import { announcementService } from '../../services/announcementService';

const AnnouncementForm = ({ onSuccess, onCancel }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal'
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters long';
    } else if (formData.title.trim().length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    } else if (formData.content.trim().length < 10) {
      newErrors.content = 'Content must be at least 10 characters long';
    } else if (formData.content.trim().length > 5000) {
      newErrors.content = 'Content must be less than 5000 characters';
    }

    if (!['low', 'normal', 'high', 'urgent'].includes(formData.priority)) {
      newErrors.priority = 'Invalid priority level';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isAdmin) {
      setSubmitError('Access denied. Only administrators can create announcements.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setSubmitError('');

    try {
      const announcementData = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        priority: formData.priority
      };

      await announcementService.createAnnouncement(announcementData);
      
      // Reset form
      setFormData({
        title: '',
        content: '',
        priority: 'normal'
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating announcement:', error);
      if (error.response?.status === 403) {
        setSubmitError('Access denied. You do not have permission to create announcements.');
      } else if (error.response?.status === 400) {
        const validationErrors = error.response.data.errors || {};
        setErrors(validationErrors);
        setSubmitError('Please fix the validation errors above.');
      } else {
        setSubmitError('Failed to create announcement. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleCancel = () => {
    setFormData({
      title: '',
      content: '',
      priority: 'normal'
    });
    setErrors({});
    setSubmitError('');
    
    if (onCancel) {
      onCancel();
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertDescription>
              Access denied. Only administrators can create company announcements.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Company Announcement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Field */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter announcement title"
              className={errors.title ? 'border-red-500' : ''}
              disabled={loading}
              maxLength={200}
            />
            {errors.title && (
              <p className="text-sm text-red-600 mt-1">{errors.title}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {formData.title.length}/200 characters
            </p>
          </div>

          {/* Content Field */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Content *
            </label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="Enter announcement content"
              rows={6}
              className={errors.content ? 'border-red-500' : ''}
              disabled={loading}
              maxLength={5000}
            />
            {errors.content && (
              <p className="text-sm text-red-600 mt-1">{errors.content}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {formData.content.length}/5000 characters
            </p>
          </div>

          {/* Priority Field */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => handleInputChange('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={loading}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            {errors.priority && (
              <p className="text-sm text-red-600 mt-1">{errors.priority}</p>
            )}
          </div>

          {/* Submit Error */}
          {submitError && (
            <Alert>
              <AlertDescription className="text-red-600">
                {submitError}
              </AlertDescription>
            </Alert>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? 'Creating...' : 'Create Announcement'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AnnouncementForm;