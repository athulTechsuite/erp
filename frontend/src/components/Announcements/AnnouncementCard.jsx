import React from 'react';
import PropTypes from 'prop-types';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { formatDistanceToNow, parseISO } from 'date-fns';

const AnnouncementCard = ({ announcement }) => {
  const formatDate = (dateString) => {
    try {
      const date = parseISO(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Unknown date';
    }
  };

  return (
    <Card 
      sx={{ 
        mb: 2, 
        boxShadow: 2,
        borderLeft: 4,
        borderLeftColor: 'primary.main',
        '&:hover': {
          boxShadow: 3,
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography 
            variant="h6" 
            component="h3" 
            sx={{ 
              fontWeight: 600,
              color: 'text.primary',
              flex: 1,
              mr: 2
            }}
          >
            {announcement.title}
          </Typography>
          <Chip
            label="Announcement"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ flexShrink: 0 }}
          />
        </Box>
        
        <Typography 
          variant="body1" 
          sx={{ 
            mb: 2,
            lineHeight: 1.6,
            color: 'text.primary',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {announcement.content}
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              fontStyle: 'italic'
            }}
          >
            Posted {formatDate(announcement.createdAt)}
          </Typography>
          
          {announcement.createdBy && (
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary',
                fontWeight: 500
              }}
            >
              By: {announcement.createdBy.firstName} {announcement.createdBy.lastName}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

AnnouncementCard.propTypes = {
  announcement: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    createdBy: PropTypes.shape({
      firstName: PropTypes.string,
      lastName: PropTypes.string,
    }),
  }).isRequired,
};

export default AnnouncementCard;