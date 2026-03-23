import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Pagination,
  Stack,
  IconButton,
  Badge,
  Tooltip,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Edit,
  Delete,
  Schedule,
  AttachFile,
  Notifications,
  NotificationsActive,
  Archive
} from '@mui/icons-material';
import { format, formatDistanceToNow, isAfter, isBefore } from 'date-fns';
import {
  fetchAnnouncements,
  markAnnouncementAsRead,
  markAnnouncementAsUnread,
  deleteAnnouncement,
  selectAnnouncements,
  selectAnnouncementsLoading,
  selectAnnouncementsError,
  selectAnnouncementsPagination
} from '../../store/slices/announcementsSlice';
import { selectCurrentUser } from '../../store/slices/authSlice';
import AnnouncementModal from './AnnouncementModal';
import AnnouncementForm from './AnnouncementForm';
import ConfirmDialog from '../Common/ConfirmDialog';

const PRIORITY_COLORS = {
  normal: 'default',
  important: 'warning',
  urgent: 'error'
};

const PRIORITY_ICONS = {
  normal: <Notifications />,
  important: <NotificationsActive />,
  urgent: <NotificationsActive />
};

const AnnouncementsList = () => {
  const dispatch = useDispatch();
  const announcements = useSelector(selectAnnouncements);
  const loading = useSelector(selectAnnouncementsLoading);
  const error = useSelector(selectAnnouncementsError);
  const pagination = useSelector(selectAnnouncementsPagination);
  const currentUser = useSelector(selectCurrentUser);

  const [filters, setFilters] = useState({
    priority: '',
    status: 'all', // all, read, unread, scheduled, published, archived
    search: ''
  });
  const [page, setPage] = useState(1);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'company_admin';

  const loadAnnouncements = useCallback(() => {
    const queryParams = {
      page,
      limit: 10,
      ...filters
    };
    dispatch(fetchAnnouncements(queryParams));
  }, [dispatch, page, filters]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleFilterChange = (field) => (event) => {
    setFilters(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setPage(1); // Reset to first page when filtering
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleAnnouncementClick = (announcement) => {
    setSelectedAnnouncement(announcement);
    setIsModalOpen(true);
    
    // Mark as read if unread
    if (!announcement.isRead && !isAdmin) {
      dispatch(markAnnouncementAsRead(announcement.id));
    }
  };

  const handleToggleReadStatus = (announcement, event) => {
    event.stopPropagation();
    if (announcement.isRead) {
      dispatch(markAnnouncementAsUnread(announcement.id));
    } else {
      dispatch(markAnnouncementAsRead(announcement.id));
    }
  };

  const handleEdit = (announcement, event) => {
    event.stopPropagation();
    setEditingAnnouncement(announcement);
    setIsFormOpen(true);
  };

  const handleDelete = (announcementId, event) => {
    event.stopPropagation();
    setDeleteConfirm({ open: true, id: announcementId });
  };

  const confirmDelete = () => {
    dispatch(deleteAnnouncement(deleteConfirm.id));
    setDeleteConfirm({ open: false, id: null });
  };

  const getAnnouncementStatus = (announcement) => {
    const now = new Date();
    const publishDate = new Date(announcement.publishedAt);
    const isArchived = announcement.archivedAt;

    if (isArchived) return 'archived';
    if (isAfter(publishDate, now)) return 'scheduled';
    return 'published';
  };

  const getStatusChip = (announcement) => {
    const status = getAnnouncementStatus(announcement);
    const statusConfig = {
      scheduled: { label: 'Scheduled', color: 'info' },
      published: { label: 'Published', color: 'success' },
      archived: { label: 'Archived', color: 'default' }
    };

    return (
      <Chip
        label={statusConfig[status].label}
        color={statusConfig[status].color}
        size="small"
        icon={status === 'scheduled' ? <Schedule /> : status === 'archived' ? <Archive /> : null}
      />
    );
  };

  const formatPublishDate = (date) => {
    const publishDate = new Date(date);
    const now = new Date();

    if (isAfter(publishDate, now)) {
      return `Scheduled for ${format(publishDate, 'MMM dd, yyyy')}`;
    }
    return formatDistanceToNow(publishDate, { addSuffix: true });
  };

  if (loading && announcements.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Company Announcements
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => setIsFormOpen(true)}
          >
            Create Announcement
          </Button>
        )}
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Search announcements"
              value={filters.search}
              onChange={handleFilterChange('search')}
              variant="outlined"
              size="small"
              sx={{ flex: 1 }}
            />
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={filters.priority}
                label="Priority"
                onChange={handleFilterChange('priority')}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="important">Important</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                label="Status"
                onChange={handleFilterChange('status')}
              >
                <MenuItem value="all">All</MenuItem>
                {!isAdmin && (
                  <>
                    <MenuItem value="read">Read</MenuItem>
                    <MenuItem value="unread">Unread</MenuItem>
                  </>
                )}
                {isAdmin && (
                  <>
                    <MenuItem value="published">Published</MenuItem>
                    <MenuItem value="scheduled">Scheduled</MenuItem>
                    <MenuItem value="archived">Archived</MenuItem>
                  </>
                )}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Announcements List */}
      <Stack spacing={2}>
        {announcements.map((announcement) => (
          <Card
            key={announcement.id}
            sx={{
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4
              },
              opacity: announcement.isRead && !isAdmin ? 0.8 : 1,
              borderLeft: `4px solid ${
                announcement.priority === 'urgent' ? '#f44336' :
                announcement.priority === 'important' ? '#ff9800' : 'transparent'
              }`
            }}
            onClick={() => handleAnnouncementClick(announcement)}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box flex={1}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Typography variant="h6" component="h2">
                      {announcement.title}
                    </Typography>
                    {!announcement.isRead && !isAdmin && (
                      <Badge color="primary" variant="dot" />
                    )}
                  </Box>
                  
                  <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                    <Chip
                      label={announcement.priority}
                      color={PRIORITY_COLORS[announcement.priority]}
                      size="small"
                      icon={PRIORITY_ICONS[announcement.priority]}
                    />
                    {getStatusChip(announcement)}
                    {announcement.attachments && announcement.attachments.length > 0 && (
                      <Chip
                        icon={<AttachFile />}
                        label={`${announcement.attachments.length} file${announcement.attachments.length > 1 ? 's' : ''}`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      mb: 1
                    }}
                  >
                    {announcement.content.replace(/<[^>]*>/g, '')} {/* Strip HTML tags for preview */}
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    {formatPublishDate(announcement.publishedAt)} • By {announcement.author.name}
                    {isAdmin && announcement.readCount !== undefined && (
                      <> • {announcement.readCount} of {announcement.totalEmployees} employees read</>
                    )}
                  </Typography>
                </Box>
              </Box>
            </CardContent>

            {(isAdmin || !isAdmin) && (
              <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                {!isAdmin && (
                  <Tooltip title={announcement.isRead ? 'Mark as unread' : 'Mark as read'}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleToggleReadStatus(announcement, e)}
                    >
                      {announcement.isRead ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </Tooltip>
                )}
                
                {isAdmin && (
                  <>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={(e) => handleEdit(announcement, e)}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => handleDelete(announcement.id, e)}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </CardActions>
            )}
          </Card>
        ))}
      </Stack>

      {/* Empty State */}
      {announcements.length === 0 && !loading && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No announcements found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isAdmin ? 'Create your first announcement to get started!' : 'Check back later for company updates.'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={pagination.totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            size="large"
          />
        </Box>
      )}

      {/* Modals */}
      <AnnouncementModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAnnouncement(null);
        }}
        announcement={selectedAnnouncement}
      />

      <AnnouncementForm
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingAnnouncement(null);
        }}
        announcement={editingAnnouncement}
        onSuccess={() => {
          loadAnnouncements();
          setIsFormOpen(false);
          setEditingAnnouncement(null);
        }}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Announcement"
        message="Are you sure you want to delete this announcement? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
        confirmText="Delete"
        cancelText="Cancel"
        severity="error"
      />
    </Box>
  );
};

export default AnnouncementsList;