const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const app = express();

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_system', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'erp-system-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_system'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
const authenticateUser = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
  }
  next();
};

// Announcement Schema
const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true,
    maxlength: [2000, 'Content cannot exceed 2000 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const Announcement = mongoose.model('Announcement', announcementSchema);

// User Schema (basic implementation for the system)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'employee'], default: 'employee' },
  firstName: String,
  lastName: String,
  lastLoginAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Notification Schema for in-app notifications
const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['announcement', 'general'],
    default: 'general'
  },
  title: String,
  message: String,
  announcementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Announcement'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Notification = mongoose.model('Notification', notificationSchema);

// Routes

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Basic authentication logic (in production, use proper password hashing)
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    req.session.user = {
      id: user._id,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    };

    res.json({ 
      message: 'Login successful',
      user: req.session.user
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

app.get('/api/auth/me', authenticateUser, (req, res) => {
  res.json({ user: req.session.user });
});

// Announcement routes

// Get all announcements for dashboard widget
app.get('/api/announcements', authenticateUser, async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .populate('createdBy', 'firstName lastName username')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(announcements);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch announcements', error: error.message });
  }
});

// Get single announcement
app.get('/api/announcements/:id', authenticateUser, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('createdBy', 'firstName lastName username');
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    res.json(announcement);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch announcement', error: error.message });
  }
});

// Create new announcement (admin only)
app.post('/api/announcements', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { title, content } = req.body;

    // Validation
    if (!title || !content) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: {
          title: !title ? 'Title is required' : null,
          content: !content ? 'Content is required' : null
        }
      });
    }

    if (title.length > 200) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: { title: 'Title cannot exceed 200 characters' }
      });
    }

    if (content.length > 2000) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: { content: 'Content cannot exceed 2000 characters' }
      });
    }

    const announcement = new Announcement({
      title: title.trim(),
      content: content.trim(),
      createdBy: req.session.user.id
    });

    await announcement.save();
    await announcement.populate('createdBy', 'firstName lastName username');

    // Create notifications for all users
    const allUsers = await User.find({}, '_id');
    const notifications = allUsers.map(user => ({
      userId: user._id,
      type: 'announcement',
      title: 'New Company Announcement',
      message: `New announcement: ${title}`,
      announcementId: announcement._id
    }));

    await Notification.insertMany(notifications);

    res.status(201).json({
      message: 'Announcement created successfully',
      announcement
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({ 
        message: 'Validation failed',
        errors
      });
    }
    res.status(500).json({ message: 'Failed to create announcement', error: error.message });
  }
});

// Delete announcement (admin only)
app.delete('/api/announcements/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    await Announcement.findByIdAndDelete(req.params.id);
    
    // Also delete related notifications
    await Notification.deleteMany({ announcementId: req.params.id });

    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete announcement', error: error.message });
  }
});

// Notification routes

// Get user notifications
app.get('/api/notifications', authenticateUser, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.session.user.id })
      .populate('announcementId', 'title')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', authenticateUser, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.user.id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update notification', error: error.message });
  }
});

// Get unread notification count
app.get('/api/notifications/unread-count', authenticateUser, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      userId: req.session.user.id, 
      isRead: false 
    });
    
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notification count', error: error.message });
  }
});

// Dashboard route
app.get('/api/dashboard', authenticateUser, async (req, res) => {
  try {
    // Get recent announcements for dashboard widget
    const announcements = await Announcement.find({ isActive: true })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get unread notification count
    const unreadCount = await Notification.countDocuments({ 
      userId: req.session.user.id, 
      isRead: false 
    });

    res.json({
      announcements,
      notifications: { unreadCount },
      user: req.session.user
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
});

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Catch all handler for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;