const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const announcementController = require('../controllers/announcementController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/announcements/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

// Public routes (authenticated users)
router.get('/announcements', authMiddleware, announcementController.getAnnouncements);
router.get('/announcements/:id', authMiddleware, announcementController.getAnnouncementById);
router.patch('/announcements/:id/read', authMiddleware, announcementController.markAsRead);
router.patch('/announcements/:id/unread', authMiddleware, announcementController.markAsUnread);

// Admin routes
router.post('/announcements', 
  authMiddleware, 
  adminMiddleware, 
  upload.array('attachments', 5), 
  announcementController.createAnnouncement
);

router.put('/announcements/:id', 
  authMiddleware, 
  adminMiddleware, 
  upload.array('attachments', 5), 
  announcementController.updateAnnouncement
);

router.delete('/announcements/:id', 
  authMiddleware, 
  adminMiddleware, 
  announcementController.deleteAnnouncement
);

router.get('/announcements/:id/stats', 
  authMiddleware, 
  adminMiddleware, 
  announcementController.getAnnouncementStats
);

router.post('/announcements/:id/schedule', 
  authMiddleware, 
  adminMiddleware, 
  announcementController.scheduleAnnouncement
);

router.delete('/announcements/:id/attachments/:attachmentId', 
  authMiddleware, 
  adminMiddleware, 
  announcementController.removeAttachment
);

// Archive management
router.get('/announcements/archived', 
  authMiddleware, 
  adminMiddleware, 
  announcementController.getArchivedAnnouncements
);

router.post('/announcements/archive-old', 
  authMiddleware, 
  adminMiddleware, 
  announcementController.archiveOldAnnouncements
);

// Dashboard route
router.get('/', authMiddleware, (req, res) => {
  res.render('dashboard', { 
    title: 'Dashboard',
    user: req.user 
  });
});

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;