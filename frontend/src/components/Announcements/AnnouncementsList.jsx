import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip, 
  Divider,
  CircularProgress,
  Alert,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import { 
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Announcement as AnnouncementIcon
} from '@mui/icons-material';
import { formatDistanceToNow, isAfter, parseISO } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { announcementsApi } from '../../services/api';

const AnnouncementsList = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await announcementsApi.getAll();
      setAnnouncements(response.data);
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError('Failed to load announcements. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event, announcement) => {
    setAnchorEl(event.currentTarget);
    setSelectedAnnouncement(announcement);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAnnouncement(null);
  };

  const handleEdit = () => {
    // TODO: Navigate to edit form or open edit dialog
    console.log('Edit announcement:', selectedAnnouncement);
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAnnouncement) return;

    try {
      setDeletingId(selectedAnnouncement.id);
      await announcementsApi.delete(selectedAnnouncement.id);
      setAnnouncements(prev => prev.filter(a => a.id !== selectedAnnouncement.id));
      setDeleteDialogOpen(false);
      setSelectedAnnouncement(null);
    } catch (err) {
      console.error('Error deleting announcement:', err);
      setError('Failed to delete announcement. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectedAnnouncement(null);
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return isAfter(new Date(), parseISO(expiresAt));
  };

  const getAnnouncementStatus = (announcement) => {
    if (announcement.status === 'archived') return 'archived';
    if (isExpired(announcement.expires_at)) return 'expired';
    return 'active';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'expired': return 'warning';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const formatContent = (content) => {
    // Basic text formatting - convert line breaks to <br> tags
    return content.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Loading announcements...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <AnnouncementIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h4" component="h1" gutterBottom>
          Company Announcements
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Stay updated with the latest company news and important information
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {announcements.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <AnnouncementIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Announcements Yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Check back later for company updates and important information.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {announcements.map((announcement) => {
            const status = getAnnouncementStatus(announcement);
            
            return (
              <Card 
                key={announcement.id}
                sx={{
                  opacity: status === 'active' ? 1 : 0.7,
                  border: status === 'active' ? '2px solid' : '1px solid',
                  borderColor: status === 'active' ? 'primary.main' : 'divider'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600, flex: 1 }}>
                      {announcement.title}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={status.charAt(0).toUpperCase() + status.slice(1)}
                        color={getStatusColor(status)}
                        size="small"
                      />
                      
                      {isAdmin && (
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, announcement)}
                          sx={{ ml: 1 }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      )}
                    </Box>
                  </Box>

                  <Typography 
                    variant="body1" 
                    sx={{ mb: 3, lineHeight: 1.6 }}
                    component="div"
                  >
                    {formatContent(announcement.content)}
                  </Typography>

                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Posted {formatDistanceToNow(parseISO(announcement.created_at), { addSuffix: true })}
                      {announcement.created_by_name && ` by ${announcement.created_by_name}`}
                    </Typography>

                    {announcement.expires_at && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {isExpired(announcement.expires_at) 
                            ? `Expired ${formatDistanceToNow(parseISO(announcement.expires_at), { addSuffix: true })}`
                            : `Expires ${formatDistanceToNow(parseISO(announcement.expires_at), { addSuffix: true })}`
                          }
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Admin Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Announcement</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedAnnouncement?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            color="error"
            disabled={deletingId === selectedAnnouncement?.id}
          >
            {deletingId === selectedAnnouncement?.id ? (
              <CircularProgress size={20} />
            ) : (
              'Delete'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AnnouncementsList;