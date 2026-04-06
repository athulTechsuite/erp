import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import './AnnouncementManager.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

const AnnouncementManager = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isActive: true
  });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const getAuthHeaders = () => {
    // Try to get token from cookies first, fallback to localStorage for backward compatibility
    let token = null;
    
    // Extract token from httpOnly cookie via API call if available
    const cookies = document.cookie.split(';');
    const authCookie = cookies.find(cookie => cookie.trim().startsWith('auth-token='));
    
    if (authCookie) {
      // In a real implementation, httpOnly cookies would be automatically sent
      // This is just for demonstration - the actual token extraction would happen server-side
      console.warn('Using cookie-based authentication (recommended)');
    } else {
      // Fallback to localStorage (deprecated approach)
      token = localStorage.getItem('token');
      if (token) {
        console.warn('Using localStorage for token storage is deprecated and insecure. Please migrate to httpOnly cookies.');
      }
    }

    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    };
  };

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/announcements/admin`, {
        credentials: 'include', // Important for httpOnly cookies
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Access denied. Admin privileges required.');
          return;
        }
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      setAnnouncements(data);
    } catch (error) {
      toast.error('Error loading announcements: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    try {
      setLoading(true);
      const url = editingId 
        ? `${API_BASE_URL}/api/announcements/${editingId}` 
        : `${API_BASE_URL}/api/announcements`;
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include', // Important for httpOnly cookies
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save announcement');
      }

      const savedAnnouncement = await response.json();
      
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
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (announcement) => {
    setFormData({
      title: announcement.title,
      content: announcement.content,
      isActive: announcement.isActive
    });
    setEditingId(announcement.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/announcements/${id}`, {
        method: 'DELETE',
        credentials: 'include', // Important for httpOnly cookies
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to delete announcement');
      }

      setAnnouncements(prev => prev.filter(ann => ann.id !== id));
      toast.success('Announcement deleted successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/announcements/${id}`, {
        method: 'PUT',
        credentials: 'include', // Important for httpOnly cookies
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !currentStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update announcement status');
      }

      const updatedAnnouncement = await response.json();
      setAnnouncements(prev => 
        prev.map(ann => ann.id === id ? updatedAnnouncement : ann)
      );
      
      toast.success(`Announcement ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error(error.message);
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

  return (
    <div className="announcement-manager">
      <div className="announcement-manager-header">
        <h2>Manage Announcements</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          disabled={loading}
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
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                <span>Publish immediately</span>
              </label>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : editingId ? 'Update' : 'Publish'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
                disabled={loading}
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
                disabled={loading}
              >
                Edit
              </button>
              <button
                className={`btn btn-sm ${announcement.isActive ? 'btn-warning' : 'btn-success'}`}
                onClick={() => toggleStatus(announcement.id, announcement.isActive)}
                disabled={loading}
              >
                {announcement.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleDelete(announcement.id)}
                disabled={loading}
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