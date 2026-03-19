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
  Fab,
  Alert,
  Chip,
  Menu,
  MenuItem,
  CircularProgress,
  Grid,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Schedule as ScheduleIcon,
  Archive as ArchiveIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, isAfter, isBefore } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { announcementsService } from '../services/announcementsService';

const AnnouncementsPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, hasPermission } = useAuth();
  
  // State management
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    expirationDate: null
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const isAdmin = hasPermission('manage_announcements');

  // Load announcements on component mount
  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await announcementsService.getAll();
      setAnnouncements(data);
    } catch (err) {
      setError('Failed to load announcements. Please try again.');
      console.error('Error loading announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (announcement = null) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement?.title || '',
      content: announcement?.content || '',
      expirationDate: announcement?.expirationDate ? new Date(announcement.expirationDate) : null
    });
    setFormErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingAnnouncement(null);
    setFormData({ title: '', content: '', expirationDate: null });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }
    
    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    } else if (formData.content.length > 5000) {
      errors.content = 'Content must be less than 5000 characters';
    }
    
    if (formData.expirationDate && isBefore(formData.expirationDate, new Date())) {
      errors.expirationDate = 'Expiration date must be in the future';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      setError('');
      
      const announcementData = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        expirationDate: formData.expirationDate
      };
      
      if (editingAnnouncement) {
        await announcementsService.update(editingAnnouncement.id, announcementData);
        setSuccess('Announcement updated successfully');
      } else {
        await announcementsService.create(announcementData);
        setSuccess('Announcement created successfully');
      }
      
      handleCloseDialog();
      await loadAnnouncements();
    } catch (err) {
      setError(err.message || 'Failed to save announcement. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!announcementToDelete) return;
    
    try {
      setError('');
      await announcementsService.delete(announcementToDelete.id);
      setSuccess('Announcement deleted successfully');
      setDeleteConfirmOpen(false);
      setAnnouncementToDelete(null);
      await loadAnnouncements();
    } catch (err) {
      setError(err.message || 'Failed to delete announcement. Please try again.');
    }
  };

  const handleMenuClick = (event, announcement) => {
    setAnchorEl(event.currentTarget);
    setSelectedAnnouncement(announcement);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAnnouncement(null);
  };

  const handleEdit = () => {
    handleOpenDialog(selectedAnnouncement);
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setAnnouncementToDelete(selectedAnnouncement);
    setDeleteConfirmOpen(true);
    handleMenuClose();
  };

  const getAnnouncementStatus = (announcement) => {
    if (!announcement.expirationDate) return 'active';
    
    const now = new Date();
    const expiration = new Date(announcement.expirationDate);
    
    if (isAfter(now, expiration)) return 'expired';
    return 'active';
  };

  const formatDate = (date) => {
    return format(new Date(date), 'MMM dd, yyyy h:mm a');
  };

  // Filter announcements
  const activeAnnouncements = announcements.filter(a => getAnnouncementStatus(a) === 'active');
  const expiredAnnouncements = announcements.filter(a => getAnnouncementStatus(a) === 'expired');

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '1200px', mx: 'auto' }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Company Announcements
          </Typography>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              size={isMobile ? 'small' : 'medium'}
            >
              {isMobile ? 'Add' : 'New Announcement'}
            </Button>
          )}
        </Box>

        {/* Alerts */}
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

        {/* Active Announcements */}
        {activeAnnouncements.length > 0 && (
          <Box mb={4}>
            <Typography variant="h6" gutterBottom>
              Current Announcements
            </Typography>
            <Grid container spacing={2}>
              {activeAnnouncements.map((announcement) => (
                <Grid item xs={12} md={6} lg={4} key={announcement.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                        <Typography variant="h6" component="h3" sx={{ flexGrow: 1, mr: 1 }}>
                          {announcement.title}
                        </Typography>
                        {isAdmin && (
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuClick(e, announcement)}
                            sx={{ mt: -1 }}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        )}
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {announcement.content}
                      </Typography>
                      
                      <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          Posted {formatDate(announcement.createdAt)}
                        </Typography>
                        {announcement.expirationDate && (
                          <Chip
                            icon={<ScheduleIcon />}
                            label={`Expires ${formatDate(announcement.expirationDate)}`}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Expired Announcements */}
        {expiredAnnouncements.length > 0 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ArchiveIcon />
              Archived Announcements
            </Typography>
            <Grid container spacing={2}>
              {expiredAnnouncements.map((announcement) => (
                <Grid item xs={12} md={6} lg={4} key={announcement.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', opacity: 0.7 }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                        <Typography variant="h6" component="h3" sx={{ flexGrow: 1, mr: 1 }}>
                          {announcement.title}
                        </Typography>
                        {isAdmin && (
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuClick(e, announcement)}
                            sx={{ mt: -1 }}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        )}
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {announcement.content}
                      </Typography>
                      
                      <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          Posted {formatDate(announcement.createdAt)}
                        </Typography>
                        <Chip
                          label="Expired"
                          size="small"
                          color="default"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* No announcements message */}
        {announcements.length === 0 && (
          <Box textAlign="center" py={8}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No announcements yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isAdmin 
                ? 'Create your first company announcement to get started.'
                : 'Check back later for company updates and announcements.'
              }
            </Typography>
          </Box>
        )}

        {/* Floating Action Button for mobile */}
        {isAdmin && isMobile && (
          <Fab
            color="primary"
            aria-label="add announcement"
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
            onClick={() => handleOpenDialog()}
          >
            <AddIcon />
          </Fab>
        )}

        {/* Create/Edit Dialog */}
        <Dialog 
          open={openDialog} 
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>
            {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <TextField
                autoFocus
                margin="normal"
                label="Title"
                fullWidth
                variant="outlined"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                error={!!formErrors.title}
                helperText={formErrors.title}
                inputProps={{ maxLength: 200 }}
              />
              
              <TextField
                margin="normal"
                label="Content"
                fullWidth
                multiline
                rows={6}
                variant="outlined"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                error={!!formErrors.content}
                helperText={formErrors.content}
                inputProps={{ maxLength: 5000 }}
              />
              
              <DateTimePicker
                label="Expiration Date (Optional)"
                value={formData.expirationDate}
                onChange={(date) => setFormData({ ...formData, expirationDate: date })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    margin="normal"
                    error={!!formErrors.expirationDate}
                    helperText={formErrors.expirationDate || 'Leave empty for permanent announcement'}
                  />
                )}
                minDateTime={new Date()}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={submitting}
              startIcon={submitting && <CircularProgress size={20} />}
            >
              {editingAnnouncement ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Context Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleEdit}>
            <EditIcon sx={{ mr: 1 }} />
            Edit
          </MenuItem>
          <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
            <DeleteIcon sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
        >
          <DialogTitle>Delete Announcement</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{announcementToDelete?.title}"? 
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              color="error"
              variant="contained"
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default AnnouncementsPage;