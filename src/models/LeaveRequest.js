const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  leaveType: {
    type: String,
    required: true,
    enum: ['annual', 'sick', 'personal', 'maternity', 'paternity', 'emergency', 'unpaid']
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalDays: {
    type: Number,
    required: true,
    min: 0.5
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  appliedDate: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  approvedDate: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: 300
  },
  isHalfDay: {
    type: Boolean,
    default: false
  },
  halfDayPeriod: {
    type: String,
    enum: ['morning', 'afternoon'],
    required: function() {
      return this.isHalfDay;
    }
  },
  attachments: [{
    filename: String,
    path: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for calculating business days (excluding weekends)
leaveRequestSchema.virtual('businessDays').get(function() {
  if (this.isHalfDay) {
    return 0.5;
  }
  
  let count = 0;
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  
  while (start <= end) {
    const dayOfWeek = start.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    start.setDate(start.getDate() + 1);
  }
  
  return count;
});

// Virtual for leave duration in a readable format
leaveRequestSchema.virtual('duration').get(function() {
  if (this.isHalfDay) {
    return `Half day (${this.halfDayPeriod})`;
  }
  
  const days = this.totalDays;
  return days === 1 ? '1 day' : `${days} days`;
});

// Pre-save middleware to calculate total days
leaveRequestSchema.pre('save', function(next) {
  if (this.isModified('startDate') || this.isModified('endDate') || this.isModified('isHalfDay')) {
    if (this.isHalfDay) {
      this.totalDays = 0.5;
    } else {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      const timeDiff = end.getTime() - start.getTime();
      this.totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    }
  }
  next();
});

// Validation to ensure end date is after start date
leaveRequestSchema.pre('save', function(next) {
  if (!this.isHalfDay && this.endDate < this.startDate) {
    next(new Error('End date must be after start date'));
  } else {
    next();
  }
});

// Static method to get pending requests for approval
leaveRequestSchema.statics.getPendingRequests = function(approverId = null) {
  const query = { status: 'pending' };
  return this.find(query)
    .populate('employee', 'firstName lastName email department')
    .sort({ appliedDate: 1 });
};

// Static method to get leave requests by date range
leaveRequestSchema.statics.getByDateRange = function(startDate, endDate, status = null) {
  const query = {
    $or: [
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } },
      { 
        startDate: { $lte: startDate },
        endDate: { $gte: endDate }
      }
    ]
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .populate('employee', 'firstName lastName email department')
    .sort({ startDate: 1 });
};

// Instance method to approve leave request
leaveRequestSchema.methods.approve = function(approverId, comments = null) {
  this.status = 'approved';
  this.approvedBy = approverId;
  this.approvedDate = new Date();
  
  if (comments) {
    this.comments.push({
      author: approverId,
      text: comments
    });
  }
  
  return this.save();
};

// Instance method to reject leave request
leaveRequestSchema.methods.reject = function(approverId, reason, comments = null) {
  this.status = 'rejected';
  this.approvedBy = approverId;
  this.approvedDate = new Date();
  this.rejectionReason = reason;
  
  if (comments) {
    this.comments.push({
      author: approverId,
      text: comments
    });
  }
  
  return this.save();
};

// Instance method to cancel leave request
leaveRequestSchema.methods.cancel = function(reason = null) {
  this.status = 'cancelled';
  
  if (reason) {
    this.comments.push({
      author: this.employee,
      text: `Cancellation reason: ${reason}`
    });
  }
  
  return this.save();
};

// Index for efficient querying
leaveRequestSchema.index({ employee: 1, startDate: -1 });
leaveRequestSchema.index({ status: 1, appliedDate: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });
leaveRequestSchema.index({ leaveType: 1, status: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);