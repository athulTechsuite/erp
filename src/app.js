const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'announcement-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// In-memory storage for announcements (replace with database in production)
let announcements = [];
let nextAnnouncementId = 1;

// Mock user authentication middleware
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Mock user data - in production, decode JWT and fetch from database
  const token = authHeader.split(' ')[1];
  if (token === 'admin-token') {
    req.user = { id: 1, role: 'admin', name: 'Admin User' };
  } else if (token === 'manager-token') {
    req.user = { id: 2, role: 'manager', name: 'Manager User' };
  } else if (token === 'employee-token') {
    req.user = { id: 3, role: 'employee', name: 'Employee User' };
  } else {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  next();
};

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Validation middleware
const validateAnnouncement = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ max: 2000 })
    .withMessage('Content must be less than 2000 characters')
];

// Error handling middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all announcements (accessible by all authenticated users)
app.get('/api/announcements', authenticateUser, (req, res) => {
  try {
    const sortedAnnouncements = announcements
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(announcement => ({
        ...announcement,
        canManage: req.user.role === 'admin'
      }));
    
    res.json({
      announcements: sortedAnnouncements,
      total: sortedAnnouncements.length
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Get single announcement
app.get('/api/announcements/:id', authenticateUser, (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const announcement = announcements.find(a => a.id === announcementId);
    
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    
    res.json({
      ...announcement,
      canManage: req.user.role === 'admin'
    });
  } catch (error) {
    console.error('Error fetching announcement:', error);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

// Create announcement (admin only)
app.post('/api/announcements', 
  authenticateUser,
  requireAdmin,
  upload.single('image'),
  validateAnnouncement,
  handleValidationErrors,
  (req, res) => {
    try {
      const { title, content } = req.body;
      
      const newAnnouncement = {
        id: nextAnnouncementId++,
        title,
        content,
        imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
        createdBy: {
          id: req.user.id,
          name: req.user.name
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      announcements.push(newAnnouncement);
      
      res.status(201).json({
        message: 'Announcement created successfully',
        announcement: {
          ...newAnnouncement,
          canManage: true
        }
      });
    } catch (error) {
      console.error('Error creating announcement:', error);
      
      // Clean up uploaded file if announcement creation fails
      if (req.file) {
        fs.unlink(req.file.path, (unlinkError) => {
          if (unlinkError) console.error('Error deleting file:', unlinkError);
        });
      }
      
      res.status(500).json({ error: 'Failed to create announcement' });
    }
  }
);

// Delete announcement (admin only)
app.delete('/api/announcements/:id', authenticateUser, requireAdmin, (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const announcementIndex = announcements.findIndex(a => a.id === announcementId);
    
    if (announcementIndex === -1) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    
    const announcement = announcements[announcementIndex];
    
    // Delete associated image file if exists
    if (announcement.imageUrl) {
      const imagePath = path.join(__dirname, announcement.imageUrl);
      fs.unlink(imagePath, (error) => {
        if (error) console.error('Error deleting image file:', error);
      });
    }
    
    // Remove announcement from array
    announcements.splice(announcementIndex, 1);
    
    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// Get dashboard data including announcements
app.get('/api/dashboard', authenticateUser, (req, res) => {
  try {
    const recentAnnouncements = announcements
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(announcement => ({
        ...announcement,
        canManage: req.user.role === 'admin'
      }));
    
    const dashboardData = {
      user: req.user,
      announcements: recentAnnouncements,
      stats: {
        totalAnnouncements: announcements.length,
        canCreateAnnouncements: req.user.role === 'admin'
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: 'File upload error: ' + error.message });
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({ error: 'Only image files are allowed' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;