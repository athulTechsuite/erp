const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || false 
    : true,
  credentials: true
}));

// Body parsing middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Input validation middleware
const validateInput = (req, res, next) => {
  const { body } = req;
  
  // Check for potentially malicious input
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      return dangerousPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };
  
  const hasDangerousInput = Object.values(body).some(checkValue);
  
  if (hasDangerousInput) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }
  
  next();
};

// Database setup with error handling
const db = new sqlite3.Database('company.db', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Database connection error handler
db.on('error', (err) => {
  console.error('Database error:', err);
});

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    }
  });

  // Announcements table
  db.run(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id INTEGER,
    published BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating announcements table:', err);
    }
  });

  // Create default admin user if not exists
  const adminPassword = bcrypt.hashSync('admin123', 12);
  db.run(`INSERT OR IGNORE INTO users (username, email, password, role) 
          VALUES ('admin', 'admin@company.com', ?, 'admin')`, [adminPassword], (err) => {
    if (err) {
      console.error('Error creating admin user:', err);
    }
  });
});

// Authentication middleware with enhanced security
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(403).json({ error: 'Invalid token' });
      }
      
      // Check if user still exists and is not locked
      db.get('SELECT id, username, email, role, locked_until FROM users WHERE id = ?', [user.id], (dbErr, dbUser) => {
        if (dbErr) {
          return res.status(500).json({ error: 'Authentication error' });
        }
        
        if (!dbUser) {
          return res.status(401).json({ error: 'User not found' });
        }
        
        if (dbUser.locked_until && new Date(dbUser.locked_until) > new Date()) {
          return res.status(423).json({ error: 'Account temporarily locked' });
        }
        
        req.user = user;
        next();
      });
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Account lockout helper
const handleFailedLogin = (userId) => {
  db.run(`UPDATE users SET 
    failed_login_attempts = failed_login_attempts + 1,
    locked_until = CASE 
      WHEN failed_login_attempts >= 4 THEN datetime('now', '+30 minutes')
      ELSE locked_until 
    END
    WHERE id = ?`, [userId]);
};

const handleSuccessfulLogin = (userId) => {
  db.run(`UPDATE users SET 
    failed_login_attempts = 0,
    locked_until = NULL,
    last_login = CURRENT_TIMESTAMP
    WHERE id = ?`, [userId]);
};

// Auth routes with enhanced security
app.post('/api/auth/login', authLimiter, validateInput, (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Input validation
    if (username.length > 50 || password.length > 100) {
      return res.status(400).json({ error: 'Invalid input length' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
      if (err) {
        console.error('Login database error:', err);
        return res.status(500).json({ error: 'Authentication failed' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return res.status(423).json({ error: 'Account temporarily locked due to multiple failed login attempts' });
      }

      if (!bcrypt.compareSync(password, user.password)) {
        handleFailedLogin(user.id);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      handleSuccessfulLogin(user.id);

      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          email: user.email,
          role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/auth/register', authLimiter, validateInput, (req, res) => {
  try {
    const { username, email, password, role = 'employee' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Input validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    }

    // Validate role
    const validRoles = ['employee', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const hashedPassword = bcrypt.hashSync(password, 12);

    db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role],
      function(err) {
        if (err) {
          console.error('Registration error:', err);
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Failed to create user' });
        }

        const token = jwt.sign(
          { 
            id: this.lastID, 
            username, 
            email,
            role 
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.status(201).json({
          token,
          user: {
            id: this.lastID,
            username,
            email,
            role
          }
        });
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Announcements routes with enhanced error handling

// Get all published announcements (accessible to all authenticated users)
app.get('/api/announcements', authenticateToken, (req, res) => {
  try {
    const query = `
      SELECT a.*, u.username as author_name 
      FROM announcements a 
      LEFT JOIN users u ON a.author_id = u.id 
      WHERE a.published = 1 
      ORDER BY a.created_at DESC
    `;

    db.all(query, [], (err, announcements) => {
      if (err) {
        console.error('Error fetching announcements:', err);
        return res.status(500).json({ error: 'Failed to fetch announcements' });
      }
      res.json(announcements || []);
    });
  } catch (error) {
    console.error('Announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Get all announcements (admin only - includes unpublished)
app.get('/api/admin/announcements', authenticateToken, requireAdmin, (req, res) => {
  try {
    const query = `
      SELECT a.*, u.username as author_name 
      FROM announcements a 
      LEFT JOIN users u ON a.author_id = u.id 
      ORDER BY a.created_at DESC
    `;

    db.all(query, [], (err, announcements) => {
      if (err) {
        console.error('Error fetching admin announcements:', err);
        return res.status(500).json({ error: 'Failed to fetch announcements' });
      }
      res.json(announcements || []);
    });
  } catch (error) {
    console.error('Admin announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Create new announcement (admin only)
app.post('/api/admin/announcements', authenticateToken, requireAdmin, validateInput, (req, res) => {
  try {
    const { title, content, published = true } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (title.length > 200 || content.length > 10000) {
      return res.status(400).json({ error: 'Content exceeds maximum length' });
    }

    db.run(
      'INSERT INTO announcements (title, content, author_id, published) VALUES (?, ?, ?, ?)',
      [title.trim(), content.trim(), req.user.id, published ? 1 : 0],
      function(err) {
        if (err) {
          console.error('Error creating announcement:', err);
          return res.status(500).json({ error: 'Failed to create announcement' });
        }

        // Fetch the created announcement with author info
        const query = `
          SELECT a.*, u.username as author_name 
          FROM announcements a 
          LEFT JOIN users u ON a.author_id = u.id 
          WHERE a.id = ?
        `;

        db.get(query, [this.lastID], (err, announcement) => {
          if (err) {
            console.error('Error fetching created announcement:', err);
            return res.status(500).json({ error: 'Failed to fetch created announcement' });
          }
          res.status(201).json(announcement);
        });
      }
    );
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// Update announcement (admin only)
app.put('/api/admin/announcements/:id', authenticateToken, requireAdmin, validateInput, (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, published } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    if (title.length > 200 || content.length > 10000) {
      return res.status(400).json({ error: 'Content exceeds maximum length' });
    }

    db.run(
      'UPDATE announcements SET title = ?, content = ?, published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title.trim(), content.trim(), published ? 1 : 0, id],
      function(err) {
        if (err) {
          console.error('Error updating announcement:', err);
          return res.status(500).json({ error: 'Failed to update announcement' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Announcement not found' });
        }

        // Fetch the updated announcement with author info
        const query = `
          SELECT a.*, u.username as author_name 
          FROM announcements a 
          LEFT JOIN users u ON a.author_id = u.id 
          WHERE a.id = ?
        `;

        db.get(query, [id], (err, announcement) => {
          if (err) {
            console.error('Error fetching updated announcement:', err);
            return res.status(500).json({ error: 'Failed to fetch updated announcement' });
          }
          res.json(announcement);
        });
      }
    );
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// Delete announcement (admin only)
app.delete('/api/admin/announcements/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    db.run('DELETE FROM announcements WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Error deleting announcement:', err);
        return res.status(500).json({ error: 'Failed to delete announcement' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Announcement not found' });
      }

      res.json({ message: 'Announcement deleted successfully' });
    });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// Get current user info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    db.get('SELECT id, username, email, role FROM users WHERE id = ?', [req.user.id], (err, user) => {
      if (err) {
        console.error('Error fetching user info:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    });
  } catch (error) {
    console.error('User info error:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (error) {
    console.error('Error serving static file:', error);
    res.status(500).json({ error: 'Failed to serve page' });
  }
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  
  // Don't expose stack traces in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Something went wrong!',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;