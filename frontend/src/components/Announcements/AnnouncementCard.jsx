import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { formatDistanceToNow } from 'date-fns';
import { 
  Card, 
  CardContent, 
  Typography, 
  Chip, 
  IconButton, 
  Box,
  Collapse,
  Button,
  Tooltip
} from '@mui/material';
import {
  PriorityHigh,
  Notifications,
  ExpandMore,
  ExpandLess,
  CheckCircleOutline,
  RadioButtonUnchecked
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const StyledCard = styled(Card)(({ theme, priority, isRead }) => ({
  marginBottom: theme.spacing(2),
  border: priority === 'urgent' 
    ? `2px solid ${theme.palette.error.main}` 
    : priority === 'priority' 
    ? `2px solid ${theme.palette.warning.main}` 
    : `1px solid ${theme.palette.divider}`,
  backgroundColor: isRead 
    ? theme.palette.background.paper 
    : theme.palette.action.hover,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    boxShadow: theme.shadows[4],
  }
}));

const PriorityChip = styled(Chip)(({ theme, priority }) => ({
  ...(priority === 'urgent' && {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    '& .MuiChip-icon': {
      color: theme.palette.error.contrastText,
    }
  }),
  ...(priority === 'priority' && {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
    '& .MuiChip-icon': {
      color: theme.palette.warning.contrastText,
    }
  }),
}));

const ContentWrapper = styled(Box)(({ theme }) => ({
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    margin: theme.spacing(1, 0),
    fontWeight: 600,
  },
  '& p': {
    margin: theme.spacing(0.5, 0),
    lineHeight: 1.6,
  },
  '& ul, & ol': {
    paddingLeft: theme.spacing(3),
    margin: theme.spacing(1, 0),
  },
  '& li': {
    marginBottom: theme.spacing(0.5),
  },
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    }
  },
  '& strong': {
    fontWeight: 600,
  },
  '& em': {
    fontStyle: 'italic',
  }
}));

const AnnouncementCard = ({ 
  announcement, 
  isRead = false, 
  onMarkAsRead, 
  onMarkAsUnread,
  showFullContent = false 
}) => {
  const [expanded, setExpanded] = useState(showFullContent);
  const [isReadState, setIsReadState] = useState(isRead);

  const handleToggleRead = async () => {
    try {
      if (isReadState) {
        await onMarkAsUnread(announcement.id);
        setIsReadState(false);
      } else {
        await onMarkAsRead(announcement.id);
        setIsReadState(true);
      }
    } catch (error) {
      console.error('Error toggling read status:', error);
    }
  };

  const handleExpandClick = () => {
    setExpanded(!expanded);
    // Mark as read when expanding to view full content
    if (!expanded && !isReadState && onMarkAsRead) {
      handleToggleRead();
    }
  };

  const getPriorityIcon = () => {
    switch (announcement.priority) {
      case 'urgent':
        return <Notifications />;
      case 'priority':
        return <PriorityHigh />;
      default:
        return null;
    }
  };

  const getPriorityLabel = () => {
    switch (announcement.priority) {
      case 'urgent':
        return 'Urgent';
      case 'priority':
        return 'Priority';
      default:
        return null;
    }
  };

  const truncateContent = (content, maxLength = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const formatPublishDate = (date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const renderContent = () => {
    const content = expanded 
      ? announcement.content 
      : truncateContent(announcement.content);

    return (
      <ContentWrapper 
        dangerouslySetInnerHTML={{ __html: content }}
        sx={{ mt: 1 }}
      />
    );
  };

  return (
    <StyledCard 
      priority={announcement.priority}
      isRead={isReadState}
      elevation={isReadState ? 1 : 3}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Typography 
                variant="h6" 
                component="h2"
                sx={{ 
                  fontWeight: isReadState ? 400 : 600,
                  color: isReadState ? 'text.secondary' : 'text.primary'
                }}
              >
                {announcement.title}
              </Typography>
              {announcement.priority && announcement.priority !== 'normal' && (
                <PriorityChip
                  priority={announcement.priority}
                  icon={getPriorityIcon()}
                  label={getPriorityLabel()}
                  size="small"
                />
              )}
            </Box>
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Published {formatPublishDate(announcement.publishedAt)} by {announcement.author?.name || 'Admin'}
              {announcement.expiresAt && (
                <> • Expires {formatDistanceToNow(new Date(announcement.expiresAt), { addSuffix: true })}</>
              )}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title={isReadState ? "Mark as unread" : "Mark as read"}>
              <IconButton 
                onClick={handleToggleRead}
                size="small"
                color={isReadState ? "default" : "primary"}
              >
                {isReadState ? <CheckCircleOutline /> : <RadioButtonUnchecked />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {renderContent()}

        {announcement.content.length > 200 && (
          <Box mt={2} display="flex" justifyContent="center">
            <Button
              onClick={handleExpandClick}
              endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
              size="small"
              variant="text"
            >
              {expanded ? 'Show Less' : 'Read More'}
            </Button>
          </Box>
        )}

        <Collapse in={expanded && announcement.content.length > 200}>
          {/* Additional content already rendered above */}
        </Collapse>
      </CardContent>
    </StyledCard>
  );
};

AnnouncementCard.propTypes = {
  announcement: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    priority: PropTypes.oneOf(['normal', 'priority', 'urgent']),
    publishedAt: PropTypes.string.isRequired,
    expiresAt: PropTypes.string,
    author: PropTypes.shape({
      name: PropTypes.string,
      email: PropTypes.string
    })
  }).isRequired,
  isRead: PropTypes.bool,
  onMarkAsRead: PropTypes.func.isRequired,
  onMarkAsUnread: PropTypes.func.isRequired,
  showFullContent: PropTypes.bool
};

export default AnnouncementCard;