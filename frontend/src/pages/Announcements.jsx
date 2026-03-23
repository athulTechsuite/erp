import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Typography, 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Chip, 
  Box, 
  IconButton, 
  Menu, 
  MenuItem as MenuItemComponent,
  Fab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Tooltip,
  Alert,
  LinearProgress,
  Avatar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Schedule as ScheduleIcon,
  PriorityHigh as UrgentIcon,
  Warning as ImportantIcon,
  Info as NormalIcon,
  Visibility as ReadIcon,
  VisibilityOff as UnreadIcon,
  Archive as ArchiveIcon,
  AttachFile as AttachFileIcon,
  GetApp as DownloadIcon,
  Notifications as NotificationIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { announcementService } from '../services/announcementService';
import { formatDistanceToNow } from 'date-fns';
import RichTextEditor from '../components/RichTextEditor';

const PRIORITY_LEVELS = {
  normal: { label: 'Normal', color: 'default', icon: NormalIcon },
  important: { label: 'Important', color: 'warning', icon: ImportantIcon },
  urgent: { label: 'Urgent', color: 'error', icon: UrgentIcon }
};

const Announcements = () => {
  const { user, hasRole } = useAuth();
  const { showNotification } = useNotification();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [selectedAnnouncementStats, setSelectedAnnouncementStats] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal',
    publishDate: new Date(),
    attachments: []
  });

  const isAdmin = hasRole('admin') || hasRole('company_admin');

  useEffect(() => {
    fetchAnnouncements();
  }, [showArchived]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await announcementService.getAnnouncements({ 
        includeArchived: showArchived 
      });
      setAnnouncements(data);
    } catch (error) {
      showNotification('Failed to fetch announcements', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = () => {
    setEditingAnnouncement(null);
    setFormData({
      title: '',
      content: '',
      priority: 'normal',
      publishDate: new Date(),
      attachments: []
    });
    setDialogOpen(true);
  };

  const handleEditAnnouncement = (announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      publishDate: new Date(announcement.publishDate),
      attachments: announcement.attachments || []
    });
    setDialogOpen(true);
    handleCloseMenu();
  };

  const handleSubmitAnnouncement = async () => {
    try {
      const payload = {
        ...formData,
        publishDate: formData.publishDate.toISOString()
      };

      if (editingAnnouncement) {
        await announcementService.updateAnnouncement(editingAnnouncement.id, payload);
        showNotification('Announcement updated successfully', 'success');
      } else {
        await announcementService.createAnnouncement(payload);
        showNotification('Announcement created successfully', 'success');
      }

      setDialogOpen(false);
      fetchAnnouncements();
    } catch (error) {
      showNotification('Failed to save announcement', 'error');
    }
  };

  const handleDeleteAnnouncement = async () => {
    try {
      await announcementService.deleteAnnouncement(announcementToDelete.id);
      showNotification('Announcement deleted successfully', 'success');
      setDeleteDialogOpen(false);
      setAnnouncementToDelete(null);
      fetchAnnouncements();
    } catch (error) {
      showNotification('Failed to delete announcement', 'error');
    }
  };

  const handleMarkAsRead = async (announcementId) => {
    try {
      await announcementService.markAsRead(announcementId);
      fetchAnnouncements();
    } catch (error) {
      showNotification('Failed to mark as read', 'error');
    }
  };

  const handleMarkAsUnread = async (announcementId) => {
    try {
      await announcementService.markAsUnread(announcementId);
      fetchAnnouncements();
    } catch (error) {
      showNotification('Failed to mark as unread', 'error');
    }
  };

  const handleFileUpload = async (files) => {
    try {
      const uploadPromises = Array.from(files).map(file => 
        announcementService.uploadAttachment(file)
      );
      const uploadedFiles = await Promise.all(uploadPromises);
      
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedFiles]
      }));
    } catch (error) {
      showNotification('Failed to upload files', 'error');
    }
  };

  const handleRemoveAttachment = (attachmentId) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== attachmentId)
    }));
  };

  const handleShowStats = async (announcement) => {
    try {
      const stats = await announcementService.getAnnouncementStats(announcement.id);
      setSelectedAnnouncementStats({ ...announcement, stats });
      setStatsDialogOpen(true);
      handleCloseMenu();
    } catch (error) {
      showNotification('Failed to fetch announcement statistics', 'error');
    }
  };

  const handleOpenMenu = (event, announcement) => {
    setMenuAnchor(event.currentTarget);
    setSelectedAnnouncement(announcement);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
    setSelectedAnnouncement(null);
  };

  const getPriorityIcon = (priority) => {
    const PriorityIcon = PRIORITY_LEVELS[priority].icon;
    return <PriorityIcon />;
  };

  const getPriorityColor = (priority) => {
    return PRIORITY_LEVELS[priority].color;
  };

  const isScheduled = (publishDate) => {
    return new Date(publishDate) > new Date();
  };

  const isArchived = (createdDate) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return new Date(createdDate) < sixMonthsAgo;
  };

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Company Announcements
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setShowArchived(!showArchived)}
              startIcon={<ArchiveIcon />}
            >
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </Button>
            {isAdmin && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateAnnouncement}
              >
                New Announcement
              </Button>
            )}
          </Box>
        </Box>

        {announcements.length === 0 ? (
          <Alert severity="info">
            No announcements available.
          </Alert>
        ) : (
          <List>
            {announcements.map((announcement, index) => (
              <React.Fragment key={announcement.id}>
                <ListItem
                  sx={{
                    bgcolor: announcement.isRead ? 'background.paper' : 'action.hover',
                    borderRadius: 1,
                    mb: 1,
                    border: announcement.priority === 'urgent' ? '2px solid' : '1px solid',
                    borderColor: announcement.priority === 'urgent' ? 'error.main' : 'divider'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                    <Box sx={{ mr: 2, mt: 1 }}>
                      <Chip
                        icon={getPriorityIcon(announcement.priority)}
                        label={PRIORITY_LEVELS[announcement.priority].label}
                        color={getPriorityColor(announcement.priority)}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                          {announcement.title}
                          {isScheduled(announcement.publishDate) && (
                            <Chip
                              icon={<ScheduleIcon />}
                              label="Scheduled"
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                          {!announcement.isRead && (
                            <Badge color="primary" variant="dot" sx={{ ml: 1 }} />
                          )}
                        </Typography>
                        
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
                          {formatDistanceToNow(new Date(announcement.createdDate), { addSuffix: true })}
                        </Typography>
                        
                        {isAdmin && (
                          <IconButton
                            onClick={(e) => handleOpenMenu(e, announcement)}
                            size="small"
                          >
                            <MoreVertIcon />
                          </IconButton>
                        )}
                      </Box>
                      
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ mb: 2 }}
                        dangerouslySetInnerHTML={{ __html: announcement.content }}
                      />
                      
                      {announcement.attachments && announcement.attachments.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                          {announcement.attachments.map((attachment) => (
                            <Chip
                              key={attachment.id}
                              icon={<AttachFileIcon />}
                              label={attachment.name}
                              size="small"
                              onClick={() => window.open(attachment.url, '_blank')}
                              clickable
                            />
                          ))}
                        </Box>
                      )}
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 24, height: 24 }}>
                          {announcement.author.name.charAt(0)}
                        </Avatar>
                        <Typography variant="caption" color="text.secondary">
                          {announcement.author.name}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <Tooltip title={announcement.isRead ? 'Mark as unread' : 'Mark as read'}>
                        <IconButton
                          onClick={() => announcement.isRead 
                            ? handleMarkAsUnread(announcement.id) 
                            : handleMarkAsRead(announcement.id)
                          }
                          size="small"
                        >
                          {announcement.isRead ? <ReadIcon /> : <UnreadIcon />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </ListItem>
                {index < announcements.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Admin Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleCloseMenu}
        >
          <MenuItemComponent
            onClick={() => handleEditAnnouncement(selectedAnnouncement)}
          >
            <EditIcon sx={{ mr: 1 }} />
            Edit
          </MenuItemComponent>
          <MenuItemComponent
            onClick={() => handleShowStats(selectedAnnouncement)}
          >
            <NotificationIcon sx={{ mr: 1 }} />
            View Statistics
          </MenuItemComponent>
          <MenuItemComponent
            onClick={() => {
              setAnnouncementToDelete(selectedAnnouncement);
              setDeleteDialogOpen(true);
              handleCloseMenu();
            }}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1 }} />
            Delete
          </MenuItemComponent>
        </Menu>

        {/* Create/Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
              <TextField
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                fullWidth
                required
              />
              
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  label="Priority"
                >
                  {Object.entries(PRIORITY_LEVELS).map(([key, value]) => (
                    <MenuItem key={key} value={key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {React.createElement(value.icon)}
                        {value.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <DateTimePicker
                label="Publish Date"
                value={formData.publishDate}
                onChange={(date) => setFormData({ ...formData, publishDate: date })}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
              
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Content
                </Typography>
                <RichTextEditor
                  value={formData.content}
                  onChange={(content) => setFormData({ ...formData, content })}
                />
              </Box>
              
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Attachments
                </Typography>
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files)}
                  style={{ display: 'none' }}
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<AttachFileIcon />}
                    sx={{ mb: 2 }}
                  >
                    Add Files
                  </Button>
                </label>
                
                {formData.attachments.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {formData.attachments.map((attachment) => (
                      <Chip
                        key={attachment.id}
                        label={attachment.name}
                        onDelete={() => handleRemoveAttachment(attachment.id)}
                        icon={<AttachFileIcon />}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAnnouncement}
              variant="contained"
              disabled={!formData.title || !formData.content}
            >
              {editingAnnouncement ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the announcement "{announcementToDelete?.title}"?
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAnnouncement}
              variant="contained"
              color="error"
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Statistics Dialog */}
        <Dialog
          open={statsDialogOpen}
          onClose={() => setStatsDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Announcement Statistics: {selectedAnnouncementStats?.title}
          </DialogTitle>
          <DialogContent>
            {selectedAnnouncementStats && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Total Employees:</Typography>
                  <Typography fontWeight="bold">
                    {selectedAnnouncementStats.stats.totalEmployees}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Read:</Typography>
                  <Typography fontWeight="bold" color="success.main">
                    {selectedAnnouncementStats.stats.readCount}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Unread:</Typography>
                  <Typography fontWeight="bold" color="warning.main">
                    {selectedAnnouncementStats.stats.unreadCount}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>Read Rate:</Typography>
                  <Typography fontWeight="bold">
                    {((selectedAnnouncementStats.stats.readCount / selectedAnnouncementStats.stats.totalEmployees) * 100).toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(selectedAnnouncementStats.stats.readCount / selectedAnnouncementStats.stats.totalEmployees) * 100}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatsDialogOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Announcements;