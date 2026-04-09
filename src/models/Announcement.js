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
  published: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  publishedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient querying of published announcements
announcementSchema.index({ published: 1, createdAt: -1 });

// Virtual for formatted creation date
announcementSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

// Pre-save middleware to set publishedAt date when publishing
announcementSchema.pre('save', function(next) {
  if (this.isModified('published') && this.published && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  if (!this.published) {
    this.publishedAt = null;
  }
  next();
});

// Static method to get published announcements for dashboard
announcementSchema.statics.getPublishedAnnouncements = function(limit = 5) {
  return this.find({ published: true })
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title content createdAt publishedAt');
};

// Static method to get all announcements for admin management
announcementSchema.statics.getAllForAdmin = function() {
  return this.find({})
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .select('title content published createdAt publishedAt createdBy');
};

// Instance method to toggle publication status
announcementSchema.methods.togglePublication = function() {
  this.published = !this.published;
  return this.save();
};

// Ensure virtual fields are included in JSON output
announcementSchema.set('toJSON', { virtuals: true });
announcementSchema.set('toObject', { virtuals: true });

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;