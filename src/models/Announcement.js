const mongoose = require('mongoose');
const validator = require('validator');

// Input sanitization helper functions
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return validator.escape(str.trim());
};

const sanitizeHtml = (str) => {
  if (typeof str !== 'string') return '';
  // Remove HTML tags and escape remaining content
  return validator.escape(str.replace(/<[^>]*>/g, '').trim());
};

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Announcement title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    validate: {
      validator: function(v) {
        // Validate title contains only safe characters
        return validator.isLength(v, { min: 1, max: 200 }) && 
               !validator.contains(v, '<script') && 
               !validator.contains(v, 'javascript:');
      },
      message: 'Title contains invalid characters or unsafe content'
    },
    set: function(v) {
      return sanitizeString(v);
    }
  },
  content: {
    type: String,
    required: [true, 'Announcement content is required'],
    trim: true,
    maxlength: [5000, 'Content cannot exceed 5000 characters'],
    validate: {
      validator: function(v) {
        // Validate content length and safety
        return validator.isLength(v, { min: 1, max: 5000 }) && 
               !validator.contains(v, '<script') && 
               !validator.contains(v, 'javascript:');
      },
      message: 'Content contains invalid characters or unsafe content'
    },
    set: function(v) {
      return sanitizeHtml(v);
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required'],
    validate: {
      validator: function(v) {
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid user ID format'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    validate: {
      validator: function(v) {
        return typeof v === 'boolean';
      },
      message: 'isActive must be a boolean value'
    }
  },
  publishDate: {
    type: Date,
    default: Date.now,
    validate: {
      validator: function(v) {
        return v instanceof Date && !isNaN(v);
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
    default: 'medium',
    set: function(v) {
      // Sanitize and validate priority input
      if (typeof v !== 'string') return 'medium';
      const sanitized = v.toLowerCase().trim();
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      return validPriorities.includes(sanitized) ? sanitized : 'medium';
    }
  }
}, {
  timestamps: true
});

// Index for efficient querying of active announcements
announcementSchema.index({ isActive: 1, publishDate: -1 });

// Virtual for formatted publish date
announcementSchema.virtual('formattedPublishDate').get(function() {
  if (!this.publishDate || !(this.publishDate instanceof Date)) {
    return 'Invalid Date';
  }
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
  // Comprehensive input sanitization and validation
  const sanitizedPage = Math.max(1, Math.min(1000, parseInt(page, 10) || 1));
  const sanitizedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const sanitizedIncludeInactive = Boolean(includeInactive);
  
  const filter = sanitizedIncludeInactive ? {} : { isActive: true };
  const skip = (sanitizedPage - 1) * sanitizedLimit;
  
  // Use MongoDB's built-in query methods with proper parameterization
  return this.find(filter)
    .sort({ publishDate: -1 })
    .skip(skip)
    .limit(sanitizedLimit)
    .populate('createdBy', 'name email')
    .lean();
};

// Static method to find announcements by priority - parameterized query with strict validation
announcementSchema.statics.getAnnouncementsByPriority = function(priority) {
  // Strict input validation and sanitization
  if (typeof priority !== 'string') {
    throw new Error('Priority must be a string');
  }
  
  const sanitizedPriority = priority.toLowerCase().trim();
  const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
  
  if (!allowedPriorities.includes(sanitizedPriority)) {
    throw new Error('Invalid priority level. Must be one of: low, medium, high, urgent');
  }
  
  // Use parameterized query with sanitized input
  return this.find({ priority: sanitizedPriority, isActive: true })
    .sort({ publishDate: -1 })
    .populate('createdBy', 'name email')
    .lean();
};

// Static method to search announcements with sanitized input
announcementSchema.statics.searchAnnouncements = function(searchTerm, options = {}) {
  // Sanitize search input
  if (typeof searchTerm !== 'string' || !searchTerm.trim()) {
    throw new Error('Search term must be a non-empty string');
  }
  
  const sanitizedTerm = validator.escape(searchTerm.trim());
  const sanitizedOptions = {
    includeInactive: Boolean(options.includeInactive),
    limit: Math.max(1, Math.min(100, parseInt(options.limit, 10) || 10))
  };
  
  const filter = {
    $and: [
      sanitizedOptions.includeInactive ? {} : { isActive: true },
      {
        $or: [
          { title: { $regex: sanitizedTerm, $options: 'i' } },
          { content: { $regex: sanitizedTerm, $options: 'i' } }
        ]
      }
    ]
  };
  
  return this.find(filter)
    .sort({ publishDate: -1 })
    .limit(sanitizedOptions.limit)
    .populate('createdBy', 'name email')
    .lean();
};

// Instance method to toggle active status with validation
announcementSchema.methods.toggleActive = function() {
  if (typeof this.isActive !== 'boolean') {
    throw new Error('Invalid isActive state');
  }
  this.isActive = !this.isActive;
  return this.save();
};

// Instance method to safely update announcement with input validation
announcementSchema.methods.safeUpdate = function(updateData) {
  const allowedFields = ['title', 'content', 'priority', 'isActive', 'publishDate'];
  const sanitizedUpdate = {};
  
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      sanitizedUpdate[key] = updateData[key];
    }
  });
  
  Object.assign(this, sanitizedUpdate);
  return this.save();
};

// Pre-validate middleware for additional security
announcementSchema.pre('validate', function(next) {
  // Additional validation for XSS prevention
  if (this.title && (this.title.includes('<script') || this.title.includes('javascript:'))) {
    return next(new Error('Title contains potentially malicious content'));
  }
  
  if (this.content && (this.content.includes('<script') || this.content.includes('javascript:'))) {
    return next(new Error('Content contains potentially malicious content'));
  }
  
  next();
});

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
      const user = await User.findById(this.createdBy).lean();
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      if (user.role !== 'admin') {
        return next(new Error('Only admin users can create announcements'));
      }
    } catch (error) {
      return next(new Error('Failed to validate user permissions: ' + error.message));
    }
  }
  next();
});

// Pre-remove middleware for cleanup
announcementSchema.pre('remove', function(next) {
  // Add any cleanup logic here if needed
  // Log removal for audit trail
  console.log(`Announcement ${this._id} is being removed`);
  next();
});

// Transform output to sanitize data and include virtual fields
announcementSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    // Remove sensitive/internal fields
    delete ret.__v;
    delete ret.createdBy?.password;
    delete ret.createdBy?.email;
    
    // Additional sanitization of output
    if (ret.title) ret.title = validator.escape(ret.title);
    if (ret.content) ret.content = validator.escape(ret.content);
    
    return ret;
  }
});

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;