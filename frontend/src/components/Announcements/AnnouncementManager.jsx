import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

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

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      // TODO: Security - Consider using httpOnly cookies instead of localStorage for JWT storage to prevent XSS attacks
      const token = localStorage.getItem('token');
      const response = await fetch('/api/announcements/admin', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
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
    <div className="announcement-manager" style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div className="announcement-manager-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '2px solid #eee',
        paddingBottom: '10px'
      }}>
        <h2 style={{ margin: 0, color: '#333' }}>Manage Announcements</h2>
        <button
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
          onClick={() => setShowForm(!showForm)}
          disabled={loading}
        >
          {showForm ? 'Cancel' : 'Create New Announcement'}
        </button>
      </div>

      {showForm && (
        <div className="announcement-form-container" style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginTop: 0, color: '#333' }}>
            {editingId ? 'Edit Announcement' : 'Create New Announcement'}
          </h3>
          <form onSubmit={handleSubmit} className="announcement-form">
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="title" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                maxLength="200"
                placeholder="Enter announcement title"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label htmlFor="content" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Content *
              </label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                required
                rows="6"
                maxLength="2000"
                placeholder="Enter announcement content"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  style={{ marginRight: '8px' }}
                />
                <span>Publish immediately</span>
              </label>
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                disabled={loading}
              >
                {loading ? 'Saving...' : editingId ? 'Update' : 'Publish'}
              </button>
              <button
                type="button"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
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
        <h3 style={{ color: '#333' }}>Existing Announcements</h3>
        {loading && !showForm && (
          <div className="loading" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            Loading announcements...
          </div>
        )}
        
        {!loading && announcements.length === 0 && (
          <div className="no-announcements" style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#666',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            No announcements found. Create your first announcement to get started.
          </div>
        )}

        {announcements.map(announcement => (
          <div key={announcement.id} className="announcement-item" style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '15px',
            backgroundColor: 'white'
          }}>
            <div className="announcement-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '10px'
            }}>
              <h4 style={{ margin: 0, color: '#333' }}>{announcement.title}</h4>
              <div className="announcement-status">
                <span className={`status ${announcement.isActive ? 'active' : 'inactive'}`} style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: announcement.isActive ? '#28a745' : '#dc3545',
                  color: 'white'
                }}>
                  {announcement.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            
            <div className="announcement-content" style={{ marginBottom: '15px' }}>
              <p style={{ margin: 0, lineHeight: '1.5', color: '#555' }}>
                {announcement.content}
              </p>
            </div>
            
            <div className="announcement-meta" style={{
              fontSize: '12px',
              color: '#888',
              marginBottom: '15px',
              display: 'flex',
              gap: '15px',
              flexWrap: 'wrap'
            }}>
              <span>Created: {formatDate(announcement.createdAt)}</span>
              {announcement.updatedAt !== announcement.createdAt && (
                <span>Updated: {formatDate(announcement.updatedAt)}</span>
              )}
              <span>By: {announcement.createdBy?.name || 'Unknown'}</span>
            </div>

            <div className="announcement-actions" style={{ display: 'flex', gap: '10px' }}>
              <button
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                onClick={() => handleEdit(announcement)}
                disabled={loading}
              >
                Edit
              </button>
              <button
                style={{
                  padding: '6px 12px',
                  backgroundColor: announcement.isActive ? '#ffc107' : '#28a745',
                  color: announcement.isActive ? '#212529' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                onClick={() => toggleStatus(announcement.id, announcement.isActive)}
                disabled={loading}
              >
                {announcement.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
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