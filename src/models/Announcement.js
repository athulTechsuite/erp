const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Announcement title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Announcement content is required'],
    trim: true,
    maxlength: [2000, 'Content cannot exceed 2000 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  targetAudience: {
    type: String,
    enum: ['all', 'managers', 'employees'],
    default: 'all'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient querying
announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ isActive: 1, createdAt: -1 });
announcementSchema.index({ expiresAt: 1 });

// Virtual for checking if announcement is expired
announcementSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual for read count
announcementSchema.virtual('readCount').get(function() {
  return this.readBy ? this.readBy.length : 0;
});

// Pre-save middleware to handle expiration logic
announcementSchema.pre('save', function(next) {
  // If announcement is expired, set isActive to false
  if (this.expiresAt && this.expiresAt < new Date()) {
    this.isActive = false;
  }
  next();
});

// Static method to get active announcements
announcementSchema.statics.getActiveAnnouncements = function(limit = 10, audience = 'all') {
  const query = {
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  };

  if (audience !== 'all') {
    query.targetAudience = { $in: ['all', audience] };
  }

  return this.find(query)
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get announcements for dashboard
announcementSchema.statics.getDashboardAnnouncements = function(userId, userRole) {
  const targetAudience = userRole === 'admin' ? 'all' : 
                        userRole === 'manager' ? 'managers' : 'employees';
  
  return this.getActiveAnnouncements(5, targetAudience);
};

// Instance method to mark as read by user
announcementSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(read => 
    read.user.toString() === userId.toString()
  );
  
  if (!existingRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Instance method to check if read by user
announcementSchema.methods.isReadBy = function(userId) {
  return this.readBy.some(read => 
    read.user.toString() === userId.toString()
  );
};

// Static method to cleanup expired announcements
announcementSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    {
      expiresAt: { $lt: new Date() },
      isActive: true
    },
    {
      isActive: false
    }
  );
};

// Validation for expiration date
announcementSchema.pre('validate', function(next) {
  if (this.expiresAt && this.expiresAt <= new Date()) {
    this.invalidate('expiresAt', 'Expiration date must be in the future');
  }
  next();
});

module.exports = mongoose.model('Announcement', announcementSchema);