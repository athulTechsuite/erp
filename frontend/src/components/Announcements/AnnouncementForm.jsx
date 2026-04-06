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
    
    setFormData(prev => ({
      ...prev,
      [name]: value
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
      await onSave({
        ...formData,
        title: formData.title.trim(),
        content: formData.content.trim()
      });
    } catch (error) {
      console.error('Error saving announcement:', error);
      setErrors({ 
        submit: 'Failed to save announcement. Please try again.' 
      });
    }
  };

  const handleCancel = () => {
    setFormData({ title: '', content: '' });
    setErrors({});
    setTouched({});
    onCancel();
  };

  const titleError = errors.title && touched.title;
  const contentError = errors.content && touched.content;
  const hasErrors = Object.keys(errors).some(key => key !== 'submit' && errors[key]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {announcement ? 'Edit Announcement' : 'Create New Announcement'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {errors.submit && (
            <Alert variant="destructive" role="alert" aria-live="polite">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-red-500" aria-label="required">*</span>
            </label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Enter announcement title..."
              className={titleError ? 'border-red-500' : ''}
              maxLength={200}
              required
              aria-invalid={titleError ? 'true' : 'false'}
              aria-describedby={titleError ? 'title-error' : 'title-count'}
              aria-label="Announcement title"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {titleError && (
                  <span 
                    id="title-error" 
                    className="text-red-500" 
                    role="alert"
                    aria-live="polite"
                  >
                    {errors.title}
                  </span>
                )}
              </span>
              <span id="title-count" aria-label={`${formData.title.length} of 200 characters used`}>
                {formData.title.length}/200
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="content" className="text-sm font-medium">
              Content <span className="text-red-500" aria-label="required">*</span>
            </label>
            <Textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Enter announcement content..."
              rows={8}
              className={contentError ? 'border-red-500' : ''}
              maxLength={5000}
              required
              aria-invalid={contentError ? 'true' : 'false'}
              aria-describedby={contentError ? 'content-error' : 'content-count'}
              aria-label="Announcement content"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {contentError && (
                  <span 
                    id="content-error" 
                    className="text-red-500" 
                    role="alert"
                    aria-live="polite"
                  >
                    {errors.content}
                  </span>
                )}
              </span>
              <span id="content-count" aria-label={`${formData.content.length} of 5000 characters used`}>
                {formData.content.length}/5000
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              aria-label="Cancel announcement creation"
            >
              <X className="h-4 w-4 mr-2" aria-hidden="true" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || hasErrors}
              aria-label={isSubmitting ? 'Saving announcement' : announcement ? 'Update announcement' : 'Publish announcement'}
            >
              <Save className="h-4 w-4 mr-2" aria-hidden="true" />
              {isSubmitting ? 'Saving...' : announcement ? 'Update' : 'Publish'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AnnouncementForm;