const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true,
    maxlength: [5000, 'Content cannot exceed 5000 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required']
  },
  expirationDate: {
    type: Date,
    default: null,
    validate: {
      validator: function(value) {
        if (value) {
          return value > new Date();
        }
        return true;
      },
      message: 'Expiration date must be in the future'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  viewCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient querying
announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ expirationDate: 1 });
announcementSchema.index({ isActive: 1, isArchived: 1 });
announcementSchema.index({ author: 1 });
announcementSchema.index({ priority: 1 });

// Virtual for checking if announcement is expired
announcementSchema.virtual('isExpired').get(function() {
  if (!this.expirationDate) return false;
  return new Date() > this.expirationDate;
});

// Virtual for days until expiration
announcementSchema.virtual('daysUntilExpiration').get(function() {
  if (!this.expirationDate) return null;
  const now = new Date();
  const timeDiff = this.expirationDate.getTime() - now.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
});

// Pre-save middleware to update timestamp
announcementSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Pre-save middleware to auto-archive expired announcements
announcementSchema.pre('save', function(next) {
  if (this.isExpired && this.isActive) {
    this.isActive = false;
    this.isArchived = true;
  }
  next();
});

// Static method to get active announcements
announcementSchema.statics.getActive = function() {
  return this.find({
    isActive: true,
    isArchived: false,
    $or: [
      { expirationDate: null },
      { expirationDate: { $gt: new Date() } }
    ]
  }).populate('author', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

// Static method to get announcements by priority
announcementSchema.statics.getByPriority = function(priority) {
  return this.find({
    priority: priority,
    isActive: true,
    isArchived: false,
    $or: [
      { expirationDate: null },
      { expirationDate: { $gt: new Date() } }
    ]
  }).populate('author', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

// Static method to auto-archive expired announcements
announcementSchema.statics.archiveExpired = async function() {
  const result = await this.updateMany(
    {
      expirationDate: { $lt: new Date() },
      isActive: true,
      isArchived: false
    },
    {
      $set: {
        isActive: false,
        isArchived: true,
        updatedAt: new Date()
      }
    }
  );
  return result;
};

// Static method to get recent announcements for dashboard
announcementSchema.statics.getRecent = function(limit = 5) {
  return this.find({
    isActive: true,
    isArchived: false,
    $or: [
      { expirationDate: null },
      { expirationDate: { $gt: new Date() } }
    ]
  }).populate('author', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Instance method to increment view count
announcementSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Instance method to toggle active status
announcementSchema.methods.toggleActive = function() {
  this.isActive = !this.isActive;
  if (!this.isActive) {
    this.isArchived = true;
  }
  return this.save();
};

// Instance method to check if user can edit (author or admin)
announcementSchema.methods.canEdit = function(userId, userRole) {
  return userRole === 'admin' || this.author.toString() === userId.toString();
};

// Method to format content for display (basic text formatting)
announcementSchema.methods.getFormattedContent = function() {
  return this.content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
};

// Method to get summary (first 150 characters)
announcementSchema.methods.getSummary = function(length = 150) {
  if (this.content.length <= length) return this.content;
  return this.content.substring(0, length).trim() + '...';
};

module.exports = mongoose.model('Announcement', announcementSchema);