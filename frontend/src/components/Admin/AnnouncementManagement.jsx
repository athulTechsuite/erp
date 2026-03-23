import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
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
  Alert,
  Snackbar,
  Grid,
  Switch,
  FormControlLabel,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  AttachFile as AttachIcon,
  Schedule as ScheduleIcon,
  Analytics as AnalyticsIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { announcementService } from '../../services/announcementService';
import { fileService } from '../../services/fileService';
import { notificationService } from '../../services/notificationService';

const PRIORITY_LEVELS = {
  normal: { label: 'Normal', color: 'default' },
  important: { label: 'Important', color: 'warning' },
  urgent: { label: 'Urgent', color: 'error' },
};

const STATUS_TYPES = {
  draft: { label: 'Draft', color: 'default' },
  scheduled: { label: 'Scheduled', color: 'info' },
  published: { label: 'Published', color: 'success' },
  archived: { label: 'Archived', color: 'secondary' },
};

const AnnouncementManagement = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [selectedAnalytics, setSelectedAnalytics] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal',
    publishDate: new Date(),
    isScheduled: false,
    attachments: [],
  });

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, [filterStatus, filterPriority]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterStatus !== 'all') filters.status = filterStatus;
      if (filterPriority !== 'all') filters.priority = filterPriority;
      
      const data = await announcementService.getAnnouncements(filters);
      setAnnouncements(data);
    } catch (error) {
      showSnackbar('Error fetching announcements', 'error');
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
      isScheduled: false,
      attachments: [],
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
      isScheduled: announcement.status === 'scheduled',
      attachments: announcement.attachments || [],
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const announcementData = {
        ...formData,
        publishDate: formData.isScheduled ? formData.publishDate : new Date(),
        status: formData.isScheduled ? 'scheduled' : 'published',
      };

      if (editingAnnouncement) {
        await announcementService.updateAnnouncement(editingAnnouncement.id, announcementData);
        showSnackbar('Announcement updated successfully');
      } else {
        const newAnnouncement = await announcementService.createAnnouncement(announcementData);
        
        // Send notifications for urgent announcements
        if (announcementData.priority === 'urgent' && announcementData.status === 'published') {
          await notificationService.sendUrgentAnnouncementNotification(newAnnouncement.id);
        }
        
        showSnackbar('Announcement created successfully');
      }

      setDialogOpen(false);
      fetchAnnouncements();
    } catch (error) {
      showSnackbar('Error saving announcement', 'error');
    }
  };

  const handleDeleteAnnouncement = async () => {
    try {
      await announcementService.deleteAnnouncement(announcementToDelete.id);
      showSnackbar('Announcement deleted successfully');
      setDeleteDialogOpen(false);
      setAnnouncementToDelete(null);
      fetchAnnouncements();
    } catch (error) {
      showSnackbar('Error deleting announcement', 'error');
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadPromises = files.map(file => 
        fileService.uploadFile(file, {
          onProgress: (progress) => setUploadProgress(progress),
        })
      );

      const uploadedFiles = await Promise.all(uploadPromises);
      
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedFiles],
      }));

      showSnackbar(`${files.length} file(s) uploaded successfully`);
    } catch (error) {
      showSnackbar('Error uploading files', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveAttachment = (attachmentIndex) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, index) => index !== attachmentIndex),
    }));
  };

  const handleViewAnalytics = async (announcement) => {
    try {
      const analytics = await announcementService.getAnnouncementAnalytics(announcement.id);
      setSelectedAnalytics({ ...announcement, analytics });
      setAnalyticsDialogOpen(true);
    } catch (error) {
      showSnackbar('Error fetching analytics', 'error');
    }
  };

  const handleArchiveAnnouncement = async (announcementId) => {
    try {
      await announcementService.archiveAnnouncement(announcementId);
      showSnackbar('Announcement archived successfully');
      fetchAnnouncements();
    } catch (error) {
      showSnackbar('Error archiving announcement', 'error');
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getReadPercentage = (readCount, totalEmployees) => {
    return totalEmployees > 0 ? Math.round((readCount / totalEmployees) * 100) : 0;
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link', 'blockquote', 'code-block'],
      ['clean']
    ],
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Announcement Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateAnnouncement}
          >
            Create Announcement
          </Button>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filterStatus}
                    label="Status"
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <MenuItem value="all">All Statuses</MenuItem>
                    {Object.entries(STATUS_TYPES).map(([key, { label }]) => (
                      <MenuItem key={key} value={key}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filterPriority}
                    label="Priority"
                    onChange={(e) => setFilterPriority(e.target.value)}
                  >
                    <MenuItem value="all">All Priorities</MenuItem>
                    {Object.entries(PRIORITY_LEVELS).map(([key, { label }]) => (
                      <MenuItem key={key} value={key}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Announcements Table */}
        <Card>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Publish Date</TableCell>
                  <TableCell>Read Rate</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography>Loading announcements...</Typography>
                    </TableCell>
                  </TableRow>
                ) : announcements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="textSecondary">No announcements found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  announcements.map((announcement) => (
                    <TableRow key={announcement.id}>
                      <TableCell>
                        <Typography variant="subtitle2">{announcement.title}</Typography>
                        {announcement.attachments?.length > 0 && (
                          <Chip
                            size="small"
                            icon={<AttachIcon />}
                            label={`${announcement.attachments.length} file(s)`}
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={PRIORITY_LEVELS[announcement.priority].label}
                          color={PRIORITY_LEVELS[announcement.priority].color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_TYPES[announcement.status].label}
                          color={STATUS_TYPES[announcement.status].color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {announcement.status === 'scheduled' && <ScheduleIcon fontSize="small" />}
                          {formatDate(announcement.publishDate)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">
                            {getReadPercentage(announcement.readCount, announcement.totalEmployees)}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={getReadPercentage(announcement.readCount, announcement.totalEmployees)}
                            sx={{ width: 60, height: 6, borderRadius: 3 }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="View Analytics">
                            <IconButton
                              size="small"
                              onClick={() => handleViewAnalytics(announcement)}
                            >
                              <AnalyticsIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => handleEditAnnouncement(announcement)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          {announcement.status !== 'archived' && (
                            <Tooltip title="Archive">
                              <IconButton
                                size="small"
                                onClick={() => handleArchiveAnnouncement(announcement.id)}
                              >
                                <ArchiveIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete">
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
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog 
          open={dialogOpen} 
          onClose={() => setDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  margin="normal"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    {Object.entries(PRIORITY_LEVELS).map(([key, { label }]) => (
                      <MenuItem key={key} value={key}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isScheduled}
                      onChange={(e) => setFormData(prev => ({ ...prev, isScheduled: e.target.checked }))}
                    />
                  }
                  label="Schedule for later"
                  sx={{ mt: 2 }}
                />
              </Grid>

              {formData.isScheduled && (
                <Grid item xs={12}>
                  <DateTimePicker
                    label="Publish Date"
                    value={formData.publishDate}
                    onChange={(date) => setFormData(prev => ({ ...prev, publishDate: date }))}
                    renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
                    minDateTime={new Date()}
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Content
                </Typography>
                <ReactQuill
                  theme="snow"
                  value={formData.content}
                  onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                  modules={quillModules}
                  style={{ minHeight: 200 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Attachments
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<AttachIcon />}
                  disabled={isUploading}
                  sx={{ mb: 2 }}
                >
                  Upload Files
                  <input
                    type="file"
                    hidden
                    multiple
                    onChange={handleFileUpload}
                  />
                </Button>

                {isUploading && (
                  <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 2 }} />
                )}

                {formData.attachments.map((attachment, index) => (
                  <Chip
                    key={index}
                    label={attachment.name}
                    onDelete={() => handleRemoveAttachment(index)}
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSubmit}
              variant="contained"
              disabled={!formData.title.trim() || !formData.content.trim()}
            >
              {editingAnnouncement ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Announcement</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{announcementToDelete?.title}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteAnnouncement} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Analytics Dialog */}
        <Dialog 
          open={analyticsDialogOpen} 
          onClose={() => setAnalyticsDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Announcement Analytics</DialogTitle>
          <DialogContent>
            {selectedAnalytics && (
              <Grid container spacing={2} sx={{ pt: 1 }}>
                <Grid item xs={12}>
                  <Typography variant="h6">{selectedAnalytics.title}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Total Employees</Typography>
                  <Typography variant="h4">{selectedAnalytics.analytics.totalEmployees}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Read Count</Typography>
                  <Typography variant="h4">{selectedAnalytics.analytics.readCount}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary">Read Percentage</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={getReadPercentage(
                      selectedAnalytics.analytics.readCount,
                      selectedAnalytics.analytics.totalEmployees
                    )}
                    sx={{ height: 8, borderRadius: 4, mb: 1 }}
                  />
                  <Typography variant="h5">
                    {getReadPercentage(
                      selectedAnalytics.analytics.readCount,
                      selectedAnalytics.analytics.totalEmployees
                    )}%
                  </Typography>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAnalyticsDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          <Alert 
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
            severity={snackbar.severity}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default AnnouncementManagement;