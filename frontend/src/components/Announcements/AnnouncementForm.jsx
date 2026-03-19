import React, { useState, useEffect } from 'react';
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
    <div className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow border">
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {announcement ? 'Edit Announcement' : 'Create New Announcement'}
        </h3>
      </div>
      <div className="p-6">
        {error && (
          <div className="mb-6 p-4 border border-red-200 rounded-lg bg-red-50 text-red-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              placeholder="Enter announcement title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.title ? 'border-red-500' : 'border-gray-300'
              }`}
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
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              placeholder="Enter announcement content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-vertical ${
                validationErrors.content ? 'border-red-500' : 'border-gray-300'
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
            <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Expiration Date (Optional)
            </label>
            <input
              id="expirationDate"
              type="date"
              value={formData.expirationDate}
              onChange={(e) => handleInputChange('expirationDate', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.expirationDate ? 'border-red-500' : 'border-gray-300'
              }`}
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
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : (announcement ? 'Update Announcement' : 'Create Announcement')}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AnnouncementForm;