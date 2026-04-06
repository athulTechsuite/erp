import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Save, X, AlertCircle } from 'lucide-react';
import DOMPurify from 'dompurify';

/**
 * XSS Protection and Input Sanitization Implementation:
 * 
 * 1. DOMPurify Configuration:
 *    - Uses strict configuration to prevent XSS attacks
 *    - Sanitizes all user inputs before display and processing
 *    - Removes all HTML tags from text inputs to prevent script injection
 * 
 * 2. Input Validation:
 *    - Validates input length and content
 *    - Sanitizes error messages to prevent reflected XSS
 *    - Uses controlled components to prevent direct DOM manipulation
 * 
 * 3. Output Encoding:
 *    - All dynamic content is properly escaped through React's JSX
 *    - Error messages and user content are sanitized before display
 *    - Character limits prevent buffer overflow attacks
 */

// Configure DOMPurify for maximum security
const sanitizeConfig = {
  ALLOWED_TAGS: [], // No HTML tags allowed in text content
  ALLOWED_ATTR: [], // No attributes allowed
  KEEP_CONTENT: true, // Keep text content, remove tags
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SANITIZE_DOM: true
};

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

  // Sanitize input data to prevent XSS
  const sanitizeInput = (value) => {
    if (typeof value !== 'string') {
      return '';
    }
    return DOMPurify.sanitize(value, sanitizeConfig).trim();
  };

  useEffect(() => {
    if (announcement) {
      setFormData({
        title: sanitizeInput(announcement.title || ''),
        content: sanitizeInput(announcement.content || '')
      });
    }
  }, [announcement]);

  // Sanitize error messages to prevent reflected XSS
  const sanitizeErrorMessage = (message) => {
    if (typeof message !== 'string') {
      return 'An error occurred. Please try again.';
    }
    // Strip all HTML and return plain text only
    return DOMPurify.sanitize(message, sanitizeConfig);
  };

  const validateField = (name, value) => {
    const fieldErrors = {};
    
    // Sanitize value before validation
    const sanitizedValue = sanitizeInput(value);
    
    if (name === 'title') {
      if (!sanitizedValue) {
        fieldErrors.title = 'Title is required';
      } else if (sanitizedValue.length > 200) {
        fieldErrors.title = 'Title must be less than 200 characters';
      } else if (/[<>'"&]/.test(sanitizedValue)) {
        fieldErrors.title = 'Title contains invalid characters';
      }
    }
    
    if (name === 'content') {
      if (!sanitizedValue) {
        fieldErrors.content = 'Content is required';
      } else if (sanitizedValue.length > 5000) {
        fieldErrors.content = 'Content must be less than 5000 characters';
      } else if (/[<>'"&]/.test(sanitizedValue)) {
        fieldErrors.content = 'Content contains invalid characters';
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
    
    // Sanitize input immediately to prevent XSS
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

    try {
      // Double sanitization before submission to ensure security
      const sanitizedData = {
        title: sanitizeInput(formData.title),
        content: sanitizeInput(formData.content)
      };

      // Validate sanitized data is not empty
      if (!sanitizedData.title || !sanitizedData.content) {
        setErrors({ 
          submit: 'Invalid input detected. Please check your entries and try again.'
        });
        return;
      }

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
              autoComplete="off"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {errors.title && touched.title && (
                  <span className="text-red-500">{sanitizeErrorMessage(errors.title)}</span>
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
              autoComplete="off"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {errors.content && touched.content && (
                  <span className="text-red-500">{sanitizeErrorMessage(errors.content)}</span>
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