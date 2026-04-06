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