const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Rate limiting middleware
const announcementRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
router.use(announcementRateLimit);

// Get all active announcements (accessible to all authenticated users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const announcements = await db.query(
      `SELECT id, title, content, created_at, updated_at 
       FROM announcements 
       WHERE is_active = true 
       ORDER BY created_at DESC`
    );
    res.json(announcements.rows);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Get all announcements for admin management
router.get('/admin', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const announcements = await db.query(
      `SELECT id, title, content, is_active, created_at, updated_at 
       FROM announcements 
       ORDER BY created_at DESC`
    );
    res.json(announcements.rows);
  } catch (error) {
    console.error('Error fetching announcements for admin:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Create new announcement (admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { title, content, is_active = true } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (title.length > 255) {
      return res.status(400).json({ error: 'Title must be 255 characters or less' });
    }

    const result = await db.query(
      `INSERT INTO announcements (title, content, is_active, created_by) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, title, content, is_active, created_at, updated_at`,
      [title, content, is_active, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// Update announcement (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, is_active } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (title.length > 255) {
      return res.status(400).json({ error: 'Title must be 255 characters or less' });
    }

    const result = await db.query(
      `UPDATE announcements 
       SET title = $1, content = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING id, title, content, is_active, created_at, updated_at`,
      [title, content, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// Delete announcement (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM announcements WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// Get single announcement by ID (admin only)
router.get('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, title, content, is_active, created_at, updated_at 
       FROM announcements 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching announcement:', error);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

module.exports = router;