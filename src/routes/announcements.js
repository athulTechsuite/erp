const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get all announcements (accessible by all authenticated users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const announcements = await db.all(`
      SELECT id, title, message, created_at, updated_at 
      FROM announcements 
      ORDER BY created_at DESC
    `);
    
    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
});

// Get single announcement by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await db.get(`
      SELECT id, title, message, created_at, updated_at 
      FROM announcements 
      WHERE id = ?
    `, [id]);
    
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    console.error('Error fetching announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcement'
    });
  }
});

// Create new announcement (admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { title, message } = req.body;
    
    // Validation
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }
    
    if (title.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Title must be 255 characters or less'
      });
    }
    
    const result = await db.run(`
      INSERT INTO announcements (title, message, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `, [title.trim(), message.trim()]);
    
    const newAnnouncement = await db.get(`
      SELECT id, title, message, created_at, updated_at 
      FROM announcements 
      WHERE id = ?
    `, [result.lastID]);
    
    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: newAnnouncement
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
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message } = req.body;
    
    // Validation
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }
    
    if (title.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Title must be 255 characters or less'
      });
    }
    
    // Check if announcement exists
    const existingAnnouncement = await db.get(
      'SELECT id FROM announcements WHERE id = ?', 
      [id]
    );
    
    if (!existingAnnouncement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    await db.run(`
      UPDATE announcements 
      SET title = ?, message = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [title.trim(), message.trim(), id]);
    
    const updatedAnnouncement = await db.get(`
      SELECT id, title, message, created_at, updated_at 
      FROM announcements 
      WHERE id = ?
    `, [id]);
    
    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: updatedAnnouncement
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
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if announcement exists
    const existingAnnouncement = await db.get(
      'SELECT id FROM announcements WHERE id = ?', 
      [id]
    );
    
    if (!existingAnnouncement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    
    await db.run('DELETE FROM announcements WHERE id = ?', [id]);
    
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

module.exports = router;