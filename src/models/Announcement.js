const mongoose = require('mongoose');
const validator = require('validator');

// Input sanitization helper
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return validator.escape(input.trim());
  }
  return input;
};

// Input validation helper
const validateObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid ObjectId provided');
  }
  return id;
};

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

// Pre-save middleware to update timestamp and sanitize inputs
announcementSchema.pre('save', function(next) {
  try {
    // Sanitize string inputs
    if (this.isModified('title')) {
      this.title = sanitizeInput(this.title);
    }
    if (this.isModified('content')) {
      this.content = sanitizeInput(this.content);
    }
    if (this.isModified('tags')) {
      this.tags = this.tags.map(tag => sanitizeInput(tag));
    }
    
    if (this.isModified() && !this.isNew) {
      this.updatedAt = new Date();
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to auto-archive expired announcements
announcementSchema.pre('save', function(next) {
  try {
    if (this.isExpired && this.isActive) {
      this.isActive = false;
      this.isArchived = true;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to get active announcements
announcementSchema.statics.getActive = async function() {
  try {
    return await this.find({
      isActive: true,
      isArchived: false,
      $or: [
        { expirationDate: null },
        { expirationDate: { $gt: new Date() } }
      ]
    }).populate('author', 'firstName lastName email')
      .sort({ createdAt: -1 });
  } catch (error) {
    throw new Error(`Failed to retrieve active announcements: ${error.message}`);
  }
};

// Static method to get announcements by priority
announcementSchema.statics.getByPriority = async function(priority) {
  try {
    // Validate and sanitize priority input
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    const sanitizedPriority = sanitizeInput(priority);
    
    if (!validPriorities.includes(sanitizedPriority)) {
      throw new Error('Invalid priority level provided');
    }

    return await this.find({
      priority: sanitizedPriority,
      isActive: true,
      isArchived: false,
      $or: [
        { expirationDate: null },
        { expirationDate: { $gt: new Date() } }
      ]
    }).populate('author', 'firstName lastName email')
      .sort({ createdAt: -1 });
  } catch (error) {
    throw new Error(`Failed to retrieve announcements by priority: ${error.message}`);
  }
};

// Static method to auto-archive expired announcements
announcementSchema.statics.archiveExpired = async function() {
  try {
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
  } catch (error) {
    throw new Error(`Failed to archive expired announcements: ${error.message}`);
  }
};

// Static method to get recent announcements for dashboard
announcementSchema.statics.getRecent = async function(limit = 5) {
  try {
    // Validate limit input
    const sanitizedLimit = parseInt(limit);
    if (isNaN(sanitizedLimit) || sanitizedLimit < 0 || sanitizedLimit > 100) {
      throw new Error('Invalid limit value provided');
    }

    return await this.find({
      isActive: true,
      isArchived: false,
      $or: [
        { expirationDate: null },
        { expirationDate: { $gt: new Date() } }
      ]
    }).populate('author', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(sanitizedLimit);
  } catch (error) {
    throw new Error(`Failed to retrieve recent announcements: ${error.message}`);
  }
};

// Instance method to increment view count
announcementSchema.methods.incrementViewCount = async function() {
  try {
    this.viewCount += 1;
    return await this.save();
  } catch (error) {
    throw new Error(`Failed to increment view count: ${error.message}`);
  }
};

// Instance method to toggle active status
announcementSchema.methods.toggleActive = async function() {
  try {
    this.isActive = !this.isActive;
    if (!this.isActive) {
      this.isArchived = true;
    }
    return await this.save();
  } catch (error) {
    throw new Error(`Failed to toggle active status: ${error.message}`);
  }
};

// Instance method to check if user can edit (author or admin)
announcementSchema.methods.canEdit = function(userId, userRole) {
  try {
    // Validate inputs
    validateObjectId(userId);
    const sanitizedRole = sanitizeInput(userRole);
    
    return sanitizedRole === 'admin' || this.author.toString() === userId.toString();
  } catch (error) {
    throw new Error(`Failed to check edit permissions: ${error.message}`);
  }
};

// Method to format content for display (basic text formatting)
announcementSchema.methods.getFormattedContent = function() {
  try {
    if (!this.content) return '';
    
    return this.content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  } catch (error) {
    throw new Error(`Failed to format content: ${error.message}`);
  }
};

// Method to get summary (first 150 characters)
announcementSchema.methods.getSummary = function(length = 150) {
  try {
    if (!this.content) return '';
    
    // Validate length input
    const sanitizedLength = parseInt(length);
    if (isNaN(sanitizedLength) || sanitizedLength < 0 || sanitizedLength > 1000) {
      throw new Error('Invalid length value provided');
    }
    
    if (this.content.length <= sanitizedLength) return this.content;
    return this.content.substring(0, sanitizedLength).trim() + '...';
  } catch (error) {
    throw new Error(`Failed to generate summary: ${error.message}`);
  }
};

module.exports = mongoose.model('Announcement', announcementSchema);