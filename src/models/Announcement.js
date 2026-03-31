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
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
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
announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ status: 1, isActive: 1 });

// Virtual for formatted creation date
announcementSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Static method to get active announcements
announcementSchema.statics.getActive = function() {
  return this.find({ 
    status: 'active', 
    isActive: true 
  })
  .populate('author', 'name email')
  .sort({ createdAt: -1 });
};

// Static method to get announcements by priority
announcementSchema.statics.getByPriority = function(priority) {
  return this.find({ 
    status: 'active', 
    isActive: true,
    priority: priority
  })
  .populate('author', 'name email')
  .sort({ createdAt: -1 });
};

// Instance method to deactivate announcement
announcementSchema.methods.deactivate = function() {
  this.isActive = false;
  this.status = 'inactive';
  return this.save();
};

// Pre-save middleware to validate author permissions
announcementSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('author')) {
    try {
      const User = mongoose.model('User');
      const author = await User.findById(this.author);
      
      if (!author) {
        return next(new Error('Author not found'));
      }
      
      if (author.role !== 'admin') {
        return next(new Error('Only administrators can create announcements'));
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Pre-remove middleware to log deletion
announcementSchema.pre('remove', function(next) {
  console.log(`Announcement "${this.title}" is being deleted by user ${this.author}`);
  next();
});

module.exports = mongoose.model('Announcement', announcementSchema);