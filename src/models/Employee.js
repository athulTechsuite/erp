const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  // Basic Information
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  
  // Authentication
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'employee'],
    default: 'employee'
  },
  
  // Employment Details
  department: {
    type: String,
    trim: true
  },
  position: {
    type: String,
    required: true,
    trim: true
  },
  hireDate: {
    type: Date,
    required: true
  },
  salary: {
    type: Number,
    min: 0
  },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'intern'],
    default: 'full-time'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'terminated'],
    default: 'active'
  },
  
  // Manager Relationship
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Leave Management
  leaveBalances: {
    annual: {
      type: Number,
      default: 25
    },
    sick: {
      type: Number,
      default: 10
    },
    personal: {
      type: Number,
      default: 5
    },
    maternity: {
      type: Number,
      default: 0
    },
    paternity: {
      type: Number,
      default: 0
    }
  },
  
  // Personal Information
  dateOfBirth: {
    type: Date
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    email: String
  },
  
  // Profile and Settings
  profilePicture: {
    type: String,
    default: null
  },
  isFirstLogin: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  
  // Audit Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Indexes
employeeSchema.index({ email: 1 });
employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ status: 1 });
employeeSchema.index({ department: 1 });

// Virtual for full name
employeeSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for years of service
employeeSchema.virtual('yearsOfService').get(function() {
  if (!this.hireDate) return 0;
  const now = new Date();
  const hireDate = new Date(this.hireDate);
  return Math.floor((now - hireDate) / (365.25 * 24 * 60 * 60 * 1000));
});

// Pre-save middleware to hash password
employeeSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
employeeSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if employee can approve leaves
employeeSchema.methods.canApproveLeaves = function() {
  return this.role === 'admin' || this.role === 'manager';
};

// Method to get remaining leave balance
employeeSchema.methods.getRemainingLeave = function(leaveType) {
  return this.leaveBalances[leaveType] || 0;
};

// Method to deduct leave balance
employeeSchema.methods.deductLeave = function(leaveType, days) {
  if (this.leaveBalances[leaveType] >= days) {
    this.leaveBalances[leaveType] -= days;
    return true;
  }
  return false;
};

// Method to restore leave balance (for cancelled/rejected leaves)
employeeSchema.methods.restoreLeave = function(leaveType, days) {
  this.leaveBalances[leaveType] += days;
};

// Static method to find active employees
employeeSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

// Static method to find managers
employeeSchema.statics.findManagers = function() {
  return this.find({ 
    role: { $in: ['admin', 'manager'] },
    status: 'active'
  });
};

// Static method to generate next employee ID
employeeSchema.statics.generateEmployeeId = async function() {
  const lastEmployee = await this.findOne({}, {}, { sort: { 'employeeId': -1 } });
  if (!lastEmployee) {
    return 'EMP001';
  }
  
  const lastId = lastEmployee.employeeId;
  const numericPart = parseInt(lastId.replace('EMP', ''));
  const nextId = (numericPart + 1).toString().padStart(3, '0');
  return `EMP${nextId}`;
};

// Method to update last login
employeeSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.isFirstLogin = false;
  return this.save();
};

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;