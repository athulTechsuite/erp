import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Save, X, AlertCircle } from 'lucide-react';
import DOMPurify from 'dompurify';

const AnnouncementForm = ({ 
  announcement = null, 
  onSave, 
  onCancel, 
  isSubmitting = false 
}) => {
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Sanitize announcement data when it changes
  const sanitizedAnnouncement = useMemo(() => {
    if (!announcement) return null;
    return {
      title: DOMPurify.sanitize(announcement.title || '', { ALLOWED_TAGS: [] }),
      content: DOMPurify.sanitize(announcement.content || '', { ALLOWED_TAGS: [] })
    };
  }, [announcement]);

  useEffect(() => {
    if (sanitizedAnnouncement) {
      setFormData({
        title: sanitizedAnnouncement.title,
        content: sanitizedAnnouncement.content
      });
    }
  }, [sanitizedAnnouncement]);

  const sanitizeErrorMessage = (message) => {
    if (typeof message !== 'string') {
      return 'An error occurred. Please try again.';
    }
    // Use DOMPurify to sanitize error messages, allowing no HTML tags
    return DOMPurify.sanitize(message, { ALLOWED_TAGS: [] });
  };

  const sanitizeInput = (value) => {
    if (typeof value !== 'string') {
      return '';
    }
    // Sanitize user input, removing all HTML tags for form fields
    return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });
  };

  const validateField = (name, value) => {
    const fieldErrors = {};
    const sanitizedValue = sanitizeInput(value);
    
    if (name === 'title') {
      if (!sanitizedValue.trim()) {
        fieldErrors.title = 'Title is required';
      } else if (sanitizedValue.length > 200) {
        fieldErrors.title = 'Title must be less than 200 characters';
      }
    }
    
    if (name === 'content') {
      if (!sanitizedValue.trim()) {
        fieldErrors.content = 'Content is required';
      } else if (sanitizedValue.length > 5000) {
        fieldErrors.content = 'Content must be less than 5000 characters';
      }
    }
    
    return fieldErrors;
  };

  const validateForm = () => {
    const titleErrors = validateField('title', formData.title);
    const contentErrors = validateField('content', formData.content);
    
    const allErrors = { ...titleErrors, ...contentErrors };
    setErrors(allErrors);
    
    return Object.keys(allErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const sanitizedValue = sanitizeInput(value);
    
    setFormData(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));

    // Clear errors for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const sanitizedValue = sanitizeInput(value);
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const fieldErrors = validateField(name, sanitizedValue);
    setErrors(prev => ({ ...prev, ...fieldErrors }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setTouched({ title: true, content: true });
    
    if (!validateForm()) {
      return;
    }

    try {
      // Double sanitization: once on input, once before submission
      const sanitizedData = {
        title: DOMPurify.sanitize(formData.title.trim(), { ALLOWED_TAGS: [] }),
        content: DOMPurify.sanitize(formData.content.trim(), { ALLOWED_TAGS: [] })
      };
      
      await onSave(sanitizedData);
    } catch (error) {
      console.error('Error saving announcement:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to save announcement. Please try again.';
      setErrors({ 
        submit: sanitizeErrorMessage(errorMessage)
      });
    }
  };

  const handleCancel = () => {
    setFormData({ title: '', content: '' });
    setErrors({});
    setTouched({});
    onCancel();
  };

  // Sanitize display values
  const sanitizedFormData = useMemo(() => ({
    title: sanitizeInput(formData.title),
    content: sanitizeInput(formData.content)
  }), [formData.title, formData.content]);

  const sanitizedErrors = useMemo(() => {
    const sanitized = {};
    Object.keys(errors).forEach(key => {
      if (errors[key]) {
        sanitized[key] = sanitizeErrorMessage(errors[key]);
      }
    });
    return sanitized;
  }, [errors]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {announcement ? 'Edit Announcement' : 'Create New Announcement'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {sanitizedErrors.submit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{sanitizedErrors.submit}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              id="title"
              name="title"
              value={sanitizedFormData.title}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Enter announcement title..."
              className={sanitizedErrors.title && touched.title ? 'border-red-500' : ''}
              maxLength={200}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {sanitizedErrors.title && touched.title && (
                  <span className="text-red-500">{sanitizedErrors.title}</span>
                )}
              </span>
              <span>{sanitizedFormData.title.length}/200</span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="content" className="text-sm font-medium">
              Content <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="content"
              name="content"
              value={sanitizedFormData.content}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Enter announcement content..."
              rows={8}
              className={sanitizedErrors.content && touched.content ? 'border-red-500' : ''}
              maxLength={5000}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {sanitizedErrors.content && touched.content && (
                  <span className="text-red-500">{sanitizedErrors.content}</span>
                )}
              </span>
              <span>{sanitizedFormData.content.length}/5000</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || Object.keys(sanitizedErrors).length > 0}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Saving...' : announcement ? 'Update' : 'Publish'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AnnouncementForm;