const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  imageUrl: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true;
        // Basic URL validation for image URLs
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
      },
      message: 'Invalid image URL format'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  targetAudience: {
    type: [String],
    enum: ['all', 'admin', 'manager', 'employee'],
    default: ['all']
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient querying
announcementSchema.index({ isActive: 1, createdAt: -1 });
announcementSchema.index({ expiresAt: 1 });

// Virtual for checking if announcement is expired
announcementSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Static method to get active announcements
announcementSchema.statics.getActiveAnnouncements = function(userRole = 'all') {
  const query = {
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  };

  // Filter by target audience if specified
  if (userRole !== 'all') {
    query.targetAudience = { $in: ['all', userRole] };
  }

  return this.find(query)
    .populate('createdBy', 'firstName lastName email')
    .sort({ priority: -1, createdAt: -1 });
};

// Instance method to check if user can manage this announcement
announcementSchema.methods.canBeManaged = function(user) {
  if (!user) return false;
  
  // Only admins can manage announcements
  return user.role === 'admin' || user._id.equals(this.createdBy);
};

// Pre-save middleware to validate admin-only creation
announcementSchema.pre('save', async function(next) {
  if (this.isNew) {
    const User = mongoose.model('User');
    const creator = await User.findById(this.createdBy);
    
    if (!creator || creator.role !== 'admin') {
      const error = new Error('Only admin users can create announcements');
      error.status = 403;
      return next(error);
    }
  }
  next();
});

// Pre-remove middleware for cleanup
announcementSchema.pre('remove', function(next) {
  // Add any cleanup logic here if needed
  // For example, removing associated files or notifications
  next();
});

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;