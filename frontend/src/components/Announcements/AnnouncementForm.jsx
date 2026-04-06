import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Save, X, AlertCircle } from 'lucide-react';

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

  useEffect(() => {
    if (announcement) {
      setFormData({
        title: announcement.title || '',
        content: announcement.content || ''
      });
    }
  }, [announcement]);

  const sanitizeInput = (input) => {
    if (typeof input !== 'string') {
      return '';
    }
    
    // Remove potentially dangerous characters and patterns
    return input
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove script tags and content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove javascript: and data: URLs
      .replace(/javascript:|data:/gi, '')
      // Remove null bytes
      .replace(/\0/g, '')
      // Limit to printable ASCII and common unicode characters
      .replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g, '')
      // Trim whitespace
      .trim();
  };

  const sanitizeErrorMessage = (message) => {
    if (typeof message !== 'string') {
      return 'An error occurred. Please try again.';
    }
    // Remove HTML tags and escape special characters
    return message.replace(/<[^>]*>/g, '').replace(/[<>&"']/g, (match) => {
      const htmlEntities = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return htmlEntities[match];
    });
  };

  const validateField = (name, value) => {
    const fieldErrors = {};
    
    if (name === 'title') {
      if (!value.trim()) {
        fieldErrors.title = 'Title is required';
      } else if (value.length > 200) {
        fieldErrors.title = 'Title must be less than 200 characters';
      } else if (value.length < 3) {
        fieldErrors.title = 'Title must be at least 3 characters';
      }
    }
    
    if (name === 'content') {
      if (!value.trim()) {
        fieldErrors.content = 'Content is required';
      } else if (value.length > 5000) {
        fieldErrors.content = 'Content must be less than 5000 characters';
      } else if (value.length < 10) {
        fieldErrors.content = 'Content must be at least 10 characters';
      }
    }
    
    return fieldErrors;
  };

  const validateForm = () => {
    const sanitizedData = {
      title: sanitizeInput(formData.title),
      content: sanitizeInput(formData.content)
    };
    
    const titleErrors = validateField('title', sanitizedData.title);
    const contentErrors = validateField('content', sanitizedData.content);
    
    const allErrors = { ...titleErrors, ...contentErrors };
    setErrors(allErrors);
    
    return Object.keys(allErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Sanitize input in real-time
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
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const sanitizedValue = sanitizeInput(value);
    const fieldErrors = validateField(name, sanitizedValue);
    setErrors(prev => ({ ...prev, ...fieldErrors }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setTouched({ title: true, content: true });
    
    // Sanitize form data before validation
    const sanitizedData = {
      title: sanitizeInput(formData.title),
      content: sanitizeInput(formData.content)
    };
    
    // Update form data with sanitized values
    setFormData(sanitizedData);
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSave({
        ...sanitizedData,
        title: sanitizedData.title.trim(),
        content: sanitizedData.content.trim()
      });
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {announcement ? 'Edit Announcement' : 'Create New Announcement'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.submit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Enter announcement title..."
              className={errors.title && touched.title ? 'border-red-500' : ''}
              maxLength={200}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {errors.title && touched.title && (
                  <span className="text-red-500">{errors.title}</span>
                )}
              </span>
              <span>{formData.title.length}/200</span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="content" className="text-sm font-medium">
              Content <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Enter announcement content..."
              rows={8}
              className={errors.content && touched.content ? 'border-red-500' : ''}
              maxLength={5000}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {errors.content && touched.content && (
                  <span className="text-red-500">{errors.content}</span>
                )}
              </span>
              <span>{formData.content.length}/5000</span>
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
              disabled={isSubmitting || Object.keys(errors).length > 0}
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