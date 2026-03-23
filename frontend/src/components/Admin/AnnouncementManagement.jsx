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
  Alert,
  Snackbar,
  Grid,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Analytics as AnalyticsIcon,
  Archive as ArchiveIcon,
  AttachFile as AttachIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DOMPurify from 'dompurify';
import { announcementService } from '../../services/announcementService';
import { notificationService } from '../../services/notificationService';
import AnnouncementDialog from './components/AnnouncementDialog';
import DeleteConfirmationDialog from './components/DeleteConfirmationDialog';
import AnalyticsDialog from './components/AnalyticsDialog';
import { PRIORITY_LEVELS, STATUS_TYPES } from '../../config/announcementConstants';
import { FILE_UPLOAD_CONSTRAINTS } from '../../config/fileUploadConfig';

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
    setDialogOpen(true);
  };

  const handleEditAnnouncement = (announcement) => {
    setEditingAnnouncement(announcement);
    setDialogOpen(true);
  };

  const handleSaveAnnouncement = async (announcementData) => {
    try {
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
      return true;
    } catch (error) {
      if (error.code === 'VERSION_MISMATCH') {
        showSnackbar('Announcement was modified by another user. Please refresh and try again.', 'error');
      } else {
        showSnackbar('Error saving announcement', 'error');
      }
      return false;
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
        <AnnouncementDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={handleSaveAnnouncement}
          editingAnnouncement={editingAnnouncement}
          onShowSnackbar={showSnackbar}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleDeleteAnnouncement}
          announcementTitle={announcementToDelete?.title}
        />

        {/* Analytics Dialog */}
        <AnalyticsDialog
          open={analyticsDialogOpen}
          onClose={() => setAnalyticsDialogOpen(false)}
          selectedAnalytics={selectedAnalytics}
        />

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