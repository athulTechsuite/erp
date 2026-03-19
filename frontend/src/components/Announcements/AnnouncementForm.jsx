import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Calendar, Save, X, AlertCircle } from 'lucide-react';

const AnnouncementForm = ({ 
  announcement = null, 
  onSubmit, 
  onCancel, 
  loading = false,
  error = null 
}) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    expirationDate: ''
  });
  
  const [validationErrors, setValidationErrors] = useState({});

  // Populate form when editing existing announcement
  useEffect(() => {
    if (announcement) {
      setFormData({
        title: announcement.title || '',
        content: announcement.content || '',
        expirationDate: announcement.expirationDate 
          ? new Date(announcement.expirationDate).toISOString().split('T')[0]
          : ''
      });
    }
  }, [announcement]);

  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      errors.title = 'Title must be 200 characters or less';
    }
    
    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    } else if (formData.content.length > 5000) {
      errors.content = 'Content must be 5000 characters or less';
    }
    
    if (formData.expirationDate) {
      const expirationDate = new Date(formData.expirationDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (expirationDate < today) {
        errors.expirationDate = 'Expiration date cannot be in the past';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const submitData = {
      ...formData,
      expirationDate: formData.expirationDate || null
    };
    
    onSubmit(submitData);
  };

  const handleCancel = () => {
    setFormData({
      title: '',
      content: '',
      expirationDate: ''
    });
    setValidationErrors({});
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
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              type="text"
              placeholder="Enter announcement title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={validationErrors.title ? 'border-red-500' : ''}
              maxLength={200}
              disabled={loading}
            />
            {validationErrors.title && (
              <p className="text-sm text-red-500">{validationErrors.title}</p>
            )}
            <p className="text-sm text-gray-500">
              {formData.title.length}/200 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">
              Content <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="content"
              placeholder="Enter announcement content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              className={`min-h-[120px] resize-vertical ${
                validationErrors.content ? 'border-red-500' : ''
              }`}
              maxLength={5000}
              disabled={loading}
            />
            {validationErrors.content && (
              <p className="text-sm text-red-500">{validationErrors.content}</p>
            )}
            <p className="text-sm text-gray-500">
              {formData.content.length}/5000 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expirationDate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Expiration Date (Optional)
            </Label>
            <Input
              id="expirationDate"
              type="date"
              value={formData.expirationDate}
              onChange={(e) => handleInputChange('expirationDate', e.target.value)}
              className={validationErrors.expirationDate ? 'border-red-500' : ''}
              min={new Date().toISOString().split('T')[0]}
              disabled={loading}
            />
            {validationErrors.expirationDate && (
              <p className="text-sm text-red-500">{validationErrors.expirationDate}</p>
            )}
            <p className="text-sm text-gray-500">
              Leave blank for permanent announcement
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : (announcement ? 'Update Announcement' : 'Create Announcement')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AnnouncementForm;