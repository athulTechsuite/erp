import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import './AnnouncementManager.css';

const AnnouncementManager = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isActive: true
  });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const requestQueueRef = useRef([]);
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Input sanitization utility
  const sanitizeInput = (input) => {
    if (typeof input !== 'string') return '';
    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .slice(0, input === formData.title ? 200 : 2000); // Enforce length limits
  };

  // Safe state update utility
  const safeSetState = useCallback((setter, value) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);

  // Request queue processor to handle race conditions
  const processRequestQueue = useCallback(async () => {
    if (isProcessingRef.current || requestQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    
    while (requestQueueRef.current.length > 0) {
      const request = requestQueueRef.current.shift();
      try {
        await request();
      } catch (error) {
        console.error('Request failed:', error);
        if (isMountedRef.current) {
          toast.error('Operation failed. Please try again.');
        }
      }
    }
    
    isProcessingRef.current = false;
  }, []);

  // Add request to queue
  const queueRequest = useCallback((requestFn) => {
    return new Promise((resolve, reject) => {
      requestQueueRef.current.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      processRequestQueue();
    });
  }, [processRequestQueue]);

  const fetchAnnouncements = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      safeSetState(setLoading, true);
      // TODO: Consider using httpOnly cookies for token storage to prevent XSS attacks
      const token = localStorage.getItem('token');
      const response = await fetch('/api/announcements/admin', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          if (isMountedRef.current) {
            toast.error('Access denied. Admin privileges required.');
          }
          return;
        }
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      if (isMountedRef.current) {
        setAnnouncements(data);
      }
    } catch (error) {
      if (isMountedRef.current) {
        toast.error('Error loading announcements: ' + error.message);
        setAnnouncements([]);
      }
    } finally {
      if (isMountedRef.current) {
        safeSetState(setLoading, false);
      }
    }
  }, [safeSetState]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (submitting || !isMountedRef.current) return;
    
    // Sanitize inputs
    const sanitizedTitle = sanitizeInput(formData.title);
    const sanitizedContent = sanitizeInput(formData.content);
    
    if (!sanitizedTitle || !sanitizedContent) {
      toast.error('Title and content are required');
      return;
    }

    // Additional validation
    if (sanitizedTitle.length < 3) {
      toast.error('Title must be at least 3 characters long');
      return;
    }

    if (sanitizedContent.length < 10) {
      toast.error('Content must be at least 10 characters long');
      return;
    }

    const sanitizedFormData = {
      ...formData,
      title: sanitizedTitle,
      content: sanitizedContent
    };

    const submitRequest = async () => {
      if (!isMountedRef.current) return;
      
      safeSetState(setSubmitting, true);
      try {
        const token = localStorage.getItem('token');
        const url = editingId 
          ? `/api/announcements/${editingId}` 
          : '/api/announcements';
        
        const method = editingId ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(sanitizedFormData)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to save announcement');
        }

        const savedAnnouncement = await response.json();
        
        if (!isMountedRef.current) return;
        
        if (editingId) {
          setAnnouncements(prev => 
            prev.map(ann => ann.id === editingId ? savedAnnouncement : ann)
          );
          toast.success('Announcement updated successfully');
        } else {
          setAnnouncements(prev => [savedAnnouncement, ...prev]);
          toast.success('Announcement created successfully');
        }

        resetForm();
      } finally {
        if (isMountedRef.current) {
          safeSetState(setSubmitting, false);
        }
      }
    };

    try {
      await queueRequest(submitRequest);
    } catch (error) {
      if (isMountedRef.current) {
        toast.error(error.message);
        safeSetState(setSubmitting, false);
      }
    }
  };

  const handleEdit = (announcement) => {
    if (submitting) return;
    
    setFormData({
      title: announcement.title,
      content: announcement.content,
      isActive: announcement.isActive
    });
    setEditingId(announcement.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (submitting || !isMountedRef.current) return;
    
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    const deleteRequest = async () => {
      if (!isMountedRef.current) return;
      
      safeSetState(setSubmitting, true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/announcements/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to delete announcement');
        }

        if (isMountedRef.current) {
          setAnnouncements(prev => prev.filter(ann => ann.id !== id));
          toast.success('Announcement deleted successfully');
        }
      } finally {
        if (isMountedRef.current) {
          safeSetState(setSubmitting, false);
        }
      }
    };

    try {
      await queueRequest(deleteRequest);
    } catch (error) {
      if (isMountedRef.current) {
        toast.error(error.message);
        safeSetState(setSubmitting, false);
      }
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    if (submitting || !isMountedRef.current) return;
    
    const toggleRequest = async () => {
      if (!isMountedRef.current) return;
      
      safeSetState(setSubmitting, true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/announcements/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ isActive: !currentStatus })
        });

        if (!response.ok) {
          throw new Error('Failed to update announcement status');
        }

        const updatedAnnouncement = await response.json();
        
        if (isMountedRef.current) {
          setAnnouncements(prev => 
            prev.map(ann => ann.id === id ? updatedAnnouncement : ann)
          );
          toast.success(`Announcement ${!currentStatus ? 'activated' : 'deactivated'}`);
        }
      } finally {
        if (isMountedRef.current) {
          safeSetState(setSubmitting, false);
        }
      }
    };

    try {
      await queueRequest(toggleRequest);
    } catch (error) {
      if (isMountedRef.current) {
        toast.error(error.message);
        safeSetState(setSubmitting, false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      isActive: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const isFormDisabled = loading || submitting;

  return (
    <div className="announcement-manager">
      <div className="announcement-manager-header">
        <h2>Manage Announcements</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          disabled={isFormDisabled}
        >
          {showForm ? 'Cancel' : 'Create New Announcement'}
        </button>
      </div>

      {showForm && (
        <div className="announcement-form-container">
          <h3>{editingId ? 'Edit Announcement' : 'Create New Announcement'}</h3>
          <form onSubmit={handleSubmit} className="announcement-form">
            <div className="form-group">
              <label htmlFor="title">Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                maxLength="200"
                placeholder="Enter announcement title"
                disabled={isFormDisabled}
              />
            </div>

            <div className="form-group">
              <label htmlFor="content">Content *</label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                required
                rows="6"
                maxLength="2000"
                placeholder="Enter announcement content"
                disabled={isFormDisabled}
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  disabled={isFormDisabled}
                />
                <span>Publish immediately</span>
              </label>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isFormDisabled}
              >
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Publish'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
                disabled={isFormDisabled}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="announcements-list">
        <h3>Existing Announcements</h3>
        {loading && !showForm && (
          <div className="loading">Loading announcements...</div>
        )}
        
        {!loading && announcements.length === 0 && (
          <div className="no-announcements">
            No announcements found. Create your first announcement to get started.
          </div>
        )}

        {announcements.map(announcement => (
          <div key={announcement.id} className="announcement-item">
            <div className="announcement-header">
              <h4>{announcement.title}</h4>
              <div className="announcement-status">
                <span className={`status ${announcement.isActive ? 'active' : 'inactive'}`}>
                  {announcement.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            
            <div className="announcement-content">
              <p>{announcement.content}</p>
            </div>
            
            <div className="announcement-meta">
              <span>Created: {formatDate(announcement.createdAt)}</span>
              {announcement.updatedAt !== announcement.createdAt && (
                <span>Updated: {formatDate(announcement.updatedAt)}</span>
              )}
              <span>By: {announcement.createdBy?.name || 'Unknown'}</span>
            </div>

            <div className="announcement-actions">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleEdit(announcement)}
                disabled={isFormDisabled}
              >
                Edit
              </button>
              <button
                className={`btn btn-sm ${announcement.isActive ? 'btn-warning' : 'btn-success'}`}
                onClick={() => toggleStatus(announcement.id, announcement.isActive)}
                disabled={isFormDisabled}
              >
                {announcement.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleDelete(announcement.id)}
                disabled={isFormDisabled}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnnouncementManager;