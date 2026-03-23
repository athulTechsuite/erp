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
  FormHelperText,
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
import DOMPurify from 'dompurify';
import { announcementService } from '../../services/announcementService';
import { fileService } from '../../services/fileService';
import { notificationService } from '../../services/notificationService';

// Synchronized with backend database CHECK constraint values
const PRIORITY_LEVELS = {
  low: { label: 'Low', color: 'default' },
  normal: { label: 'Normal', color: 'primary' },
  high: { label: 'High', color: 'warning' },
  urgent: { label: 'Urgent', color: 'error' },
};

const STATUS_TYPES = {
  draft: { label: 'Draft', color: 'default' },
  scheduled: { label: 'Scheduled', color: 'info' },
  published: { label: 'Published', color: 'success' },
  archived: { label: 'Archived', color: 'secondary' },
};

// File upload constraints
const FILE_UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TOTAL_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ],
  ALLOWED_EXTENSIONS: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.webp']
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
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal',
    publishDate: new Date(),
    isScheduled: false,
    attachments: [],
    version: null, // For optimistic locking
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

  const validateForm = () => {
    const errors = {};

    // Title validation
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters';
    } else if (formData.title.trim().length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    // Content validation
    const strippedContent = formData.content.replace(/<[^>]*>/g, '').trim();
    if (!strippedContent) {
      errors.content = 'Content is required';
    } else if (strippedContent.length < 10) {
      errors.content = 'Content must be at least 10 characters';
    }

    // Priority validation
    if (!Object.keys(PRIORITY_LEVELS).includes(formData.priority)) {
      errors.priority = 'Invalid priority level';
    }

    // Date validation for scheduled announcements
    if (formData.isScheduled) {
      if (!formData.publishDate) {
        errors.publishDate = 'Publish date is required for scheduled announcements';
      } else if (new Date(formData.publishDate) <= new Date()) {
        errors.publishDate = 'Publish date must be in the future';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateFile = (file) => {
    // Check file size
    if (file.size > FILE_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE) {
      return `File "${file.name}" exceeds maximum size of ${FILE_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024}MB`;
    }

    // Check file type
    if (!FILE_UPLOAD_CONSTRAINTS.ALLOWED_TYPES.includes(file.type)) {
      // Also check by extension as fallback
      const extension = '.' + file.name.split('.').pop().toLowerCase();
      if (!FILE_UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(extension)) {
        return `File type not allowed for "${file.name}". Allowed types: ${FILE_UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.join(', ')}`;
      }
    }

    return null;
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
      version: null,
    });
    setValidationErrors({});
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
      version: announcement.version, // For optimistic locking
    });
    setValidationErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      showSnackbar('Please fix validation errors', 'error');
      return;
    }

    if (submitting) {
      return; // Prevent double submission
    }

    try {
      setSubmitting(true);
      
      // Sanitize content before submission
      const sanitizedContent = DOMPurify.sanitize(formData.content, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a'],
        ALLOWED_ATTR: ['href', 'target'],
        ALLOW_DATA_ATTR: false
      });

      const announcementData = {
        ...formData,
        title: formData.title.trim(),
        content: sanitizedContent,
        publishDate: formData.isScheduled ? formData.publishDate : new Date(),
        status: formData.isScheduled ? 'scheduled' : 'published',
      };

      if (editingAnnouncement) {
        // Include version for optimistic locking
        announcementData.version = formData.version;
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
      if (error.code === 'VERSION_MISMATCH') {
        showSnackbar('Announcement was modified by another user. Please refresh and try again.', 'error');
      } else {
        showSnackbar('Error saving announcement', 'error');
      }
    } finally {
      setSubmitting(false);
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

    // Validate files before upload
    const validationErrors = [];
    let totalSize = formData.attachments.reduce((sum, file) => sum + (file.size || 0), 0);
    
    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        validationErrors.push(error);
        continue;
      }
      totalSize += file.size;
    }

    // Check total size limit
    if (totalSize > FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_SIZE) {
      validationErrors.push(`Total file size exceeds limit of ${FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_SIZE / 1024 / 1024}MB`);
    }

    if (validationErrors.length > 0) {
      showSnackbar(validationErrors.join('. '), 'error');
      return;
    }

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

  // Sanitize content for display
  const sanitizeContentForDisplay = (content) => {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a'],
      ALLOWED_ATTR: ['href', 'target'],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      ADD_TAGS: [],
    });
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
                  error={!!validationErrors.title}
                  helperText={validationErrors.title}
                  inputProps={{ maxLength: 200 }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth margin="normal" error={!!validationErrors.priority}>
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
                  {validationErrors.priority && (
                    <FormHelperText>{validationErrors.priority}</FormHelperText>
                  )}
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
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        fullWidth 
                        margin="normal" 
                        error={!!validationErrors.publishDate}
                        helperText={validationErrors.publishDate}
                      />
                    )}
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
                  onChange={(content) => setFormData(prev => ({ 
                    ...prev, 
                    content: DOMPurify.sanitize(content, {
                      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a'],
                      ALLOWED_ATTR: ['href', 'target'],
                      ALLOW_DATA_ATTR: false
                    })
                  }))}
                  modules={quillModules}
                  style={{ minHeight: 200 }}
                />
                {validationErrors.content && (
                  <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                    {validationErrors.content}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Attachments
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                  Max file size: {FILE_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024}MB per file, 
                  {FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_SIZE / 1024 / 1024}MB total. 
                  Allowed types: {FILE_UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.join(', ')}
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
                    accept={FILE_UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.join(',')}
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
            <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              variant="contained"
              disabled={submitting || !formData.title.trim() || !formData.content.trim()}
            >
              {submitting ? 'Saving...' : (editingAnnouncement ? 'Update' : 'Create')}
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
                  <Box 
                    dangerouslySetInnerHTML={{ 
                      __html: sanitizeContentForDisplay(selectedAnalytics.content) 
                    }} 
                    sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}
                  />
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