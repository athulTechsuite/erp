const mongoose = require('mongoose');

// Define valid enums for validation
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_CATEGORIES = ['general', 'maintenance', 'event', 'policy', 'emergency'];

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
    minlength: [10, 'Content must be at least 10 characters long'],
    maxlength: [5000, 'Content cannot exceed 5000 characters'],
    validate: {
      validator: function(value) {
        // Validate content format - should contain meaningful text, not just whitespace or special chars
        const cleanContent = value.replace(/[^a-zA-Z0-9\s]/g, '').trim();
        return cleanContent.length >= 5;
      },
      message: 'Content must contain at least 5 meaningful characters'
    }
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
    enum: {
      values: VALID_PRIORITIES,
      message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`
    },
    default: 'medium',
    validate: {
      validator: function(value) {
        return VALID_PRIORITIES.includes(value);
      },
      message: props => `${props.value} is not a valid priority. Valid priorities are: ${VALID_PRIORITIES.join(', ')}`
    }
  },
  category: {
    type: String,
    enum: {
      values: VALID_CATEGORIES,
      message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
    },
    default: 'general',
    validate: {
      validator: function(value) {
        return VALID_CATEGORIES.includes(value);
      },
      message: props => `${props.value} is not a valid category. Valid categories are: ${VALID_CATEGORIES.join(', ')}`
    }
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
  const filter = includeInactive ? {} : { isActive: true };
  const skip = (page - 1) * limit;
  
  // Use MongoDB's built-in query methods with proper parameterization
  return this.find(filter)
    .sort({ publishDate: -1 })
    .skip(skip)
    .limit(limit)
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

// Export the model along with the valid enum values for external validation
module.exports = Announcement;
module.exports.VALID_PRIORITIES = VALID_PRIORITIES;
module.exports.VALID_CATEGORIES = VALID_CATEGORIES;