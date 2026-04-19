import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  IconButton, 
  Chip, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormControlLabel, 
  Checkbox, 
  Alert,
  Snackbar,
  Tooltip
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Visibility as ViewIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const ManageAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal',
    isUrgent: false,
    publishDate: new Date(),
    expirationDate: null,
    isActive: true
  });

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/announcements', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data);
      } else {
        throw new Error('Failed to fetch announcements');
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
      showSnackbar('Error fetching announcements', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleOpenDialog = (announcement = null) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setFormData({
        title: announcement.title,
        content: announcement.content,
        priority: announcement.priority,
        isUrgent: announcement.isUrgent,
        publishDate: new Date(announcement.publishDate),
        expirationDate: announcement.expirationDate ? new Date(announcement.expirationDate) : null,
        isActive: announcement.isActive
      });
    } else {
      setEditingAnnouncement(null);
      setFormData({
        title: '',
        content: '',
        priority: 'normal',
        isUrgent: false,
        publishDate: new Date(),
        expirationDate: null,
        isActive: true
      });
    }
    setFormErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingAnnouncement(null);
    setFormData({
      title: '',
      content: '',
      priority: 'normal',
      isUrgent: false,
      publishDate: new Date(),
      expirationDate: null,
      isActive: true
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!formData.content.trim() || formData.content === '<p><br></p>') {
      errors.content = 'Content is required';
    }
    
    if (formData.expirationDate && formData.publishDate >= formData.expirationDate) {
      errors.expirationDate = 'Expiration date must be after publish date';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const url = editingAnnouncement 
        ? `/api/admin/announcements/${editingAnnouncement.id}`
        : '/api/admin/announcements';
      
      const method = editingAnnouncement ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const message = editingAnnouncement 
          ? 'Announcement updated successfully'
          : 'Announcement created successfully';
        showSnackbar(message);
        handleCloseDialog();
        fetchAnnouncements();
      } else {
        throw new Error('Failed to save announcement');
      }
    } catch (error) {
      console.error('Error saving announcement:', error);
      showSnackbar('Error saving announcement', 'error');
    }
  };

  const handleDeleteClick = (announcement) => {
    setAnnouncementToDelete(announcement);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const response = await fetch(`/api/admin/announcements/${announcementToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        showSnackbar('Announcement deleted successfully');
        fetchAnnouncements();
      } else {
        throw new Error('Failed to delete announcement');
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      showSnackbar('Error deleting announcement', 'error');
    } finally {
      setDeleteConfirmOpen(false);
      setAnnouncementToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setAnnouncementToDelete(null);
  };

  const getPriorityColor = (priority, isUrgent) => {
    if (isUrgent) return 'error';
    switch (priority) {
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  const getPriorityLabel = (priority, isUrgent) => {
    if (isUrgent) return 'URGENT';
    switch (priority) {
      case 'high': return 'High Priority';
      case 'medium': return 'Medium Priority';
      default: return 'Normal';
    }
  };

  const getStatusColor = (announcement) => {
    const now = new Date();
    const publishDate = new Date(announcement.publishDate);
    const expirationDate = announcement.expirationDate ? new Date(announcement.expirationDate) : null;

    if (!announcement.isActive) return 'default';
    if (publishDate > now) return 'info';
    if (expirationDate && expirationDate < now) return 'default';
    return 'success';
  };

  const getStatusLabel = (announcement) => {
    const now = new Date();
    const publishDate = new Date(announcement.publishDate);
    const expirationDate = announcement.expirationDate ? new Date(announcement.expirationDate) : null;

    if (!announcement.isActive) return 'Inactive';
    if (publishDate > now) return 'Scheduled';
    if (expirationDate && expirationDate < now) return 'Expired';
    return 'Active';
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <Typography>Loading announcements...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Manage Announcements
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Create Announcement
          </Button>
        </Box>

        <Card>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Publish Date</TableCell>
                    <TableCell>Expiration Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {announcements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No announcements found. Create your first announcement!
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    announcements.map((announcement) => (
                      <TableRow key={announcement.id}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            {announcement.isUrgent && (
                              <Tooltip title="Urgent announcement">
                                <WarningIcon color="error" fontSize="small" />
                              </Tooltip>
                            )}
                            <Typography variant="body2">
                              {announcement.title}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getPriorityLabel(announcement.priority, announcement.isUrgent)}
                            color={getPriorityColor(announcement.priority, announcement.isUrgent)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(announcement)}
                            color={getStatusColor(announcement)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {format(new Date(announcement.publishDate), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          {announcement.expirationDate
                            ? format(new Date(announcement.expirationDate), 'MMM dd, yyyy HH:mm')
                            : 'No expiration'
                          }
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            <Tooltip title="Edit announcement">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog(announcement)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete announcement">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteClick(announcement)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog 
          open={openDialog} 
          onClose={handleCloseDialog} 
          maxWidth="md" 
          fullWidth
          PaperProps={{
            sx: { minHeight: '600px' }
          }}
        >
          <DialogTitle>
            {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
          </DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                error={!!formErrors.title}
                helperText={formErrors.title}
                required
              />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Content *
                </Typography>
                <ReactQuill
                  value={formData.content}
                  onChange={(content) => setFormData({ ...formData, content })}
                  modules={quillModules}
                  style={{ height: '200px', marginBottom: '50px' }}
                />
                {formErrors.content && (
                  <Typography variant="caption" color="error">
                    {formErrors.content}
                  </Typography>
                )}
              </Box>

              <Box display="flex" gap={2}>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    label="Priority"
                  >
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isUrgent}
                      onChange={(e) => setFormData({ ...formData, isUrgent: e.target.checked })}
                    />
                  }
                  label="Mark as Urgent"
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </Box>

              <Box display="flex" gap={2}>
                <DateTimePicker
                  label="Publish Date"
                  value={formData.publishDate}
                  onChange={(date) => setFormData({ ...formData, publishDate: date })}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />

                <DateTimePicker
                  label="Expiration Date (Optional)"
                  value={formData.expirationDate}
                  onChange={(date) => setFormData({ ...formData, expirationDate: date })}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                  error={!!formErrors.expirationDate}
                  helperText={formErrors.expirationDate}
                />
              </Box>

              {formData.isUrgent && (
                <Alert severity="info" icon={<InfoIcon />}>
                  Urgent announcements will trigger email notifications to all employees.
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">
              {editingAnnouncement ? 'Update' : 'Create'} Announcement
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onClose={handleDeleteCancel}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the announcement "{announcementToDelete?.title}"?
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default ManageAnnouncements;