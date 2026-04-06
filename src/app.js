const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/company_announcements', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
  name: { type: String, required: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Announcement Schema
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Announcement = mongoose.model('Announcement', announcementSchema);

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      name,
      role: role || 'employee'
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Announcement Routes

// Get all active announcements (accessible by all authenticated users)
app.get('/api/announcements', authenticateToken, async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all announcements including inactive ones (admin only)
app.get('/api/announcements/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new announcement (admin only)
app.post('/api/announcements', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, content } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const announcement = new Announcement({
      title,
      content,
      createdBy: req.user._id
    });

    await announcement.save();
    await announcement.populate('createdBy', 'name');
    
    res.status(201).json(announcement);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update announcement (admin only)
app.put('/api/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, content, isActive } = req.body;
    
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    if (title !== undefined) announcement.title = title;
    if (content !== undefined) announcement.content = content;
    if (isActive !== undefined) announcement.isActive = isActive;

    await announcement.save();
    await announcement.populate('createdBy', 'name');
    
    res.json(announcement);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete announcement (admin only)
app.delete('/api/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Dashboard data endpoint
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      },
      announcements
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;