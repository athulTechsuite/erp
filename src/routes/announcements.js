const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Get all active announcements (for employees and admins)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');
    
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ 
      message: 'Failed to fetch announcements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all announcements (admin only - includes inactive ones)
router.get('/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');
    
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching admin announcements:', error);
    res.status(500).json({ 
      message: 'Failed to fetch announcements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new announcement (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    
    // Validation
    if (!title || !content) {
      return res.status(400).json({ 
        message: 'Title and content are required' 
      });
    }
    
    if (title.length > 200) {
      return res.status(400).json({ 
        message: 'Title must be 200 characters or less' 
      });
    }
    
    if (content.length > 2000) {
      return res.status(400).json({ 
        message: 'Content must be 2000 characters or less' 
      });
    }
    
    const announcement = new Announcement({
      title: title.trim(),
      content: content.trim(),
      createdBy: req.user.id,
      isActive: true
    });
    
    await announcement.save();
    await announcement.populate('createdBy', 'name email');
    
    res.status(201).json({
      message: 'Announcement created successfully',
      announcement
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ 
      message: 'Failed to create announcement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update announcement (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, isActive } = req.body;
    
    // Validation
    if (!title || !content) {
      return res.status(400).json({ 
        message: 'Title and content are required' 
      });
    }
    
    if (title.length > 200) {
      return res.status(400).json({ 
        message: 'Title must be 200 characters or less' 
      });
    }
    
    if (content.length > 2000) {
      return res.status(400).json({ 
        message: 'Content must be 2000 characters or less' 
      });
    }
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ 
        message: 'Announcement not found' 
      });
    }
    
    announcement.title = title.trim();
    announcement.content = content.trim();
    announcement.isActive = isActive !== undefined ? isActive : announcement.isActive;
    announcement.updatedAt = new Date();
    
    await announcement.save();
    await announcement.populate('createdBy', 'name email');
    
    res.json({
      message: 'Announcement updated successfully',
      announcement
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid announcement ID' 
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to update announcement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete announcement (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ 
        message: 'Announcement not found' 
      });
    }
    
    await Announcement.findByIdAndDelete(id);
    
    res.json({
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid announcement ID' 
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to delete announcement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Toggle announcement status (admin only)
router.patch('/:id/toggle', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ 
        message: 'Announcement not found' 
      });
    }
    
    announcement.isActive = !announcement.isActive;
    announcement.updatedAt = new Date();
    
    await announcement.save();
    await announcement.populate('createdBy', 'name email');
    
    res.json({
      message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'} successfully`,
      announcement
    });
  } catch (error) {
    console.error('Error toggling announcement status:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid announcement ID' 
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to toggle announcement status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;