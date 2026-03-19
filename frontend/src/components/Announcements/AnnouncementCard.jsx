import React from 'react';
import { Card, CardContent, Typography, Box, Chip, IconButton, Menu, MenuItem } from '@mui/material';
import { MoreVert as MoreVertIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';

const AnnouncementCard = ({ 
  announcement, 
  isAdmin = false, 
  onEdit, 
  onDelete,
  showActions = false 
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    onEdit(announcement);
  };

  const handleDelete = () => {
    handleMenuClose();
    onDelete(announcement);
  };

  const formatContent = (content) => {
    return content.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const getExpirationStatus = () => {
    if (!announcement.expiresAt) return null;
    
    const expirationDate = parseISO(announcement.expiresAt);
    const now = new Date();
    
    if (expirationDate <= now) {
      return { status: 'expired', label: 'Expired', color: 'error' };
    }
    
    const daysUntilExpiration = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiration <= 7) {
      return { 
        status: 'expiring', 
        label: `Expires in ${daysUntilExpiration} day${daysUntilExpiration === 1 ? '' : 's'}`, 
        color: 'warning' 
      };
    }
    
    return null;
  };

  const expirationStatus = getExpirationStatus();

  return (
    <Card 
      sx={{ 
        mb: 2, 
        boxShadow: 2,
        '&:hover': {
          boxShadow: 3,
        },
        opacity: expirationStatus?.status === 'expired' ? 0.6 : 1
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Typography 
            variant="h6" 
            component="h3" 
            sx={{ 
              fontWeight: 600,
              flex: 1,
              pr: showActions ? 1 : 0
            }}
          >
            {announcement.title}
          </Typography>
          
          {showActions && isAdmin && (
            <>
              <IconButton
                size="small"
                onClick={handleMenuClick}
                sx={{ ml: 1 }}
              >
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem onClick={handleEdit}>
                  <EditIcon sx={{ mr: 1, fontSize: 20 }} />
                  Edit
                </MenuItem>
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                  <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
                  Delete
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>

        <Typography 
          variant="body1" 
          color="text.primary" 
          sx={{ 
            mb: 2,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap'
          }}
        >
          {formatContent(announcement.content)}
        </Typography>

        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Typography variant="body2" color="text.secondary">
            {announcement.createdBy && `By ${announcement.createdBy} • `}
            {formatDistanceToNow(parseISO(announcement.createdAt), { addSuffix: true })}
          </Typography>

          {expirationStatus && (
            <Chip
              label={expirationStatus.label}
              color={expirationStatus.color}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {announcement.updatedAt && announcement.updatedAt !== announcement.createdAt && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Last updated {formatDistanceToNow(parseISO(announcement.updatedAt), { addSuffix: true })}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default AnnouncementCard;