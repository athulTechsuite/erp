import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import * as announcementService from '../../services/announcementService';

const AnnouncementManager = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await announcementService.getAll();
      setAnnouncements(data);
      setError('');
    } catch (err) {
      setError('Failed to load announcements');
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

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
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenDialog = (announcement = null) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setFormData({
        title: announcement.title,
        content: announcement.content
      });
    } else {
      setEditingAnnouncement(null);
      setFormData({
        title: '',
        content: ''
      });
    }
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAnnouncement(null);
    setFormData({
      title: '',
      content: ''
    });
    setFormErrors({});
  };

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      if (editingAnnouncement) {
        await announcementService.update(editingAnnouncement.id, formData);
        setSuccess('Announcement updated successfully');
      } else {
        await announcementService.create(formData);
        setSuccess('Announcement created successfully');
      }
      
      handleCloseDialog();
      fetchAnnouncements();
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      await announcementService.delete(id);
      setSuccess('Announcement deleted successfully');
      fetchAnnouncements();
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete announcement');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Company Announcements
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Announcement
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {announcements.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="textSecondary" textAlign="center">
              No announcements available.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {announcements.map((announcement) => (
            <Card key={announcement.id} elevation={2}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                    {announcement.title}
                  </Typography>
                  {isAdmin && (
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(announcement)}
                        sx={{ mr: 1 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(announcement.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                
                <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-wrap' }}>
                  {announcement.content}
                </Typography>
                
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Chip
                    label={`By: ${announcement.author?.firstName} ${announcement.author?.lastName}`}
                    size="small"
                    variant="outlined"
                  />
                  <Typography variant="caption" color="textSecondary">
                    {formatDate(announcement.createdAt)}
                    {announcement.updatedAt !== announcement.createdAt && (
                      <span> (edited {formatDate(announcement.updatedAt)})</span>
                    )}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Add/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
            </Typography>
            <IconButton onClick={handleCloseDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Title"
            value={formData.title}
            onChange={handleInputChange('title')}
            error={!!formErrors.title}
            helperText={formErrors.title || `${formData.title.length}/200 characters`}
            margin="normal"
            required
          />
          
          <TextField
            fullWidth
            label="Content"
            value={formData.content}
            onChange={handleInputChange('content')}
            error={!!formErrors.content}
            helperText={formErrors.content || `${formData.content.length}/5000 characters`}
            margin="normal"
            multiline
            rows={6}
            required
          />
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting}
          >
            {submitting ? (
              <CircularProgress size={24} />
            ) : (
              editingAnnouncement ? 'Update' : 'Create'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnnouncementManager;