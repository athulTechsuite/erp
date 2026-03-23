const mongoose = require('mongoose');

const announcementReadSchema = new mongoose.Schema({
  announcement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Announcement',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  readAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  isRead: {
    type: Boolean,
    default: true,
    required: true
  }
}, {
  timestamps: true,
  collection: 'announcement_reads'
});

// Compound index to ensure one read record per user per announcement
announcementReadSchema.index({ announcement: 1, user: 1 }, { unique: true });

// Index for efficient queries by user
announcementReadSchema.index({ user: 1, readAt: -1 });

// Index for efficient queries by announcement
announcementReadSchema.index({ announcement: 1, isRead: 1 });

// Static method to mark announcement as read for a user
announcementReadSchema.statics.markAsRead = async function(announcementId, userId) {
  return await this.findOneAndUpdate(
    { announcement: announcementId, user: userId },
    { 
      isRead: true,
      readAt: new Date()
    },
    { 
      upsert: true,
      new: true
    }
  );
};

// Static method to mark announcement as unread for a user
announcementReadSchema.statics.markAsUnread = async function(announcementId, userId) {
  return await this.findOneAndUpdate(
    { announcement: announcementId, user: userId },
    { 
      isRead: false,
      readAt: new Date()
    },
    { 
      upsert: true,
      new: true
    }
  );
};

// Static method to get read status for multiple announcements for a user
announcementReadSchema.statics.getReadStatusForUser = async function(userId, announcementIds = []) {
  const query = { user: userId };
  if (announcementIds.length > 0) {
    query.announcement = { $in: announcementIds };
  }
  
  const readRecords = await this.find(query).select('announcement isRead readAt');
  
  const readStatus = {};
  readRecords.forEach(record => {
    readStatus[record.announcement.toString()] = {
      isRead: record.isRead,
      readAt: record.readAt
    };
  });
  
  return readStatus;
};

// Static method to get read statistics for an announcement
announcementReadSchema.statics.getReadStats = async function(announcementId) {
  const stats = await this.aggregate([
    { $match: { announcement: mongoose.Types.ObjectId(announcementId) } },
    {
      $group: {
        _id: '$isRead',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    totalRead: 0,
    totalUnread: 0,
    total: 0
  };
  
  stats.forEach(stat => {
    if (stat._id === true) {
      result.totalRead = stat.count;
    } else {
      result.totalUnread = stat.count;
    }
  });
  
  result.total = result.totalRead + result.totalUnread;
  
  return result;
};

// Static method to get read statistics for multiple announcements
announcementReadSchema.statics.getBulkReadStats = async function(announcementIds) {
  const stats = await this.aggregate([
    { $match: { announcement: { $in: announcementIds.map(id => mongoose.Types.ObjectId(id)) } } },
    {
      $group: {
        _id: {
          announcement: '$announcement',
          isRead: '$isRead'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.announcement',
        readCount: {
          $sum: {
            $cond: [{ $eq: ['$_id.isRead', true] }, '$count', 0]
          }
        },
        unreadCount: {
          $sum: {
            $cond: [{ $eq: ['$_id.isRead', false] }, '$count', 0]
          }
        },
        total: { $sum: '$count' }
      }
    }
  ]);
  
  const result = {};
  stats.forEach(stat => {
    result[stat._id.toString()] = {
      totalRead: stat.readCount,
      totalUnread: stat.unreadCount,
      total: stat.total
    };
  });
  
  return result;
};

// Static method to clean up read records for deleted announcements
announcementReadSchema.statics.cleanupDeletedAnnouncements = async function(announcementIds) {
  return await this.deleteMany({
    announcement: { $in: announcementIds }
  });
};

// Instance method to toggle read status
announcementReadSchema.methods.toggleReadStatus = async function() {
  this.isRead = !this.isRead;
  this.readAt = new Date();
  return await this.save();
};

// Pre-save middleware to ensure readAt is updated when isRead changes
announcementReadSchema.pre('save', function(next) {
  if (this.isModified('isRead')) {
    this.readAt = new Date();
  }
  next();
});

const AnnouncementRead = mongoose.model('AnnouncementRead', announcementReadSchema);

module.exports = AnnouncementRead;