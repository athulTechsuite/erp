const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  priority: {
    type: String,
    enum: ['normal', 'important', 'urgent'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishAt: {
    type: Date,
    default: Date.now
  },
  publishedAt: {
    type: Date
  },
  archivedAt: {
    type: Date
  },
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  notificationSent: {
    type: Boolean,
    default: false
  },
  metadata: {
    views: {
      type: Number,
      default: 0
    },
    totalReads: {
      type: Number,
      default: 0
    },
    lastModified: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
announcementSchema.index({ companyId: 1, status: 1, publishAt: -1 });
announcementSchema.index({ companyId: 1, priority: 1, publishedAt: -1 });
announcementSchema.index({ publishAt: 1, status: 1 }); // For scheduled publishing
announcementSchema.index({ createdAt: 1 }); // For archiving old announcements

// Virtual for read statistics
announcementSchema.virtual('readStats').get(function() {
  return {
    totalReads: this.readBy.length,
    readPercentage: 0 // Will be calculated with total employee count
  };
});

// Virtual to check if announcement is published
announcementSchema.virtual('isPublished').get(function() {
  return this.status === 'published' && this.publishAt <= new Date();
});

// Virtual to check if announcement is scheduled
announcementSchema.virtual('isScheduled').get(function() {
  return this.status === 'published' && this.publishAt > new Date();
});

// Pre-save middleware
announcementSchema.pre('save', function(next) {
  // Update publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    if (this.publishAt <= new Date()) {
      this.publishedAt = new Date();
    }
  }

  // Update archivedAt when status changes to archived
  if (this.isModified('status') && this.status === 'archived' && !this.archivedAt) {
    this.archivedAt = new Date();
  }

  // Update lastModified timestamp
  this.metadata.lastModified = new Date();

  next();
});

// Static methods
announcementSchema.statics.findPublished = function(companyId, options = {}) {
  const query = {
    companyId,
    status: 'published',
    publishAt: { $lte: new Date() }
  };

  let announcementsQuery = this.find(query)
    .populate('author', 'firstName lastName email avatar')
    .sort({ publishedAt: -1, priority: -1 });

  if (options.limit) {
    announcementsQuery = announcementsQuery.limit(options.limit);
  }

  if (options.skip) {
    announcementsQuery = announcementsQuery.skip(options.skip);
  }

  return announcementsQuery;
};

announcementSchema.statics.findScheduled = function(companyId) {
  return this.find({
    companyId,
    status: 'published',
    publishAt: { $gt: new Date() }
  })
  .populate('author', 'firstName lastName email')
  .sort({ publishAt: 1 });
};

announcementSchema.statics.findDrafts = function(companyId, authorId = null) {
  const query = { companyId, status: 'draft' };
  if (authorId) {
    query.author = authorId;
  }

  return this.find(query)
    .populate('author', 'firstName lastName email')
    .sort({ updatedAt: -1 });
};

announcementSchema.statics.findForArchiving = function() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  return this.find({
    status: 'published',
    publishedAt: { $lt: sixMonthsAgo }
  });
};

// Instance methods
announcementSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(read => read.user.toString() === userId.toString());
  
  if (!existingRead) {
    this.readBy.push({ user: userId });
    this.metadata.totalReads = this.readBy.length;
    return this.save();
  }
  
  return Promise.resolve(this);
};

announcementSchema.methods.markAsUnread = function(userId) {
  this.readBy = this.readBy.filter(read => read.user.toString() !== userId.toString());
  this.metadata.totalReads = this.readBy.length;
  return this.save();
};

announcementSchema.methods.isReadBy = function(userId) {
  return this.readBy.some(read => read.user.toString() === userId.toString());
};

announcementSchema.methods.getReadStats = async function() {
  const Company = mongoose.model('Company');
  const company = await Company.findById(this.companyId).populate('employees');
  
  if (!company) {
    return { totalEmployees: 0, totalReads: this.readBy.length, readPercentage: 0 };
  }

  const totalEmployees = company.employees.length;
  const totalReads = this.readBy.length;
  const readPercentage = totalEmployees > 0 ? Math.round((totalReads / totalEmployees) * 100) : 0;

  return {
    totalEmployees,
    totalReads,
    readPercentage
  };
};

announcementSchema.methods.publish = function() {
  this.status = 'published';
  if (this.publishAt <= new Date()) {
    this.publishedAt = new Date();
  }
  return this.save();
};

announcementSchema.methods.archive = function() {
  this.status = 'archived';
  this.archivedAt = new Date();
  return this.save();
};

announcementSchema.methods.incrementViews = function() {
  this.metadata.views += 1;
  return this.save({ validateBeforeSave: false });
};

// Static method for bulk archiving
announcementSchema.statics.archiveOldAnnouncements = async function() {
  const announcementsToArchive = await this.findForArchiving();
  
  if (announcementsToArchive.length === 0) {
    return { archived: 0 };
  }

  const announcementIds = announcementsToArchive.map(a => a._id);
  
  await this.updateMany(
    { _id: { $in: announcementIds } },
    { 
      status: 'archived',
      archivedAt: new Date()
    }
  );

  return { archived: announcementsToArchive.length };
};

module.exports = mongoose.model('Announcement', announcementSchema);