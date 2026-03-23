import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { announcementService } from '../../services/announcementService';
import { fileService } from '../../services/fileService';
import LoadingSpinner from '../common/LoadingSpinner';
import FileUpload from '../common/FileUpload';

const EditAnnouncement = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'normal',
    publishDate: '',
    scheduledFor: null,
    attachments: []
  });
  const [attachments, setAttachments] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  useEffect(() => {
    if (id && id !== 'new') {
      fetchAnnouncement();
    } else {
      setLoading(false);
      // Set default publish date to now for new announcements
      const now = new Date().toISOString().slice(0, 16);
      setAnnouncement(prev => ({ ...prev, publishDate: now }));
    }
  }, [id]);

  const fetchAnnouncement = async () => {
    try {
      const data = await announcementService.getAnnouncement(id);
      setAnnouncement({
        ...data,
        publishDate: data.scheduledFor 
          ? new Date(data.scheduledFor).toISOString().slice(0, 16)
          : new Date().toISOString().slice(0, 16)
      });
      setAttachments(data.attachments || []);
    } catch (error) {
      toast.error('Failed to load announcement');
      navigate('/admin/announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAnnouncement(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleContentChange = (content) => {
    setAnnouncement(prev => ({
      ...prev,
      content
    }));
  };

  const handleFileUpload = async (files) => {
    setUploadingFiles(true);
    try {
      const uploadPromises = Array.from(files).map(file => 
        fileService.uploadFile(file, 'announcements')
      );
      const uploadedFiles = await Promise.all(uploadPromises);
      
      setAttachments(prev => [...prev, ...uploadedFiles]);
      toast.success(`${uploadedFiles.length} file(s) uploaded successfully`);
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleRemoveAttachment = (attachmentId) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!announcement.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!announcement.content.trim()) {
      toast.error('Content is required');
      return;
    }

    setSaving(true);
    try {
      const announcementData = {
        ...announcement,
        scheduledFor: announcement.publishDate ? new Date(announcement.publishDate) : null,
        attachments: attachments.map(att => att.id)
      };

      if (id && id !== 'new') {
        await announcementService.updateAnnouncement(id, announcementData);
        toast.success('Announcement updated successfully');
      } else {
        await announcementService.createAnnouncement(announcementData);
        toast.success('Announcement created successfully');
      }

      navigate('/admin/announcements');
    } catch (error) {
      toast.error('Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/announcements');
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['link', 'blockquote', 'code-block'],
      ['clean']
    ]
  };

  const quillFormats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'list', 'bullet', 'indent',
    'align', 'link', 'blockquote', 'code-block'
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  const isNewAnnouncement = !id || id === 'new';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isNewAnnouncement ? 'Create Announcement' : 'Edit Announcement'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={announcement.title}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter announcement title"
              required
            />
          </div>

          {/* Priority and Publish Date Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={announcement.priority}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label htmlFor="publishDate" className="block text-sm font-medium text-gray-700 mb-2">
                Publish Date & Time
              </label>
              <input
                type="datetime-local"
                id="publishDate"
                name="publishDate"
                value={announcement.publishDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content *
            </label>
            <div className="border border-gray-300 rounded-md">
              <ReactQuill
                value={announcement.content}
                onChange={handleContentChange}
                modules={quillModules}
                formats={quillFormats}
                theme="snow"
                placeholder="Enter announcement content..."
                style={{ minHeight: '200px' }}
              />
            </div>
          </div>

          {/* File Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachments
            </label>
            <FileUpload
              onFilesSelected={handleFileUpload}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
              disabled={uploadingFiles}
            />
            
            {/* Display existing attachments */}
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Uploaded Files:</h4>
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-gray-900">{attachment.originalName}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({(attachment.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploadingFiles}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                isNewAnnouncement ? 'Create Announcement' : 'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAnnouncement;