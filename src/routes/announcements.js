const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, validationResult } = require('express-validator');
const Announcement = require('../models/Announcement');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads/announcements');
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
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Validation middleware
const validateAnnouncement = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Content must be between 1 and 5000 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high')
];

// GET /api/announcements - Get all announcements (accessible to all authenticated users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('createdBy', 'name email')
      .sort({ priority: -1, createdAt: -1 });

    res.json({
      success: true,
      data: announcements
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/announcements/:id - Get single announcement
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('createdBy', 'name email');

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
});

// POST /api/announcements - Create new announcement (admin only)
router.post('/', 
  authenticateToken, 
  requireRole(['admin']),
  upload.single('image'),
  validateAnnouncement,
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

      const { title, content, priority = 'medium' } = req.body;

      // Prepare announcement data
      const announcementData = {
        title,
        content,
        priority,
        createdBy: req.user.id
      };

      // Add image path if uploaded
      if (req.file) {
        announcementData.imageUrl = `/uploads/announcements/${req.file.filename}`;
      }

      const announcement = new Announcement(announcementData);
      await announcement.save();

      // Populate creator info for response
      await announcement.populate('createdBy', 'name email');

      res.status(201).json({
        success: true,
        message: 'Announcement created successfully',
        data: announcement
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }

      console.error('Error creating announcement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create announcement',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// PUT /api/announcements/:id - Update announcement (admin only)
router.put('/:id',
  authenticateToken,
  requireRole(['admin']),
  upload.single('image'),
  validateAnnouncement,
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

      const announcement = await Announcement.findById(req.params.id);
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

      const { title, content, priority } = req.body;

      // Update fields
      announcement.title = title;
      announcement.content = content;
      announcement.priority = priority || announcement.priority;
      announcement.updatedAt = new Date();

      // Handle image update
      if (req.file) {
        // Delete old image if exists
        if (announcement.imageUrl) {
          const oldImagePath = path.join(__dirname, '../public', announcement.imageUrl);
          try {
            await fs.unlink(oldImagePath);
          } catch (unlinkError) {
            console.error('Error deleting old image:', unlinkError);
          }
        }
        announcement.imageUrl = `/uploads/announcements/${req.file.filename}`;
      }

      await announcement.save();
      await announcement.populate('createdBy', 'name email');

      res.json({
        success: true,
        message: 'Announcement updated successfully',
        data: announcement
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }

      console.error('Error updating announcement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update announcement',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// DELETE /api/announcements/:id - Delete announcement (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Delete associated image file if exists
    if (announcement.imageUrl) {
      const imagePath = path.join(__dirname, '../public', announcement.imageUrl);
      try {
        await fs.unlink(imagePath);
      } catch (unlinkError) {
        console.error('Error deleting image file:', unlinkError);
        // Continue with deletion even if image file couldn't be deleted
      }
    }

    await Announcement.findByIdAndDelete(req.params.id);

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
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
  }
  
  if (error.message === 'Only image files (jpeg, jpg, png, gif) are allowed') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next(error);
});

module.exports = router;