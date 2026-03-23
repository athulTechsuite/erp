import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  Card, 
  CardContent, 
  CardActions, 
  Typography, 
  Chip, 
  IconButton, 
  Collapse, 
  Box, 
  Avatar,
  Tooltip,
  Button
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  AttachFile as AttachFileIcon,
  PriorityHigh as PriorityHighIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const ExpandMore = styled((props) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
}));

const PriorityChip = styled(Chip)(({ theme, priority }) => ({
  ...(priority === 'urgent' && {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    animation: 'pulse 2s infinite',
  }),
  ...(priority === 'important' && {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  }),
  ...(priority === 'normal' && {
    backgroundColor: theme.palette.info.main,
    color: theme.palette.info.contrastText,
  }),
  '@keyframes pulse': {
    '0%': {
      opacity: 1,
    },
    '50%': {
      opacity: 0.7,
    },
    '100%': {
      opacity: 1,
    },
  },
}));

const UnreadIndicator = styled(Box)(({ theme }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  position: 'absolute',
  top: 16,
  right: 16,
}));

const AnnouncementCard = ({
  announcement,
  isAdmin = false,
  isRead = false,
  onEdit,
  onDelete,
  onMarkAsRead,
  onViewStats,
  showStats = false
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
    if (!isRead && !expanded) {
      onMarkAsRead?.(announcement.id);
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent':
        return <PriorityHighIcon fontSize="small" />;
      case 'important':
        return <WarningIcon fontSize="small" />;
      default:
        return <InfoIcon fontSize="small" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'important':
        return 'warning';
      default:
        return 'info';
    }
  };

  const isScheduled = new Date(announcement.publishedAt) > new Date();
  const isArchived = announcement.status === 'archived';

  return (
    <Card 
      sx={{ 
        mb: 2, 
        position: 'relative',
        opacity: isArchived ? 0.6 : 1,
        border: announcement.priority === 'urgent' && !isRead ? '2px solid' : 'none',
        borderColor: announcement.priority === 'urgent' && !isRead ? 'error.main' : 'transparent'
      }}
      elevation={announcement.priority === 'urgent' && !isRead ? 4 : 1}
    >
      {!isRead && !isAdmin && <UnreadIndicator />}
      
      <CardContent>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={1}>
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                {announcement.title}
              </Typography>
              <PriorityChip
                priority={announcement.priority}
                size="small"
                icon={getPriorityIcon(announcement.priority)}
                label={announcement.priority.toUpperCase()}
                color={getPriorityColor(announcement.priority)}
              />
              {isScheduled && (
                <Chip
                  size="small"
                  label="Scheduled"
                  variant="outlined"
                  color="secondary"
                />
              )}
              {isArchived && (
                <Chip
                  size="small"
                  label="Archived"
                  variant="outlined"
                  color="default"
                />
              )}
            </Box>
            
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Avatar sx={{ width: 32, height: 32 }} src={announcement.author?.avatar}>
                {announcement.author?.name?.[0]}
              </Avatar>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {announcement.author?.name || 'System'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isScheduled ? (
                    `Scheduled for ${format(new Date(announcement.publishedAt), 'MMM d, yyyy HH:mm')}`
                  ) : (
                    `${formatDistanceToNow(new Date(announcement.publishedAt))} ago`
                  )}
                </Typography>
              </Box>
            </Box>

            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: expanded ? 'none' : 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {announcement.content.substring(0, expanded ? announcement.content.length : 200)}
              {!expanded && announcement.content.length > 200 && '...'}
            </Typography>

            {announcement.attachments && announcement.attachments.length > 0 && (
              <Box display="flex" alignItems="center" gap={1} mt={1}>
                <AttachFileIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  {announcement.attachments.length} attachment{announcement.attachments.length > 1 ? 's' : ''}
                </Typography>
              </Box>
            )}

            {showStats && isAdmin && (
              <Box mt={2} p={1} bgcolor="grey.50" borderRadius={1}>
                <Typography variant="caption" color="text.secondary">
                  Read by {announcement.readCount || 0} of {announcement.totalEmployees || 0} employees
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardContent sx={{ pt: 0 }}>
          <Typography 
            variant="body1"
            dangerouslySetInnerHTML={{ __html: announcement.content }}
            sx={{ 
              '& img': { maxWidth: '100%', height: 'auto' },
              '& a': { color: 'primary.main' }
            }}
          />
          
          {announcement.attachments && announcement.attachments.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Attachments:
              </Typography>
              {announcement.attachments.map((attachment, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  size="small"
                  startIcon={<AttachFileIcon />}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ mr: 1, mb: 1 }}
                >
                  {attachment.name}
                </Button>
              ))}
            </Box>
          )}
        </CardContent>
      </Collapse>

      <CardActions disableSpacing>
        <ExpandMore
          expand={expanded}
          onClick={handleExpandClick}
          aria-expanded={expanded}
          aria-label="show more"
        >
          <ExpandMoreIcon />
        </ExpandMore>

        {isAdmin && (
          <Box display="flex" gap={1} ml="auto">
            {onViewStats && (
              <Tooltip title="View Statistics">
                <IconButton size="small" onClick={() => onViewStats(announcement)}>
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="Edit Announcement">
              <IconButton 
                size="small" 
                onClick={() => onEdit?.(announcement)}
                disabled={isArchived}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Delete Announcement">
              <IconButton 
                size="small" 
                onClick={() => onDelete?.(announcement.id)}
                color="error"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </CardActions>
    </Card>
  );
};

AnnouncementCard.propTypes = {
  announcement: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    priority: PropTypes.oneOf(['normal', 'important', 'urgent']).isRequired,
    publishedAt: PropTypes.string.isRequired,
    status: PropTypes.oneOf(['draft', 'published', 'archived']),
    author: PropTypes.shape({
      name: PropTypes.string,
      avatar: PropTypes.string
    }),
    attachments: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired
    })),
    readCount: PropTypes.number,
    totalEmployees: PropTypes.number
  }).isRequired,
  isAdmin: PropTypes.bool,
  isRead: PropTypes.bool,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onMarkAsRead: PropTypes.func,
  onViewStats: PropTypes.func,
  showStats: PropTypes.bool
};

export default AnnouncementCard;