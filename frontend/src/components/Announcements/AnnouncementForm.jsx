import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Save, X, AlertCircle, Loader2 } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(false);

  // Sanitize input function
  const sanitizeInput = (input) => {
    return DOMPurify.sanitize(input, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
  };

  useEffect(() => {
    if (announcement) {
      setFormData({
        title: sanitizeInput(announcement.title || ''),
        content: sanitizeInput(announcement.content || '')
      });
    }
  }, [announcement]);

  const validateField = (name, value) => {
    const fieldErrors = {};
    
    if (name === 'title') {
      if (!value.trim()) {
        fieldErrors.title = 'Title is required';
      } else if (value.length > 200) {
        fieldErrors.title = 'Title must be less than 200 characters';
      }
    }
    
    if (name === 'content') {
      if (!value.trim()) {
        fieldErrors.content = 'Content is required';
      } else if (value.length > 5000) {
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
    
    // Sanitize input value
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
    
    const fieldErrors = validateField(name, value);
    setErrors(prev => ({ ...prev, ...fieldErrors }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setTouched({ title: true, content: true });
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, submit: undefined }));

    try {
      // Sanitize data before saving
      const sanitizedData = {
        title: sanitizeInput(formData.title.trim()),
        content: sanitizeInput(formData.content.trim())
      };

      await onSave(sanitizedData);
    } catch (error) {
      console.error('Error saving announcement:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to save announcement. Please try again.';
      
      if (error.response?.status === 400) {
        errorMessage = 'Invalid data provided. Please check your input and try again.';
      } else if (error.response?.status === 401) {
        errorMessage = 'You are not authorized to perform this action. Please log in and try again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to save announcements.';
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error occurred. Please try again later.';
      } else if (error.name === 'NetworkError' || !error.response) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      setErrors({ 
        submit: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (isLoading || isSubmitting) {
      return; // Prevent cancellation during loading
    }
    
    setFormData({ title: '', content: '' });
    setErrors({});
    setTouched({});
    onCancel();
  };

  const isFormDisabled = isSubmitting || isLoading;
  const hasValidationErrors = Object.keys(errors).filter(key => key !== 'submit').length > 0;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
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

          {isLoading && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Saving announcement...</AlertDescription>
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
              disabled={isFormDisabled}
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
              disabled={isFormDisabled}
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
              disabled={isFormDisabled}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isFormDisabled || hasValidationErrors}
            >
              {isLoading || isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isLoading || isSubmitting ? 'Saving...' : announcement ? 'Update' : 'Publish'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AnnouncementForm;