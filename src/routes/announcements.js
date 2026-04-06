const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../database/connection');

// Get all published announcements (accessible to all authenticated users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT id, title, content, created_at, updated_at 
      FROM announcements 
      WHERE is_published = true 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    const result = await db.query(query);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
});

// Get all announcements for admin management (admin only)
router.get('/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT id, title, content, is_published, created_at, updated_at, created_by
      FROM announcements 
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching admin announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
});

// Create new announcement (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, content, is_published = false } = req.body;
    
    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }
    
    if (title.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Title must be 200 characters or less'
      });
    }
    
    if (content.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Content must be 5000 characters or less'
      });
    }
    
    const query = `
      INSERT INTO announcements (title, content, is_published, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, title, content, is_published, created_at, updated_at, created_by
    `;
    
    const values = [title.trim(), content.trim(), is_published, req.user.id];
    const result = await db.query(query, values);
    
    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement'
    });
  }
});

// Update announcement (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, is_published } = req.body;
    
    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }
    
    if (title.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Title must be 200 characters or less'
      });
    }
    
    if (content.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Content must be 5000 characters or less'
      });
    }
    
    // Check if announcement exists
    const checkQuery = 'SELECT id FROM announcements WHERE id = $1';
    const checkResult = await db.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    const query = `
      UPDATE announcements 
      SET title = $1, content = $2, is_published = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING id, title, content, is_published, created_at, updated_at, created_by
    `;
    
    const values = [title.trim(), content.trim(), is_published, id];
    const result = await db.query(query, values);
    
    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement'
    });
  }
});

// Delete announcement (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if announcement exists
    const checkQuery = 'SELECT id FROM announcements WHERE id = $1';
    const checkResult = await db.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    const query = 'DELETE FROM announcements WHERE id = $1';
    await db.query(query, [id]);
    
    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement'
    });
  }
});

// Toggle publication status (admin only)
router.patch('/:id/toggle-publish', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if announcement exists and get current status
    const checkQuery = 'SELECT id, is_published FROM announcements WHERE id = $1';
    const checkResult = await db.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    const currentStatus = checkResult.rows[0].is_published;
    const newStatus = !currentStatus;
    
    const query = `
      UPDATE announcements 
      SET is_published = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, title, content, is_published, created_at, updated_at, created_by
    `;
    
    const result = await db.query(query, [newStatus, id]);
    
    res.json({
      success: true,
      message: `Announcement ${newStatus ? 'published' : 'unpublished'} successfully`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error toggling announcement publication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement status'
    });
  }
});

module.exports = router;