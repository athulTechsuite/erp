const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient querying
announcementSchema.index({ isActive: 1, createdAt: -1 });
announcementSchema.index({ createdBy: 1 });

// Virtual for formatted creation date
announcementSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Static method to get active announcements
announcementSchema.statics.getActiveAnnouncements = function() {
  return this.find({ isActive: true })
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to get all announcements for admin
announcementSchema.statics.getAllForAdmin = function() {
  return this.find({})
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
};

// Instance method to soft delete
announcementSchema.methods.softDelete = function() {
  this.isActive = false;
  return this.save();
};

// Pre-save middleware to ensure message and title are sanitized
announcementSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.title = this.title.replace(/\s+/g, ' ').trim();
  }
  if (this.isModified('message')) {
    this.message = this.message.trim();
  }
  next();
});

// Pre-find middleware to populate createdBy by default
announcementSchema.pre(/^find/, function(next) {
  if (!this.getPopulatedPaths().includes('createdBy')) {
    this.populate({
      path: 'createdBy',
      select: 'name email'
    });
  }
  next();
});

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;