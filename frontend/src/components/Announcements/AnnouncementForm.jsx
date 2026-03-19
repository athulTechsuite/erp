import React, { useState, useEffect } from 'react';
import { Calendar, Save, X, AlertCircle, Loader2 } from 'lucide-react';

// Constants for character limits
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;

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

  // Client-side validation for immediate user feedback
  // Note: Server-side validation is also required for security
  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length > MAX_TITLE_LENGTH) {
      errors.title = `Title must be ${MAX_TITLE_LENGTH} characters or less`;
    }
    
    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    } else if (formData.content.length > MAX_CONTENT_LENGTH) {
      errors.content = `Content must be ${MAX_CONTENT_LENGTH} characters or less`;
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
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 rounded-lg flex items-center justify-center z-10">
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-lg border">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-gray-700">Processing...</span>
          </div>
        </div>
      )}
      
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {announcement ? 'Edit Announcement' : 'Create New Announcement'}
        </h3>
      </div>
      <div className="p-6">
        {error && (
          <div className="mb-6 p-4 border border-red-200 rounded-lg bg-red-50 text-red-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium">Error</div>
              <div className="text-sm mt-1">{error}</div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="title"
                type="text"
                placeholder="Enter announcement title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.title ? 'border-red-500' : 'border-gray-300'
                } ${loading ? 'bg-gray-50' : ''}`}
                maxLength={MAX_TITLE_LENGTH}
                disabled={loading}
              />
              {loading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            {validationErrors.title && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-3 w-3" />
                <span>{validationErrors.title}</span>
              </div>
            )}
            <p className="text-sm text-gray-500">
              {formData.title.length}/{MAX_TITLE_LENGTH} characters
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              Content <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <textarea
                id="content"
                placeholder="Enter announcement content"
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-vertical ${
                  validationErrors.content ? 'border-red-500' : 'border-gray-300'
                } ${loading ? 'bg-gray-50' : ''}`}
                maxLength={MAX_CONTENT_LENGTH}
                disabled={loading}
              />
              {loading && (
                <div className="absolute right-3 top-3">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            {validationErrors.content && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-3 w-3" />
                <span>{validationErrors.content}</span>
              </div>
            )}
            <p className="text-sm text-gray-500">
              {formData.content.length}/{MAX_CONTENT_LENGTH} characters
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
              } ${loading ? 'bg-gray-50' : ''}`}
              min={new Date().toISOString().split('T')[0]}
              disabled={loading}
            />
            {validationErrors.expirationDate && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-3 w-3" />
                <span>{validationErrors.expirationDate}</span>
              </div>
            )}
            <p className="text-sm text-gray-500">
              Leave blank for permanent announcement
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                loading ? 'bg-blue-500' : ''
              }`}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {loading ? 'Saving...' : (announcement ? 'Update Announcement' : 'Create Announcement')}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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