import React, { useState, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';

const AnnouncementForm = ({ onAnnouncementCreated, editingAnnouncement, onEditComplete }) => {
  const { user } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    title: editingAnnouncement?.title || '',
    content: editingAnnouncement?.content || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Both title and content are required');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingAnnouncement 
        ? `/api/announcements/${editingAnnouncement.id}`
        : '/api/announcements';
      
      const method = editingAnnouncement ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please log in again.');
        }
        if (response.status === 403) {
          throw new Error('Access denied. Admin privileges required.');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save announcement');
      }

      const savedAnnouncement = await response.json();
      
      // Clear form
      setFormData({ title: '', content: '' });
      
      // Notify parent component
      if (editingAnnouncement) {
        onEditComplete?.(savedAnnouncement);
      } else {
        onAnnouncementCreated?.(savedAnnouncement);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({ title: '', content: '' });
    setError('');
    if (editingAnnouncement) {
      onEditComplete?.();
    }
  };

  // Only show form to admin users
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="announcement-form">
      <div className="form-header">
        <h3>{editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}</h3>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="announcement-form-content">
        <div className="form-group">
          <label htmlFor="title">
            Title <span className="required">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="Enter announcement title"
            disabled={loading}
            maxLength={200}
          />
        </div>

        <div className="form-group">
          <label htmlFor="content">
            Content <span className="required">*</span>
          </label>
          <textarea
            id="content"
            name="content"
            value={formData.content}
            onChange={handleInputChange}
            placeholder="Enter announcement content"
            disabled={loading}
            rows={6}
            maxLength={2000}
          />
          <div className="character-count">
            {formData.content.length}/2000 characters
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !formData.title.trim() || !formData.content.trim()}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                {editingAnnouncement ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              editingAnnouncement ? 'Update Announcement' : 'Create Announcement'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AnnouncementForm;