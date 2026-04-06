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
    maxlength: [5000, 'Content cannot exceed 5000 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  publishDate: {
    type: Date,
    default: Date.now
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Index for efficient querying of active announcements
announcementSchema.index({ isActive: 1, publishDate: -1 });

// Virtual for formatted publish date
announcementSchema.virtual('formattedPublishDate').get(function() {
  return this.publishDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Static method to get all active announcements - uses parameterized queries
announcementSchema.statics.getActiveAnnouncements = function() {
  // Using Mongoose's built-in query methods which automatically parameterize
  return this.find({ isActive: true })
    .sort({ priority: -1, publishDate: -1 })
    .populate('createdBy', 'name email')
    .lean();
};

// Static method to get announcements with pagination - using parameterized queries
announcementSchema.statics.getAnnouncementsPaginated = function(page = 1, limit = 10, includeInactive = false) {
  // Sanitize and validate input parameters
  const sanitizedPage = Math.max(1, parseInt(page, 10) || 1);
  const sanitizedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  
  const filter = includeInactive ? {} : { isActive: true };
  const skip = (sanitizedPage - 1) * sanitizedLimit;
  
  // Use MongoDB's built-in query methods with proper parameterization
  return this.find(filter)
    .sort({ publishDate: -1 })
    .skip(skip)
    .limit(sanitizedLimit)
    .populate('createdBy', 'name email')
    .lean();
};

// Static method to find announcements by priority - parameterized query
announcementSchema.statics.getAnnouncementsByPriority = function(priority) {
  // Validate priority against allowed enum values
  const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
  if (!allowedPriorities.includes(priority)) {
    throw new Error('Invalid priority level');
  }
  
  // Use parameterized query
  return this.find({ priority: priority, isActive: true })
    .sort({ publishDate: -1 })
    .populate('createdBy', 'name email')
    .lean();
};

// Instance method to toggle active status
announcementSchema.methods.toggleActive = function() {
  this.isActive = !this.isActive;
  return this.save();
};

// Pre-save middleware to validate user permissions with parameterized queries
announcementSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('createdBy')) {
    try {
      const User = mongoose.model('User');
      // Use parameterized query with findById to prevent injection
      const user = await User.findById(this.createdBy);
      
      if (!user || user.role !== 'admin') {
        return next(new Error('Only admin users can create announcements'));
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Pre-remove middleware for cleanup
announcementSchema.pre('remove', function(next) {
  // Add any cleanup logic here if needed
  next();
});

// Transform output to include virtual fields
announcementSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;