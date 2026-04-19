const mongoose = require('mongoose');
const { Schema } = mongoose;

const announcementSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'priority'],
    default: 'normal'
  },
  publishDate: {
    type: Date,
    default: Date.now
  },
  expirationDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  readBy: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  emailNotificationSent: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    mimeType: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
announcementSchema.index({ publishDate: -1 });
announcementSchema.index({ expirationDate: 1 });
announcementSchema.index({ priority: 1 });
announcementSchema.index({ isActive: 1, isArchived: 1 });
announcementSchema.index({ 'readBy.user': 1 });

// Virtual for checking if announcement is currently published
announcementSchema.virtual('isPublished').get(function() {
  const now = new Date();
  return this.isActive && 
         !this.isArchived && 
         this.publishDate <= now && 
         this.expirationDate > now;
});

// Virtual for read count
announcementSchema.virtual('readCount').get(function() {
  return this.readBy ? this.readBy.length : 0;
});

// Instance method to check if user has read the announcement
announcementSchema.methods.isReadBy = function(userId) {
  return this.readBy.some(read => read.user.toString() === userId.toString());
};

// Instance method to mark as read by user
announcementSchema.methods.markAsRead = function(userId) {
  if (!this.isReadBy(userId)) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
  }
  return this.save();
};

// Instance method to mark as unread by user
announcementSchema.methods.markAsUnread = function(userId) {
  this.readBy = this.readBy.filter(read => read.user.toString() !== userId.toString());
  return this.save();
};

// Static method to find active announcements
announcementSchema.statics.findActive = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    isArchived: false,
    publishDate: { $lte: now },
    expirationDate: { $gt: now }
  }).sort({ priority: 1, publishDate: -1 });
};

// Static method to find announcements for a specific user (excluding read ones if specified)
announcementSchema.statics.findForUser = function(userId, includeRead = true) {
  const now = new Date();
  let query = {
    isActive: true,
    isArchived: false,
    publishDate: { $lte: now },
    expirationDate: { $gt: now }
  };

  if (!includeRead) {
    query['readBy.user'] = { $ne: userId };
  }

  return this.find(query)
    .populate('author', 'firstName lastName email')
    .sort({ priority: 1, publishDate: -1 });
};

// Static method to find urgent announcements that need email notifications
announcementSchema.statics.findUrgentForNotification = function() {
  const now = new Date();
  return this.find({
    priority: 'urgent',
    isActive: true,
    isArchived: false,
    emailNotificationSent: false,
    publishDate: { $lte: now },
    expirationDate: { $gt: now }
  });
};

// Pre-save middleware to validate dates
announcementSchema.pre('save', function(next) {
  // Ensure expiration date is after publish date
  if (this.expirationDate <= this.publishDate) {
    return next(new Error('Expiration date must be after publish date'));
  }

  // Auto-archive if expired
  const now = new Date();
  if (this.expirationDate <= now && !this.isArchived) {
    this.isArchived = true;
    this.isActive = false;
  }

  next();
});

// Pre-find middleware to exclude archived announcements by default
announcementSchema.pre(/^find/, function(next) {
  if (!this.getQuery().isArchived && this.getQuery().isArchived !== false) {
    this.find({ isArchived: { $ne: true } });
  }
  next();
});

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;