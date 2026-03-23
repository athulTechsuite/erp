import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, FileText, Upload, Trash2 } from 'lucide-react';

const AnnouncementModal = ({ isOpen, onClose, announcement, onSave, mode = 'create' }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal',
    publishDate: new Date().toISOString().split('T')[0],
    publishTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
    isScheduled: false,
    attachments: []
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);

  useEffect(() => {
    if (announcement && mode === 'edit') {
      const publishDateTime = new Date(announcement.publishDate);
      setFormData({
        title: announcement.title || '',
        content: announcement.content || '',
        priority: announcement.priority || 'normal',
        publishDate: publishDateTime.toISOString().split('T')[0],
        publishTime: publishDateTime.toTimeString().split(' ')[0].substring(0, 5),
        isScheduled: new Date(announcement.publishDate) > new Date(),
        attachments: announcement.attachments || []
      });
    } else if (mode === 'create') {
      setFormData({
        title: '',
        content: '',
        priority: 'normal',
        publishDate: new Date().toISOString().split('T')[0],
        publishTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
        isScheduled: false,
        attachments: []
      });
    }
    setErrors({});
    setAttachmentFiles([]);
  }, [announcement, mode, isOpen]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument', 'text/'];

    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      
      const isValidType = allowedTypes.some(type => file.type.startsWith(type));
      if (!isValidType) {
        alert(`File ${file.name} is not a supported format.`);
        return false;
      }
      
      return true;
    });

    setAttachmentFiles(prev => [...prev, ...validFiles]);
  };

  const removeAttachment = (index, isExisting = false) => {
    if (isExisting) {
      setFormData(prev => ({
        ...prev,
        attachments: prev.attachments.filter((_, i) => i !== index)
      }));
    } else {
      setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    } else if (formData.content.length > 5000) {
      newErrors.content = 'Content must be less than 5000 characters';
    }

    if (formData.isScheduled) {
      const publishDateTime = new Date(`${formData.publishDate}T${formData.publishTime}`);
      const now = new Date();
      
      if (publishDateTime <= now) {
        newErrors.publishDate = 'Scheduled date must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const publishDateTime = formData.isScheduled 
        ? new Date(`${formData.publishDate}T${formData.publishTime}`)
        : new Date();

      const announcementData = {
        ...formData,
        publishDate: publishDateTime.toISOString(),
        status: formData.isScheduled ? 'scheduled' : 'published'
      };

      // Handle file uploads if any
      if (attachmentFiles.length > 0) {
        const uploadedAttachments = await uploadAttachments(attachmentFiles);
        announcementData.attachments = [...formData.attachments, ...uploadedAttachments];
      }

      await onSave(announcementData, announcement?.id);
      onClose();
    } catch (error) {
      console.error('Error saving announcement:', error);
      setErrors({ submit: 'Failed to save announcement. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadAttachments = async (files) => {
    // This would integrate with your file upload service
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const response = await fetch('/api/announcements/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to upload attachments');
    }

    return response.json();
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'important':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <FileText className="w-4 h-4 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'border-red-200 bg-red-50';
      case 'important':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {getPriorityIcon(formData.priority)}
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'create' ? 'Create New Announcement' : 'Edit Announcement'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-160px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter announcement title"
                maxLength={200}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority Level
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Content */}
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                Content *
              </label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                rows={8}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.content ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter announcement content"
                maxLength={5000}
              />
              <div className="flex justify-between mt-1">
                {errors.content && (
                  <p className="text-sm text-red-600">{errors.content}</p>
                )}
                <p className="text-sm text-gray-500 ml-auto">
                  {formData.content.length}/5000 characters
                </p>
              </div>
            </div>

            {/* Scheduling */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center space-x-3 mb-4">
                <Calendar className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Publication Settings</span>
              </div>
              
              <div className="space-y-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="isScheduled"
                    checked={formData.isScheduled}
                    onChange={handleInputChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Schedule for later publication</span>
                </label>

                {formData.isScheduled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="publishDate" className="block text-sm font-medium text-gray-700 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        id="publishDate"
                        name="publishDate"
                        value={formData.publishDate}
                        onChange={handleInputChange}
                        min={new Date().toISOString().split('T')[0]}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.publishDate ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.publishDate && (
                        <p className="mt-1 text-sm text-red-600">{errors.publishDate}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="publishTime" className="block text-sm font-medium text-gray-700 mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        id="publishTime"
                        name="publishTime"
                        value={formData.publishTime}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Attachments
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400" />
                  <div className="mt-2">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-500 font-medium">
                        Upload files
                      </span>
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                      />
                    </label>
                    <p className="text-gray-500 text-sm mt-1">
                      PDF, DOC, images, text files up to 10MB each
                    </p>
                  </div>
                </div>
              </div>

              {/* Existing attachments */}
              {formData.attachments.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Current attachments:</p>
                  <div className="space-y-2">
                    {formData.attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm text-gray-700">{attachment.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index, true)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New attachments */}
              {attachmentFiles.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">New attachments:</p>
                  <div className="space-y-2">
                    {attachmentFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-blue-50 p-2 rounded">
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index, false)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : (mode === 'create' ? 'Create Announcement' : 'Update Announcement')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;