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
  author: {
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
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient querying of active announcements
announcementSchema.index({ isActive: 1, createdAt: -1 });

// Virtual for checking if announcement is expired
announcementSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return this.expiresAt < new Date();
});

// Method to get all active, non-expired announcements
announcementSchema.statics.getActiveAnnouncements = function() {
  return this.find({
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  }).populate('author', 'name email')
    .sort({ priority: -1, createdAt: -1 });
};

// Method to create a new announcement
announcementSchema.statics.createAnnouncement = function(announcementData, authorId) {
  return this.create({
    ...announcementData,
    author: authorId
  });
};

// Method to update an announcement
announcementSchema.methods.updateAnnouncement = function(updateData) {
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined && key !== 'author') {
      this[key] = updateData[key];
    }
  });
  return this.save();
};

// Method to soft delete an announcement
announcementSchema.methods.softDelete = function() {
  this.isActive = false;
  return this.save();
};

// Pre-save middleware to validate expiration date
announcementSchema.pre('save', function(next) {
  if (this.expiresAt && this.expiresAt <= new Date()) {
    const error = new Error('Expiration date must be in the future');
    return next(error);
  }
  next();
});

// Transform output to include virtual fields and clean up
announcementSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;