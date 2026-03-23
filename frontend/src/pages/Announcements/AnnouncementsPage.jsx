import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  Chip, 
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Fab,
  Grid,
  Skeleton,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PriorityHigh as UrgentIcon,
  Visibility as ViewIcon,
  VisibilityOff as UnreadIcon,
  Schedule as ScheduleIcon,
  Archive as ArchiveIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { announcementsApi } from '../../services/api/announcements';
import { formatDistanceToNow, format, isAfter, isBefore } from 'date-fns';
import './AnnouncementsPage.css';

const AnnouncementsPage = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  const [filter, setFilter] = useState('active'); // active, scheduled, archived, all

  const isAdmin = hasRole(['admin', 'hr_admin']);

  useEffect(() => {
    loadAnnouncements();
  }, [filter]);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await announcementsApi.getAnnouncements({ status: filter });
      setAnnouncements(response.data);
    } catch (err) {
      setError('Failed to load announcements');
      console.error('Error loading announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (announcementId) => {
    try {
      await announcementsApi.markAsRead(announcementId);
      setAnnouncements(prev => 
        prev.map(announcement => 
          announcement.id === announcementId 
            ? { ...announcement, isRead: true, unreadCount: Math.max(0, (announcement.unreadCount || 1) - 1) }
            : announcement
        )
      );
    } catch (err) {
      console.error('Error marking announcement as read:', err);
    }
  };

  const handleDelete = async () => {
    if (!announcementToDelete) return;

    try {
      await announcementsApi.deleteAnnouncement(announcementToDelete.id);
      setAnnouncements(prev => 
        prev.filter(announcement => announcement.id !== announcementToDelete.id)
      );
      setDeleteDialogOpen(false);
      setAnnouncementToDelete(null);
    } catch (err) {
      setError('Failed to delete announcement');
      console.error('Error deleting announcement:', err);
    }
  };

  const getAnnouncementStatus = (announcement) => {
    const now = new Date();
    const publishDate = new Date(announcement.publishDate);
    const expirationDate = announcement.expirationDate ? new Date(announcement.expirationDate) : null;

    if (isBefore(now, publishDate)) {
      return 'scheduled';
    }
    if (expirationDate && isAfter(now, expirationDate)) {
      return 'expired';
    }
    return 'active';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'normal': return 'default';
      default: return 'default';
    }
  };

  const getPriorityIcon = (priority) => {
    if (priority === 'urgent') {
      return <UrgentIcon fontSize="small" />;
    }
    return null;
  };

  const truncateContent = (content, maxLength = 150) => {
    const textContent = content.replace(/<[^>]*>/g, ''); // Strip HTML tags
    return textContent.length > maxLength 
      ? textContent.substring(0, maxLength) + '...'
      : textContent;
  };

  const filteredAnnouncements = announcements.filter(announcement => {
    if (filter === 'all') return true;
    return getAnnouncementStatus(announcement) === filter;
  });

  if (loading) {
    return (
      <Box className="announcements-page">
        <Box className="announcements-header">
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" width={120} height={36} />
        </Box>
        <Grid container spacing={3}>
          {[1, 2, 3].map(i => (
            <Grid item xs={12} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="100%" height={20} />
                  <Skeleton variant="text" width="80%" height={20} />
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Skeleton variant="rectangular" width={80} height={24} />
                    <Skeleton variant="rectangular" width={100} height={24} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box className="announcements-page">
      <Box className="announcements-header">
        <Typography variant="h4" component="h1" className="page-title">
          Company Announcements
        </Typography>
        
        <Box className="header-actions">
          <Box className="filter-chips">
            {['active', 'scheduled', 'archived', 'all'].map(filterOption => (
              <Chip
                key={filterOption}
                label={filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                onClick={() => setFilter(filterOption)}
                color={filter === filterOption ? 'primary' : 'default'}
                variant={filter === filterOption ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
          
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/announcements/create')}
            >
              New Announcement
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {filteredAnnouncements.length === 0 ? (
          <Grid item xs={12}>
            <Card className="empty-state">
              <CardContent>
                <Typography variant="h6" color="textSecondary" align="center">
                  No announcements found
                </Typography>
                <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 1 }}>
                  {filter === 'active' && 'There are no active announcements at the moment.'}
                  {filter === 'scheduled' && 'No announcements are scheduled for future publication.'}
                  {filter === 'archived' && 'No archived announcements found.'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredAnnouncements.map((announcement) => {
            const status = getAnnouncementStatus(announcement);
            const isUnread = !announcement.isRead;
            
            return (
              <Grid item xs={12} key={announcement.id}>
                <Card 
                  className={`announcement-card ${status} ${isUnread ? 'unread' : ''} ${announcement.priority === 'urgent' ? 'urgent' : ''}`}
                >
                  <CardContent>
                    <Box className="announcement-header">
                      <Box className="title-section">
                        <Typography 
                          variant="h6" 
                          component="h2" 
                          className="announcement-title"
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          {getPriorityIcon(announcement.priority)}
                          {isUnread && (
                            <Badge color="primary" variant="dot">
                              <span>{announcement.title}</span>
                            </Badge>
                          )}
                          {!isUnread && announcement.title}
                        </Typography>
                        
                        <Box className="announcement-meta">
                          <Typography variant="body2" color="textSecondary">
                            By {announcement.author?.name} • {format(new Date(announcement.createdAt), 'MMM dd, yyyy')}
                          </Typography>
                          {status === 'scheduled' && (
                            <Typography variant="body2" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ScheduleIcon fontSize="small" />
                              Publishes {formatDistanceToNow(new Date(announcement.publishDate), { addSuffix: true })}
                            </Typography>
                          )}
                          {announcement.expirationDate && status === 'active' && (
                            <Typography variant="body2" color="warning.main">
                              Expires {formatDistanceToNow(new Date(announcement.expirationDate), { addSuffix: true })}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      <Box className="announcement-actions">
                        {isUnread && (
                          <Tooltip title="Mark as read">
                            <IconButton
                              size="small"
                              onClick={() => handleMarkAsRead(announcement.id)}
                              color="primary"
                            >
                              <UnreadIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        <Tooltip title="View full announcement">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/announcements/${announcement.id}`)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>

                        {isAdmin && (
                          <>
                            <Tooltip title="Edit announcement">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/announcements/${announcement.id}/edit`)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            
                            <Tooltip title="Delete announcement">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {
                                  setAnnouncementToDelete(announcement);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </Box>

                    <Box className="announcement-chips">
                      <Chip
                        size="small"
                        label={announcement.priority}
                        color={getPriorityColor(announcement.priority)}
                        variant="outlined"
                      />
                      
                      <Chip
                        size="small"
                        label={status}
                        color={status === 'active' ? 'success' : status === 'scheduled' ? 'info' : 'default'}
                        variant="outlined"
                        icon={status === 'scheduled' ? <ScheduleIcon /> : status === 'expired' ? <ArchiveIcon /> : null}
                      />
                    </Box>

                    <Typography 
                      variant="body2" 
                      className="announcement-preview"
                      dangerouslySetInnerHTML={{ 
                        __html: truncateContent(announcement.content) 
                      }}
                    />

                    {announcement.tags && announcement.tags.length > 0 && (
                      <Box className="announcement-tags" sx={{ mt: 2 }}>
                        {announcement.tags.map(tag => (
                          <Chip
                            key={tag}
                            size="small"
                            label={tag}
                            variant="outlined"
                            color="default"
                          />
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })
        )}
      </Grid>

      {/* Floating Action Button for Mobile */}
      {isAdmin && (
        <Fab
          color="primary"
          aria-label="add announcement"
          className="fab-mobile"
          onClick={() => navigate('/announcements/create')}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            display: { xs: 'flex', md: 'none' }
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Announcement</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the announcement "{announcementToDelete?.title}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnnouncementsPage;