import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { toast } from 'react-toastify';
import { announcementService } from '../../services/announcementService';
import { fileUploadService } from '../../services/fileUploadService';
import './CreateAnnouncement.css';

const CreateAnnouncement = () => {
  const navigate = useNavigate();
  const editorRef = useRef(null);
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal',
    publishDate: '',
    isScheduled: false
  });
  
  const [attachments, setAttachments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleEditorChange = (content) => {
    setFormData(prev => ({ ...prev, content }));
    if (errors.content) {
      setErrors(prev => ({ ...prev, content: '' }));
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/', 'application/pdf', 'text/', 'application/msword', 'application/vnd.openxmlformats-officedocument'];
    
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      
      const isValidType = allowedTypes.some(type => file.type.startsWith(type));
      if (!isValidType) {
        toast.error(`File type not allowed for ${file.name}`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) return;

    try {
      setIsLoading(true);
      const uploadPromises = validFiles.map(file => fileUploadService.upload(file));
      const uploadedFiles = await Promise.all(uploadPromises);
      
      setAttachments(prev => [...prev, ...uploadedFiles.map(file => ({
        id: file.id,
        name: file.name,
        url: file.url,
        size: file.size
      }))]);
      
      toast.success(`${validFiles.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('Failed to upload files. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeAttachment = (attachmentId) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }
    
    if (!formData.content.trim() || formData.content === '<p></p>') {
      newErrors.content = 'Content is required';
    }
    
    if (formData.isScheduled && !formData.publishDate) {
      newErrors.publishDate = 'Publish date is required for scheduled announcements';
    }
    
    if (formData.publishDate) {
      const selectedDate = new Date(formData.publishDate);
      const now = new Date();
      if (selectedDate <= now) {
        newErrors.publishDate = 'Publish date must be in the future';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the form errors before submitting');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const announcementData = {
        title: formData.title.trim(),
        content: formData.content,
        priority: formData.priority,
        publishDate: formData.isScheduled ? formData.publishDate : null,
        attachments: attachments.map(att => att.id)
      };
      
      await announcementService.create(announcementData);
      
      toast.success(
        formData.isScheduled 
          ? 'Announcement scheduled successfully!' 
          : 'Announcement published successfully!'
      );
      
      navigate('/admin/announcements');
    } catch (error) {
      console.error('Error creating announcement:', error);
      
      if (error.response?.status === 400) {
        const serverErrors = error.response.data.errors || {};
        setErrors(serverErrors);
        toast.error('Please check the form for errors');
      } else {
        toast.error('Failed to create announcement. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to discard this announcement? All unsaved changes will be lost.')) {
      navigate('/admin/announcements');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="create-announcement">
      <div className="create-announcement__header">
        <h1>Create New Announcement</h1>
        <p>Create and publish important company-wide communications</p>
      </div>

      <form onSubmit={handleSubmit} className="create-announcement__form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Title <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={`form-input ${errors.title ? 'error' : ''}`}
              placeholder="Enter announcement title..."
              maxLength="200"
              disabled={isLoading}
            />
            {errors.title && <span className="error-message">{errors.title}</span>}
            <small className="form-hint">
              {formData.title.length}/200 characters
            </small>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="priority" className="form-label">
              Priority Level
            </label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleInputChange}
              className="form-select"
              disabled={isLoading}
            >
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
            <small className="form-hint">
              Urgent announcements will send immediate notifications to all employees
            </small>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Content <span className="required">*</span>
            </label>
            <div className={`editor-wrapper ${errors.content ? 'error' : ''}`}>
              <Editor
                onInit={(evt, editor) => editorRef.current = editor}
                value={formData.content}
                onEditorChange={handleEditorChange}
                init={{
                  height: 400,
                  menubar: false,
                  plugins: [
                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                    'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount'
                  ],
                  toolbar: 'undo redo | blocks | ' +
                    'bold italic forecolor | alignleft aligncenter ' +
                    'alignright alignjustify | bullist numlist outdent indent | ' +
                    'removeformat | help',
                  content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, San Francisco, Segoe UI, Roboto, Helvetica Neue, sans-serif; font-size: 14px }',
                  placeholder: 'Enter your announcement content here...',
                  disabled: isLoading
                }}
              />
            </div>
            {errors.content && <span className="error-message">{errors.content}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Attachments</label>
            <div className="file-upload">
              <input
                type="file"
                id="attachments"
                multiple
                onChange={handleFileUpload}
                className="file-input"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                disabled={isLoading}
              />
              <label htmlFor="attachments" className="file-upload-button">
                <i className="fas fa-paperclip"></i>
                Add Files
              </label>
              <small className="form-hint">
                Maximum 10MB per file. Supported: PDF, DOC, TXT, Images
              </small>
            </div>
            
            {attachments.length > 0 && (
              <div className="attachments-list">
                <h4>Attached Files ({attachments.length})</h4>
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="attachment-item">
                    <div className="attachment-info">
                      <i className="fas fa-file"></i>
                      <span className="attachment-name">{attachment.name}</span>
                      <span className="attachment-size">({formatFileSize(attachment.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="remove-attachment"
                      disabled={isLoading}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="isScheduled"
                name="isScheduled"
                checked={formData.isScheduled}
                onChange={handleInputChange}
                className="form-checkbox"
                disabled={isLoading}
              />
              <label htmlFor="isScheduled" className="checkbox-label">
                Schedule for later publication
              </label>
            </div>
          </div>
        </div>

        {formData.isScheduled && (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="publishDate" className="form-label">
                Publish Date & Time <span className="required">*</span>
              </label>
              <input
                type="datetime-local"
                id="publishDate"
                name="publishDate"
                value={formData.publishDate}
                onChange={handleInputChange}
                className={`form-input ${errors.publishDate ? 'error' : ''}`}
                min={new Date().toISOString().slice(0, 16)}
                disabled={isLoading}
              />
              {errors.publishDate && <span className="error-message">{errors.publishDate}</span>}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                {formData.isScheduled ? 'Scheduling...' : 'Publishing...'}
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane"></i>
                {formData.isScheduled ? 'Schedule Announcement' : 'Publish Announcement'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateAnnouncement;