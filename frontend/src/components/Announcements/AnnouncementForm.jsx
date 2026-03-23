import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Grid,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import RichTextEditor from '../common/RichTextEditor';
import { useAuth } from '../../hooks/useAuth';
import { announcementService } from '../../services/announcementService';

const AnnouncementForm = ({ 
  announcement = null, 
  onSubmit, 
  onCancel, 
  isEdit = false 
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal',
    isUrgent: false,
    publishDate: new Date(),
    expirationDate: null,
    isScheduled: false
  });

  useEffect(() => {
    if (announcement && isEdit) {
      setFormData({
        title: announcement.title || '',
        content: announcement.content || '',
        priority: announcement.priority || 'normal',
        isUrgent: announcement.isUrgent || false,
        publishDate: announcement.publishDate ? new Date(announcement.publishDate) : new Date(),
        expirationDate: announcement.expirationDate ? new Date(announcement.expirationDate) : null,
        isScheduled: announcement.publishDate ? new Date(announcement.publishDate) > new Date() : false
      });
    }
  }, [announcement, isEdit]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.content.trim()) {
      setError('Content is required');
      return;
    }

    if (formData.expirationDate && formData.publishDate >= formData.expirationDate) {
      setError('Expiration date must be after publication date');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        publishDate: formData.isScheduled ? formData.publishDate : new Date(),
        authorId: user.id
      };

      let result;
      if (isEdit && announcement) {
        result = await announcementService.updateAnnouncement(announcement.id, payload);
      } else {
        result = await announcementService.createAnnouncement(payload);
      }

      onSubmit(result);
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred while saving the announcement');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      title: '',
      content: '',
      priority: 'normal',
      isUrgent: false,
      publishDate: new Date(),
      expirationDate: null,
      isScheduled: false
    });
    setError('');
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            {isEdit ? 'Edit Announcement' : 'Create New Announcement'}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  required
                  disabled={loading}
                  inputProps={{ maxLength: 200 }}
                  helperText={`${formData.title.length}/200 characters`}
                />
              </Grid>

              <Grid item xs={12}>
                <RichTextEditor
                  value={formData.content}
                  onChange={(value) => handleInputChange('content', value)}
                  placeholder="Enter announcement content..."
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    disabled={loading}
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isUrgent}
                      onChange={(e) => handleInputChange('isUrgent', e.target.checked)}
                      disabled={loading}
                    />
                  }
                  label="Mark as Urgent (sends email notification)"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isScheduled}
                      onChange={(e) => handleInputChange('isScheduled', e.target.checked)}
                      disabled={loading}
                    />
                  }
                  label="Schedule for later publication"
                />
              </Grid>

              {formData.isScheduled && (
                <Grid item xs={12} md={6}>
                  <DateTimePicker
                    label="Publication Date"
                    value={formData.publishDate}
                    onChange={(value) => handleInputChange('publishDate', value)}
                    disabled={loading}
                    minDateTime={new Date()}
                    renderInput={(params) => (
                      <TextField {...params} fullWidth required />
                    )}
                  />
                </Grid>
              )}

              <Grid item xs={12} md={formData.isScheduled ? 6 : 12}>
                <DateTimePicker
                  label="Expiration Date (Optional)"
                  value={formData.expirationDate}
                  onChange={(value) => handleInputChange('expirationDate', value)}
                  disabled={loading}
                  minDateTime={formData.publishDate}
                  renderInput={(params) => (
                    <TextField {...params} fullWidth />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={onCancel}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  
                  {!isEdit && (
                    <Button
                      variant="outlined"
                      onClick={handleReset}
                      disabled={loading}
                    >
                      Reset
                    </Button>
                  )}

                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading || !formData.title.trim() || !formData.content.trim()}
                    startIcon={loading && <CircularProgress size={20} />}
                  >
                    {loading 
                      ? (isEdit ? 'Updating...' : 'Creating...') 
                      : (isEdit ? 'Update Announcement' : 'Create Announcement')
                    }
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </LocalizationProvider>
  );
};

AnnouncementForm.propTypes = {
  announcement: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    content: PropTypes.string,
    priority: PropTypes.string,
    isUrgent: PropTypes.bool,
    publishDate: PropTypes.string,
    expirationDate: PropTypes.string
  }),
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isEdit: PropTypes.bool
};

export default AnnouncementForm;