const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    unique: true
  },
  year: {
    type: Number,
    required: true,
    default: () => new Date().getFullYear()
  },
  annualLeaveEntitlement: {
    type: Number,
    required: true,
    default: 20 // Default 20 days per year
  },
  annualLeaveUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  annualLeaveRemaining: {
    type: Number,
    default: function() {
      return this.annualLeaveEntitlement - this.annualLeaveUsed;
    }
  },
  sickLeaveEntitlement: {
    type: Number,
    required: true,
    default: 10 // Default 10 sick days per year
  },
  sickLeaveUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  sickLeaveRemaining: {
    type: Number,
    default: function() {
      return this.sickLeaveEntitlement - this.sickLeaveUsed;
    }
  },
  personalLeaveEntitlement: {
    type: Number,
    required: true,
    default: 5 // Default 5 personal days per year
  },
  personalLeaveUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  personalLeaveRemaining: {
    type: Number,
    default: function() {
      return this.personalLeaveEntitlement - this.personalLeaveUsed;
    }
  },
  carryOverDays: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
leaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });

// Virtual for total leave remaining
leaveBalanceSchema.virtual('totalLeaveRemaining').get(function() {
  return this.annualLeaveRemaining + this.sickLeaveRemaining + this.personalLeaveRemaining + this.carryOverDays;
});

// Method to update leave balance after leave approval
leaveBalanceSchema.methods.updateBalance = function(leaveType, days) {
  switch (leaveType.toLowerCase()) {
    case 'annual':
    case 'vacation':
      this.annualLeaveUsed += days;
      this.annualLeaveRemaining = Math.max(0, this.annualLeaveEntitlement + this.carryOverDays - this.annualLeaveUsed);
      break;
    case 'sick':
      this.sickLeaveUsed += days;
      this.sickLeaveRemaining = Math.max(0, this.sickLeaveEntitlement - this.sickLeaveUsed);
      break;
    case 'personal':
      this.personalLeaveUsed += days;
      this.personalLeaveRemaining = Math.max(0, this.personalLeaveEntitlement - this.personalLeaveUsed);
      break;
  }
  this.lastUpdated = new Date();
};

// Method to check if employee has sufficient balance
leaveBalanceSchema.methods.hasSufficientBalance = function(leaveType, days) {
  switch (leaveType.toLowerCase()) {
    case 'annual':
    case 'vacation':
      return this.annualLeaveRemaining >= days;
    case 'sick':
      return this.sickLeaveRemaining >= days;
    case 'personal':
      return this.personalLeaveRemaining >= days;
    default:
      return false;
  }
};

// Method to reset balance for new year
leaveBalanceSchema.methods.resetForNewYear = function(newYear, carryOverLimit = 5) {
  const carryOver = Math.min(this.annualLeaveRemaining, carryOverLimit);
  
  this.year = newYear;
  this.annualLeaveUsed = 0;
  this.sickLeaveUsed = 0;
  this.personalLeaveUsed = 0;
  this.carryOverDays = carryOver;
  
  this.annualLeaveRemaining = this.annualLeaveEntitlement + this.carryOverDays;
  this.sickLeaveRemaining = this.sickLeaveEntitlement;
  this.personalLeaveRemaining = this.personalLeaveEntitlement;
  
  this.lastUpdated = new Date();
};

// Static method to get balance for employee
leaveBalanceSchema.statics.getEmployeeBalance = async function(employeeId, year = null) {
  const currentYear = year || new Date().getFullYear();
  
  let balance = await this.findOne({ employeeId, year: currentYear });
  
  // Create balance record if it doesn't exist
  if (!balance) {
    balance = new this({
      employeeId,
      year: currentYear
    });
    await balance.save();
  }
  
  return balance;
};

// Static method to initialize balance for new employee
leaveBalanceSchema.statics.initializeForEmployee = async function(employeeId, entitlements = {}) {
  const currentYear = new Date().getFullYear();
  
  const balance = new this({
    employeeId,
    year: currentYear,
    annualLeaveEntitlement: entitlements.annual || 20,
    sickLeaveEntitlement: entitlements.sick || 10,
    personalLeaveEntitlement: entitlements.personal || 5
  });
  
  // Calculate remaining days
  balance.annualLeaveRemaining = balance.annualLeaveEntitlement;
  balance.sickLeaveRemaining = balance.sickLeaveEntitlement;
  balance.personalLeaveRemaining = balance.personalLeaveEntitlement;
  
  return await balance.save();
};

// Pre-save middleware to update remaining days
leaveBalanceSchema.pre('save', function(next) {
  if (this.isModified('annualLeaveUsed') || this.isModified('annualLeaveEntitlement') || this.isModified('carryOverDays')) {
    this.annualLeaveRemaining = Math.max(0, this.annualLeaveEntitlement + this.carryOverDays - this.annualLeaveUsed);
  }
  
  if (this.isModified('sickLeaveUsed') || this.isModified('sickLeaveEntitlement')) {
    this.sickLeaveRemaining = Math.max(0, this.sickLeaveEntitlement - this.sickLeaveUsed);
  }
  
  if (this.isModified('personalLeaveUsed') || this.isModified('personalLeaveEntitlement')) {
    this.personalLeaveRemaining = Math.max(0, this.personalLeaveEntitlement - this.personalLeaveUsed);
  }
  
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);