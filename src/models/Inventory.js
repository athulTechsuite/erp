const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  itemCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: 20
  },
  category: {
    type: String,
    required: true,
    enum: [
      'IT Equipment',
      'Office Supplies',
      'Furniture',
      'Vehicles',
      'Machinery',
      'Tools',
      'Software',
      'Other'
    ]
  },
  description: {
    type: String,
    maxlength: 500
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalValue: {
    type: Number,
    default: 0
  },
  supplier: {
    name: {
      type: String,
      trim: true,
      maxlength: 100
    },
    contact: {
      type: String,
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    }
  },
  location: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  status: {
    type: String,
    required: true,
    enum: ['Available', 'Assigned', 'Maintenance', 'Damaged', 'Disposed'],
    default: 'Available'
  },
  purchaseDate: {
    type: Date
  },
  warrantyExpiry: {
    type: Date
  },
  depreciationRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  currentValue: {
    type: Number,
    min: 0
  },
  minStockLevel: {
    type: Number,
    min: 0,
    default: 1
  },
  isLowStock: {
    type: Boolean,
    default: false
  },
  barcode: {
    type: String,
    trim: true,
    sparse: true,
    unique: true
  },
  serialNumber: {
    type: String,
    trim: true,
    sparse: true
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      maxlength: 100
    }
  }],
  auditTrail: [{
    action: {
      type: String,
      required: true,
      enum: ['Created', 'Updated', 'Assigned', 'Returned', 'Maintenance', 'Disposed']
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: {
      type: String,
      maxlength: 500
    },
    previousValues: {
      type: Object
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
inventorySchema.index({ itemCode: 1 });
inventorySchema.index({ category: 1 });
inventorySchema.index({ status: 1 });
inventorySchema.index({ assignedTo: 1 });
inventorySchema.index({ isLowStock: 1 });
inventorySchema.index({ location: 1 });

// Pre-save middleware to calculate total value and check low stock
inventorySchema.pre('save', function(next) {
  // Calculate total value
  this.totalValue = this.quantity * this.unitPrice;
  
  // Calculate current value based on depreciation
  if (this.purchaseDate && this.depreciationRate > 0) {
    const yearsElapsed = (Date.now() - this.purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const depreciation = (this.totalValue * this.depreciationRate * yearsElapsed) / 100;
    this.currentValue = Math.max(0, this.totalValue - depreciation);
  } else {
    this.currentValue = this.totalValue;
  }
  
  // Check if stock is low
  this.isLowStock = this.quantity <= this.minStockLevel;
  
  next();
});

// Method to add audit trail entry
inventorySchema.methods.addAuditEntry = function(action, performedBy, details = '', previousValues = {}) {
  this.auditTrail.push({
    action,
    performedBy,
    details,
    previousValues
  });
};

// Method to assign item to employee
inventorySchema.methods.assignTo = function(employeeId, performedBy, notes = '') {
  if (this.status !== 'Available') {
    throw new Error('Item is not available for assignment');
  }
  
  const previousValues = {
    assignedTo: this.assignedTo,
    status: this.status
  };
  
  this.assignedTo = employeeId;
  this.status = 'Assigned';
  this.addAuditEntry('Assigned', performedBy, notes, previousValues);
};

// Method to return item from employee
inventorySchema.methods.returnFromEmployee = function(performedBy, notes = '') {
  if (this.status !== 'Assigned') {
    throw new Error('Item is not currently assigned');
  }
  
  const previousValues = {
    assignedTo: this.assignedTo,
    status: this.status
  };
  
  this.assignedTo = undefined;
  this.status = 'Available';
  this.addAuditEntry('Returned', performedBy, notes, previousValues);
};

// Method to update quantity (for stock management)
inventorySchema.methods.updateQuantity = function(newQuantity, performedBy, reason = '') {
  const previousQuantity = this.quantity;
  const action = newQuantity > previousQuantity ? 'Stock Added' : 'Stock Reduced';
  const difference = Math.abs(newQuantity - previousQuantity);
  
  this.quantity = newQuantity;
  this.addAuditEntry('Updated', performedBy, `${action}: ${difference} units. Reason: ${reason}`, {
    quantity: previousQuantity
  });
};

// Static method to get low stock items
inventorySchema.statics.getLowStockItems = function() {
  return this.find({ isLowStock: true, isActive: true });
};

// Static method to get items by category
inventorySchema.statics.getByCategory = function(category) {
  return this.find({ category, isActive: true });
};

// Static method to get assigned items for an employee
inventorySchema.statics.getAssignedItems = function(employeeId) {
  return this.find({ assignedTo: employeeId, isActive: true }).populate('assignedTo', 'firstName lastName');
};

// Static method to get inventory summary
inventorySchema.statics.getInventorySummary = async function() {
  const pipeline = [
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$category',
        totalItems: { $sum: '$quantity' },
        totalValue: { $sum: '$totalValue' },
        currentValue: { $sum: '$currentValue' },
        lowStockItems: { $sum: { $cond: ['$isLowStock', 1, 0] } }
      }
    }
  ];
  
  const categorySummary = await this.aggregate(pipeline);
  
  const overallSummary = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalItems: { $sum: '$quantity' },
        totalValue: { $sum: '$totalValue' },
        currentValue: { $sum: '$currentValue' },
        lowStockItems: { $sum: { $cond: ['$isLowStock', 1, 0] } },
        uniqueItems: { $sum: 1 }
      }
    }
  ]);
  
  return {
    byCategory: categorySummary,
    overall: overallSummary[0] || {
      totalItems: 0,
      totalValue: 0,
      currentValue: 0,
      lowStockItems: 0,
      uniqueItems: 0
    }
  };
};

// Virtual for warranty status
inventorySchema.virtual('warrantyStatus').get(function() {
  if (!this.warrantyExpiry) return 'No warranty info';
  
  const today = new Date();
  const daysToExpiry = Math.ceil((this.warrantyExpiry - today) / (1000 * 60 * 60 * 24));
  
  if (daysToExpiry < 0) return 'Expired';
  if (daysToExpiry <= 30) return 'Expiring soon';
  return 'Active';
});

// Virtual for age in days
inventorySchema.virtual('ageInDays').get(function() {
  if (!this.purchaseDate) return null;
  return Math.floor((Date.now() - this.purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('Inventory', inventorySchema);