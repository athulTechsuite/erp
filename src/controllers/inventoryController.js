const Inventory = require('../models/Inventory');
const { validationResult } = require('express-validator');

// Get all inventory items
const getInventoryItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const status = req.query.status || '';

    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const items = await Inventory.find(filter)
      .populate('addedBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Inventory.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get inventory items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory items',
      error: error.message
    });
  }
};

// Get inventory item by ID
const getInventoryItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Inventory.findById(id)
      .populate('addedBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Get inventory item by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory item',
      error: error.message
    });
  }
};

// Create new inventory item
const createInventoryItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      sku,
      description,
      category,
      quantity,
      minQuantity,
      maxQuantity,
      unitPrice,
      supplier,
      location,
      notes
    } = req.body;

    // Check if SKU already exists
    const existingSku = await Inventory.findOne({ sku });
    if (existingSku) {
      return res.status(400).json({
        success: false,
        message: 'SKU already exists'
      });
    }

    // Determine status based on quantity
    let status = 'in_stock';
    if (quantity === 0) {
      status = 'out_of_stock';
    } else if (quantity <= minQuantity) {
      status = 'low_stock';
    }

    const newItem = new Inventory({
      name,
      sku,
      description,
      category,
      quantity,
      minQuantity,
      maxQuantity,
      unitPrice,
      supplier,
      location,
      status,
      notes,
      addedBy: req.user.id,
      lastModifiedBy: req.user.id
    });

    await newItem.save();

    const populatedItem = await Inventory.findById(newItem._id)
      .populate('addedBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: populatedItem
    });
  } catch (error) {
    console.error('Create inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create inventory item',
      error: error.message
    });
  }
};

// Update inventory item
const updateInventoryItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const existingItem = await Inventory.findById(id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check if SKU is being changed and if new SKU already exists
    if (updateData.sku && updateData.sku !== existingItem.sku) {
      const existingSku = await Inventory.findOne({ sku: updateData.sku });
      if (existingSku) {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }
    }

    // Update status based on quantity if quantity is being updated
    if (updateData.quantity !== undefined) {
      const minQty = updateData.minQuantity || existingItem.minQuantity;
      if (updateData.quantity === 0) {
        updateData.status = 'out_of_stock';
      } else if (updateData.quantity <= minQty) {
        updateData.status = 'low_stock';
      } else {
        updateData.status = 'in_stock';
      }
    }

    updateData.lastModifiedBy = req.user.id;
    updateData.updatedAt = new Date();

    const updatedItem = await Inventory.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('addedBy', 'name email')
     .populate('lastModifiedBy', 'name email');

    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      data: updatedItem
    });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inventory item',
      error: error.message
    });
  }
};

// Delete inventory item
const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    await Inventory.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete inventory item',
      error: error.message
    });
  }
};

// Adjust inventory quantity
const adjustInventoryQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reason } = req.body;

    if (typeof quantity !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a number'
      });
    }

    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    const oldQuantity = item.quantity;
    const newQuantity = Math.max(0, oldQuantity + quantity);

    // Determine new status
    let status = 'in_stock';
    if (newQuantity === 0) {
      status = 'out_of_stock';
    } else if (newQuantity <= item.minQuantity) {
      status = 'low_stock';
    }

    const updatedItem = await Inventory.findByIdAndUpdate(
      id,
      {
        quantity: newQuantity,
        status,
        lastModifiedBy: req.user.id,
        updatedAt: new Date(),
        $push: {
          quantityHistory: {
            previousQuantity: oldQuantity,
            newQuantity,
            adjustment: quantity,
            reason: reason || 'Manual adjustment',
            adjustedBy: req.user.id,
            date: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    ).populate('addedBy', 'name email')
     .populate('lastModifiedBy', 'name email');

    res.json({
      success: true,
      message: 'Inventory quantity adjusted successfully',
      data: updatedItem
    });
  } catch (error) {
    console.error('Adjust inventory quantity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to adjust inventory quantity',
      error: error.message
    });
  }
};

// Get inventory statistics
const getInventoryStats = async (req, res) => {
  try {
    const totalItems = await Inventory.countDocuments();
    const inStockItems = await Inventory.countDocuments({ status: 'in_stock' });
    const lowStockItems = await Inventory.countDocuments({ status: 'low_stock' });
    const outOfStockItems = await Inventory.countDocuments({ status: 'out_of_stock' });

    // Calculate total inventory value
    const inventoryValue = await Inventory.aggregate([
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: { $multiply: ['$quantity', '$unitPrice'] }
          }
        }
      }
    ]);

    // Get category breakdown
    const categoryStats = await Inventory.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$quantity', '$unitPrice'] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get low stock items
    const lowStockItemsList = await Inventory.find({ status: 'low_stock' })
      .select('name sku quantity minQuantity')
      .limit(10);

    res.json({
      success: true,
      data: {
        summary: {
          totalItems,
          inStockItems,
          lowStockItems: lowStockItems,
          outOfStockItems,
          totalValue: inventoryValue.length > 0 ? inventoryValue[0].totalValue : 0
        },
        categoryStats,
        lowStockItemsList
      }
    });
  } catch (error) {
    console.error('Get inventory stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory statistics',
      error: error.message
    });
  }
};

// Export inventory data
const exportInventoryData = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const items = await Inventory.find()
      .populate('addedBy', 'name')
      .populate('lastModifiedBy', 'name')
      .select('-quantityHistory -__v')
      .sort({ name: 1 });

    if (format === 'csv') {
      const csv = convertToCSV(items);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory-export.csv');
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: items,
        exportDate: new Date(),
        totalItems: items.length
      });
    }
  } catch (error) {
    console.error('Export inventory data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export inventory data',
      error: error.message
    });
  }
};

// Helper function to convert data to CSV
const convertToCSV = (data) => {
  if (!data.length) return '';

  const headers = [
    'Name', 'SKU', 'Category', 'Quantity', 'Min Quantity', 'Max Quantity',
    'Unit Price', 'Status', 'Supplier', 'Location', 'Created At'
  ];

  const csvRows = [headers.join(',')];

  data.forEach(item => {
    const row = [
      `"${item.name}"`,
      `"${item.sku}"`,
      `"${item.category}"`,
      item.quantity,
      item.minQuantity,
      item.maxQuantity || '',
      item.unitPrice,
      `"${item.status}"`,
      `"${item.supplier || ''}"`,
      `"${item.location || ''}"`,
      `"${item.createdAt.toISOString()}"`
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
};

module.exports = {
  getInventoryItems,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustInventoryQuantity,
  getInventoryStats,
  exportInventoryData
};