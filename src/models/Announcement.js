const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Announcement title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    validate: {
      validator: function(v) {
        // Prevent XSS and SQL injection patterns in title
        const dangerousPatterns = /<script|javascript:|on\w+\s*=|<iframe|SELECT\s+|INSERT\s+|UPDATE\s+|DELETE\s+|DROP\s+|UNION\s+|OR\s+1\s*=\s*1|AND\s+1\s*=\s*1/i;
        return !dangerousPatterns.test(v);
      },
      message: 'Title contains potentially dangerous content'
    }
  },
  content: {
    type: String,
    required: [true, 'Announcement content is required'],
    trim: true,
    maxlength: [5000, 'Content cannot exceed 5000 characters'],
    validate: {
      validator: function(v) {
        // Prevent XSS and SQL injection patterns in content
        const dangerousPatterns = /<script|javascript:|on\w+\s*=|<iframe|SELECT\s+|INSERT\s+|UPDATE\s+|DELETE\s+|DROP\s+|UNION\s+|OR\s+1\s*=\s*1|AND\s+1\s*=\s*1/i;
        return !dangerousPatterns.test(v);
      },
      message: 'Content contains potentially dangerous content'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required'],
    validate: {
      validator: function(v) {
        // Ensure it's a valid ObjectId format to prevent injection
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid user ID format'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  publishDate: {
    type: Date,
    default: Date.now,
    validate: {
      validator: function(v) {
        // Ensure date is valid and not in the far future to prevent manipulation
        return v instanceof Date && v.getTime() <= Date.now() + (365 * 24 * 60 * 60 * 1000);
      },
      message: 'Invalid publish date'
    }
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: 'Priority must be one of: low, medium, high, urgent'
    },
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

// Input sanitization helper function
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.replace(/[<>\"'%;()&+]/g, '');
  }
  return input;
};

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
  // Strict input sanitization and validation
  const sanitizedPage = Math.max(1, Math.min(1000, parseInt(page, 10) || 1));
  const sanitizedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  
  // Validate boolean input
  const validatedIncludeInactive = Boolean(includeInactive);
  
  const filter = validatedIncludeInactive ? {} : { isActive: true };
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
  // Strict validation against allowed enum values with sanitization
  const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
  const sanitizedPriority = sanitizeInput(priority);
  
  if (!allowedPriorities.includes(sanitizedPriority)) {
    throw new Error('Invalid priority level');
  }
  
  // Use parameterized query with sanitized input
  return this.find({ priority: sanitizedPriority, isActive: true })
    .sort({ publishDate: -1 })
    .populate('createdBy', 'name email')
    .lean();
};

// Static method to search announcements by title with input sanitization
announcementSchema.statics.searchByTitle = function(searchTerm) {
  // Sanitize and validate search term
  if (!searchTerm || typeof searchTerm !== 'string') {
    throw new Error('Invalid search term');
  }
  
  const sanitizedTerm = sanitizeInput(searchTerm.trim());
  if (sanitizedTerm.length < 2) {
    throw new Error('Search term must be at least 2 characters');
  }
  
  // Use regex with escaped special characters to prevent ReDoS attacks
  const escapedTerm = sanitizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  return this.find({
    title: { $regex: new RegExp(escapedTerm, 'i') },
    isActive: true
  })
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
      // Validate ObjectId format before querying
      if (!mongoose.Types.ObjectId.isValid(this.createdBy)) {
        return next(new Error('Invalid user ID format'));
      }
      
      const User = mongoose.model('User');
      // Use parameterized query with findById to prevent injection
      const user = await User.findById(this.createdBy).select('role').lean();
      
      if (!user || user.role !== 'admin') {
        return next(new Error('Only admin users can create announcements'));
      }
    } catch (error) {
      return next(new Error('User validation failed: ' + error.message));
    }
  }
  
  // Additional sanitization before save
  if (this.isModified('title')) {
    this.title = sanitizeInput(this.title);
  }
  if (this.isModified('content')) {
    this.content = sanitizeInput(this.content);
  }
  
  next();
});

// Pre-remove middleware for cleanup
announcementSchema.pre('remove', function(next) {
  // Add any cleanup logic here if needed
  next();
});

// Transform output to include virtual fields and sanitize sensitive data
announcementSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    // Additional output sanitization
    if (ret.title) ret.title = sanitizeInput(ret.title);
    if (ret.content) ret.content = sanitizeInput(ret.content);
    return ret;
  }
});

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;