const mongoose = require('mongoose');

const financialRecordSchema = new mongoose.Schema({
  recordId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return 'FIN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
    }
  },
  type: {
    type: String,
    required: true,
    enum: ['income', 'expense', 'asset', 'liability', 'equity'],
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      // Income categories
      'sales_revenue', 'service_revenue', 'other_income',
      // Expense categories
      'salaries_wages', 'office_supplies', 'utilities', 'rent', 'marketing', 'travel', 'software', 'other_expense',
      // Asset categories
      'cash', 'accounts_receivable', 'inventory', 'equipment', 'other_asset',
      // Liability categories
      'accounts_payable', 'loans', 'taxes_payable', 'other_liability',
      // Equity categories
      'owner_equity', 'retained_earnings'
    ]
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Amount must be a positive number'
    }
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true,
    minlength: 3,
    maxlength: 3
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  transactionDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  dueDate: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true;
        return value >= this.transactionDate;
      },
      message: 'Due date cannot be before transaction date'
    }
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'cancelled', 'overdue'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'credit_card', 'debit_card', 'check', 'digital_wallet', 'other'],
    required: function() {
      return this.status === 'completed';
    }
  },
  reference: {
    invoiceNumber: String,
    receiptNumber: String,
    checkNumber: String,
    transactionId: String
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    uploadDate: {
      type: Date,
      default: Date.now
    },
    url: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: Date,
  notes: String,
  fiscalYear: {
    type: Number,
    required: true,
    default: function() {
      return new Date(this.transactionDate).getFullYear();
    }
  },
  fiscalQuarter: {
    type: Number,
    required: true,
    min: 1,
    max: 4,
    default: function() {
      const month = new Date(this.transactionDate).getMonth() + 1;
      return Math.ceil(month / 3);
    }
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'annually']
    },
    interval: {
      type: Number,
      min: 1
    },
    endDate: Date,
    nextDate: Date
  },
  reconciled: {
    type: Boolean,
    default: false
  },
  reconciledDate: Date,
  reconciledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
financialRecordSchema.index({ type: 1, transactionDate: -1 });
financialRecordSchema.index({ category: 1, transactionDate: -1 });
financialRecordSchema.index({ status: 1, dueDate: 1 });
financialRecordSchema.index({ fiscalYear: 1, fiscalQuarter: 1 });
financialRecordSchema.index({ createdBy: 1 });
financialRecordSchema.index({ tags: 1 });

// Virtual for formatted amount
financialRecordSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency
  }).format(this.amount);
});

// Virtual for days overdue
financialRecordSchema.virtual('daysOverdue').get(function() {
  if (!this.dueDate || this.status === 'completed') return 0;
  const today = new Date();
  const diffTime = today - this.dueDate;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

// Pre-save middleware to update status based on due date
financialRecordSchema.pre('save', function(next) {
  // Update status to overdue if past due date
  if (this.dueDate && this.status === 'pending') {
    const today = new Date();
    if (today > this.dueDate) {
      this.status = 'overdue';
    }
  }

  // Set fiscal year and quarter if not provided
  if (!this.fiscalYear) {
    this.fiscalYear = new Date(this.transactionDate).getFullYear();
  }
  if (!this.fiscalQuarter) {
    const month = new Date(this.transactionDate).getMonth() + 1;
    this.fiscalQuarter = Math.ceil(month / 3);
  }

  // Set next recurring date
  if (this.isRecurring && this.recurringPattern && this.recurringPattern.frequency) {
    const nextDate = new Date(this.transactionDate);
    const interval = this.recurringPattern.interval || 1;
    
    switch (this.recurringPattern.frequency) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (7 * interval));
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + interval);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + (3 * interval));
        break;
      case 'annually':
        nextDate.setFullYear(nextDate.getFullYear() + interval);
        break;
    }
    
    this.recurringPattern.nextDate = nextDate;
  }

  next();
});

// Static methods for financial calculations
financialRecordSchema.statics.getBalanceSheet = async function(date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const assets = await this.aggregate([
    {
      $match: {
        type: 'asset',
        transactionDate: { $lte: startOfDay },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    }
  ]);

  const liabilities = await this.aggregate([
    {
      $match: {
        type: 'liability',
        transactionDate: { $lte: startOfDay },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    }
  ]);

  const equity = await this.aggregate([
    {
      $match: {
        type: 'equity',
        transactionDate: { $lte: startOfDay },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    }
  ]);

  return { assets, liabilities, equity };
};

financialRecordSchema.statics.getProfitAndLoss = async function(startDate, endDate) {
  const income = await this.aggregate([
    {
      $match: {
        type: 'income',
        transactionDate: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    }
  ]);

  const expenses = await this.aggregate([
    {
      $match: {
        type: 'expense',
        transactionDate: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    }
  ]);

  const totalIncome = income.reduce((sum, item) => sum + item.total, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.total, 0);
  const netProfit = totalIncome - totalExpenses;

  return { income, expenses, totalIncome, totalExpenses, netProfit };
};

financialRecordSchema.statics.getCashFlow = async function(startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        transactionDate: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
          month: { $month: '$transactionDate' },
          year: { $year: '$transactionDate' }
        },
        total: { $sum: '$amount' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);
};

module.exports = mongoose.model('FinancialRecord', financialRecordSchema);