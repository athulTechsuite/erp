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
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date,
    default: null
  },
  emailFailure: {
    type: Boolean,
    default: false
  },
  emailFailureReason: {
    type: String,
    default: null
  },
  recipientCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for better query performance
announcementSchema.index({ isActive: 1, createdAt: -1 });
announcementSchema.index({ createdBy: 1 });

// Virtual for formatted creation date
announcementSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Static method to get active announcements
announcementSchema.statics.getActiveAnnouncements = function() {
  return this.find({ isActive: true })
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

// Static method to get announcements for admin management
announcementSchema.statics.getAllForManagement = function() {
  return this.find({})
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

// Instance method to mark email as sent
announcementSchema.methods.markEmailSent = function(recipientCount) {
  this.emailSent = true;
  this.emailSentAt = new Date();
  this.recipientCount = recipientCount || 0;
  this.emailFailure = false;
  this.emailFailureReason = null;
  return this.save();
};

// Instance method to mark email as failed
announcementSchema.methods.markEmailFailed = function(reason) {
  this.emailFailure = true;
  this.emailFailureReason = reason;
  this.emailSent = false;
  return this.save();
};

// Instance method to soft delete (deactivate)
announcementSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Pre-save middleware to validate user role
announcementSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('createdBy')) {
    try {
      const User = mongoose.model('User');
      const creator = await User.findById(this.createdBy);
      
      if (!creator || creator.role !== 'admin') {
        const error = new Error('Only admin users can create announcements');
        error.name = 'ValidationError';
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Ensure virtual fields are serialized
announcementSchema.set('toJSON', { virtuals: true });
announcementSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Announcement', announcementSchema);