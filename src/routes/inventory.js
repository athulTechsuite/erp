const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../config/database');

// Get all inventory items with pagination and search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';

    let query = `
      SELECT i.*, c.name as category_name 
      FROM inventory_items i 
      LEFT JOIN inventory_categories c ON i.category_id = c.id 
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM inventory_items i 
      LEFT JOIN inventory_categories c ON i.category_id = c.id 
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];

    if (search) {
      query += ` AND (i.name ILIKE $${params.length + 1} OR i.description ILIKE $${params.length + 1} OR i.sku ILIKE $${params.length + 1})`;
      countQuery += ` AND (i.name ILIKE $${countParams.length + 1} OR i.description ILIKE $${countParams.length + 1} OR i.sku ILIKE $${countParams.length + 1})`;
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    if (category) {
      query += ` AND i.category_id = $${params.length + 1}`;
      countQuery += ` AND i.category_id = $${countParams.length + 1}`;
      params.push(category);
      countParams.push(category);
    }

    query += ` ORDER BY i.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [items, totalResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams)
    ]);

    const total = parseInt(totalResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      items: items.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    res.status(500).json({ message: 'Error fetching inventory items' });
  }
});

// Get inventory item by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT i.*, c.name as category_name 
      FROM inventory_items i 
      LEFT JOIN inventory_categories c ON i.category_id = c.id 
      WHERE i.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({ message: 'Error fetching inventory item' });
  }
});

// Create new inventory item
router.post('/', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const {
      name,
      description,
      sku,
      category_id,
      quantity,
      unit_cost,
      selling_price,
      minimum_stock,
      supplier_info,
      location
    } = req.body;

    // Validate required fields
    if (!name || !sku || quantity === undefined) {
      return res.status(400).json({ 
        message: 'Name, SKU, and quantity are required' 
      });
    }

    // Check if SKU already exists
    const existingItem = await db.query(
      'SELECT id FROM inventory_items WHERE sku = $1',
      [sku]
    );

    if (existingItem.rows.length > 0) {
      return res.status(409).json({ 
        message: 'SKU already exists' 
      });
    }

    const result = await db.query(`
      INSERT INTO inventory_items (
        name, description, sku, category_id, quantity, unit_cost, 
        selling_price, minimum_stock, supplier_info, location, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      name, description, sku, category_id, quantity, unit_cost,
      selling_price, minimum_stock, supplier_info, location, req.user.userId
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ message: 'Error creating inventory item' });
  }
});

// Update inventory item
router.put('/:id', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      sku,
      category_id,
      quantity,
      unit_cost,
      selling_price,
      minimum_stock,
      supplier_info,
      location
    } = req.body;

    // Check if item exists
    const existingItem = await db.query(
      'SELECT id FROM inventory_items WHERE id = $1',
      [id]
    );

    if (existingItem.rows.length === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Check if SKU already exists for other items
    if (sku) {
      const duplicateSKU = await db.query(
        'SELECT id FROM inventory_items WHERE sku = $1 AND id != $2',
        [sku, id]
      );

      if (duplicateSKU.rows.length > 0) {
        return res.status(409).json({ 
          message: 'SKU already exists for another item' 
        });
      }
    }

    const result = await db.query(`
      UPDATE inventory_items 
      SET name = $1, description = $2, sku = $3, category_id = $4, 
          quantity = $5, unit_cost = $6, selling_price = $7, 
          minimum_stock = $8, supplier_info = $9, location = $10, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `, [
      name, description, sku, category_id, quantity, unit_cost,
      selling_price, minimum_stock, supplier_info, location, id
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ message: 'Error updating inventory item' });
  }
});

// Delete inventory item
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM inventory_items WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ message: 'Error deleting inventory item' });
  }
});

// Update stock quantity
router.patch('/:id/stock', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, operation, notes } = req.body;

    if (!['add', 'subtract', 'set'].includes(operation)) {
      return res.status(400).json({ 
        message: 'Invalid operation. Must be add, subtract, or set' 
      });
    }

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ 
        message: 'Quantity must be a non-negative number' 
      });
    }

    // Get current item
    const currentItem = await db.query(
      'SELECT * FROM inventory_items WHERE id = $1',
      [id]
    );

    if (currentItem.rows.length === 0) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    let newQuantity;
    const currentQuantity = currentItem.rows[0].quantity;

    switch (operation) {
      case 'add':
        newQuantity = currentQuantity + quantity;
        break;
      case 'subtract':
        newQuantity = Math.max(0, currentQuantity - quantity);
        break;
      case 'set':
        newQuantity = quantity;
        break;
    }

    // Update inventory
    const updatedItem = await db.query(`
      UPDATE inventory_items 
      SET quantity = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [newQuantity, id]);

    // Log stock movement
    await db.query(`
      INSERT INTO stock_movements (
        item_id, movement_type, quantity, previous_quantity, 
        new_quantity, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      id, operation, quantity, currentQuantity, 
      newQuantity, notes || '', req.user.userId
    ]);

    res.json(updatedItem.rows[0]);
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ message: 'Error updating stock' });
  }
});

// Get low stock items
router.get('/alerts/low-stock', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT i.*, c.name as category_name 
      FROM inventory_items i 
      LEFT JOIN inventory_categories c ON i.category_id = c.id 
      WHERE i.quantity <= i.minimum_stock
      ORDER BY (i.quantity - i.minimum_stock) ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ message: 'Error fetching low stock items' });
  }
});

// Get inventory categories
router.get('/categories/list', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, COUNT(i.id) as item_count 
      FROM inventory_categories c 
      LEFT JOIN inventory_items i ON c.id = i.category_id 
      GROUP BY c.id 
      ORDER BY c.name ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

// Create inventory category
router.post('/categories', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const result = await db.query(`
      INSERT INTO inventory_categories (name, description)
      VALUES ($1, $2)
      RETURNING *
    `, [name, description || '']);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ message: 'Category name already exists' });
    }
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Error creating category' });
  }
});

// Get stock movement history
router.get('/:id/movements', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT sm.*, u.first_name, u.last_name 
      FROM stock_movements sm 
      LEFT JOIN users u ON sm.created_by = u.id 
      WHERE sm.item_id = $1 
      ORDER BY sm.created_at DESC 
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const totalResult = await db.query(
      'SELECT COUNT(*) as total FROM stock_movements WHERE item_id = $1',
      [id]
    );

    const total = parseInt(totalResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      movements: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({ message: 'Error fetching stock movements' });
  }
});

module.exports = router;