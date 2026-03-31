const Announcement = require('../models/Announcement');
const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads/announcements';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'announcement-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Middleware to check admin access
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// Get all announcements
const getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: announcements,
      count: announcements.length
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get announcement by ID
const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id)
      .populate('createdBy', 'firstName lastName email');

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
      message: 'Failed to fetch announcement',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Create new announcement (Admin only)
const createAnnouncement = [
  upload.single('image'),
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Clean up uploaded file if validation fails
        if (req.file) {
          try {
            await fs.unlink(req.file.path);
          } catch (unlinkError) {
            console.error('Error deleting uploaded file:', unlinkError);
          }
        }
        
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { title, content, priority } = req.body;

      // Validate required fields
      if (!title || !content) {
        // Clean up uploaded file
        if (req.file) {
          try {
            await fs.unlink(req.file.path);
          } catch (unlinkError) {
            console.error('Error deleting uploaded file:', unlinkError);
          }
        }
        
        return res.status(400).json({
          success: false,
          message: 'Title and content are required'
        });
      }

      const announcementData = {
        title: title.trim(),
        content: content.trim(),
        priority: priority || 'normal',
        createdBy: req.user._id
      };

      // Add image path if uploaded
      if (req.file) {
        announcementData.imagePath = req.file.path;
        announcementData.imageUrl = `/uploads/announcements/${req.file.filename}`;
      }

      const announcement = new Announcement(announcementData);
      const savedAnnouncement = await announcement.save();

      // Populate creator info for response
      await savedAnnouncement.populate('createdBy', 'firstName lastName email');

      res.status(201).json({
        success: true,
        message: 'Announcement created successfully',
        data: savedAnnouncement
      });
    } catch (error) {
      console.error('Error creating announcement:', error);
      
      // Clean up uploaded file on error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create announcement',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
];

// Update announcement (Admin only)
const updateAnnouncement = [
  upload.single('image'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content, priority } = req.body;

      const announcement = await Announcement.findById(id);
      if (!announcement) {
        // Clean up uploaded file if announcement not found
        if (req.file) {
          try {
            await fs.unlink(req.file.path);
          } catch (unlinkError) {
            console.error('Error deleting uploaded file:', unlinkError);
          }
        }
        
        return res.status(404).json({
          success: false,
          message: 'Announcement not found'
        });
      }

      // Update fields
      if (title) announcement.title = title.trim();
      if (content) announcement.content = content.trim();
      if (priority) announcement.priority = priority;

      // Handle image update
      if (req.file) {
        // Delete old image if exists
        if (announcement.imagePath) {
          try {
            await fs.unlink(announcement.imagePath);
          } catch (unlinkError) {
            console.error('Error deleting old image:', unlinkError);
          }
        }
        
        announcement.imagePath = req.file.path;
        announcement.imageUrl = `/uploads/announcements/${req.file.filename}`;
      }

      announcement.updatedAt = new Date();
      const updatedAnnouncement = await announcement.save();

      // Populate creator info for response
      await updatedAnnouncement.populate('createdBy', 'firstName lastName email');

      res.json({
        success: true,
        message: 'Announcement updated successfully',
        data: updatedAnnouncement
      });
    } catch (error) {
      console.error('Error updating announcement:', error);
      
      // Clean up uploaded file on error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update announcement',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
];

// Delete announcement (Admin only)
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Delete associated image file if exists
    if (announcement.imagePath) {
      try {
        await fs.unlink(announcement.imagePath);
      } catch (unlinkError) {
        console.error('Error deleting image file:', unlinkError);
        // Continue with deletion even if file cleanup fails
      }
    }

    await Announcement.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get recent announcements for dashboard
const getRecentAnnouncements = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const announcements = await Announcement.find()
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: announcements,
      count: announcements.length
    });
  } catch (error) {
    console.error('Error fetching recent announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent announcements',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Toggle announcement active status (Admin only)
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    announcement.isActive = !announcement.isActive;
    announcement.updatedAt = new Date();
    
    const updatedAnnouncement = await announcement.save();
    await updatedAnnouncement.populate('createdBy', 'firstName lastName email');

    res.json({
      success: true,
      message: `Announcement ${updatedAnnouncement.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedAnnouncement
    });
  } catch (error) {
    console.error('Error toggling announcement status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  getAllAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getRecentAnnouncements,
  toggleAnnouncementStatus,
  requireAdmin
};