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

// Static method to get all active announcements
announcementSchema.statics.getActiveAnnouncements = function() {
  return this.find({ isActive: true })
    .sort({ priority: -1, publishDate: -1 })
    .populate('createdBy', 'name email')
    .lean();
};

// Static method to get announcements with pagination - using parameterized queries
announcementSchema.statics.getAnnouncementsPaginated = function(page = 1, limit = 10, includeInactive = false) {
  // Input validation to prevent injection attacks
  const validatedPage = Math.max(1, parseInt(page) || 1);
  const validatedLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
  
  const filter = includeInactive ? {} : { isActive: true };
  const skip = (validatedPage - 1) * validatedLimit;
  
  // Use MongoDB's built-in query methods with proper parameterization
  return this.find(filter)
    .sort({ publishDate: -1 })
    .skip(skip)
    .limit(validatedLimit)
    .populate('createdBy', 'name email')
    .lean();
};

// Static method to find announcements by search criteria with input validation
announcementSchema.statics.findBySearchCriteria = function(searchCriteria) {
  // Validate and sanitize search criteria
  const validCriteria = {};
  
  if (searchCriteria.title && typeof searchCriteria.title === 'string') {
    // Use MongoDB's regex with escaped input to prevent injection
    const escapedTitle = searchCriteria.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    validCriteria.title = { $regex: new RegExp(escapedTitle, 'i') };
  }
  
  if (searchCriteria.priority && ['low', 'medium', 'high', 'urgent'].includes(searchCriteria.priority)) {
    validCriteria.priority = searchCriteria.priority;
  }
  
  if (typeof searchCriteria.isActive === 'boolean') {
    validCriteria.isActive = searchCriteria.isActive;
  }
  
  if (searchCriteria.createdBy && mongoose.Types.ObjectId.isValid(searchCriteria.createdBy)) {
    validCriteria.createdBy = new mongoose.Types.ObjectId(searchCriteria.createdBy);
  }
  
  return this.find(validCriteria)
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
      // Validate ObjectId format to prevent injection
      if (!mongoose.Types.ObjectId.isValid(this.createdBy)) {
        return next(new Error('Invalid user ID format'));
      }
      
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