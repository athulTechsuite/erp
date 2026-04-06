const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('company.db');

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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
  )`);

  // Create default admin user if not exists
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (username, email, password, role) 
          VALUES ('admin', 'admin@company.com', ?, 'admin')`, [adminPassword]);
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Auth routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, password, role = 'employee' } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
    [username, email, hashedPassword, role],
    function(err) {
      if (err) {
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
});

// Announcements routes

// Get all published announcements (accessible to all authenticated users)
app.get('/api/announcements', authenticateToken, (req, res) => {
  const query = `
    SELECT a.*, u.username as author_name 
    FROM announcements a 
    LEFT JOIN users u ON a.author_id = u.id 
    WHERE a.published = 1 
    ORDER BY a.created_at DESC
  `;

  db.all(query, [], (err, announcements) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch announcements' });
    }
    res.json(announcements);
  });
});

// Get all announcements (admin only - includes unpublished)
app.get('/api/admin/announcements', authenticateToken, requireAdmin, (req, res) => {
  const query = `
    SELECT a.*, u.username as author_name 
    FROM announcements a 
    LEFT JOIN users u ON a.author_id = u.id 
    ORDER BY a.created_at DESC
  `;

  db.all(query, [], (err, announcements) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch announcements' });
    }
    res.json(announcements);
  });
});

// Create new announcement (admin only)
app.post('/api/admin/announcements', authenticateToken, requireAdmin, (req, res) => {
  const { title, content, published = true } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  db.run(
    'INSERT INTO announcements (title, content, author_id, published) VALUES (?, ?, ?, ?)',
    [title, content, req.user.id, published ? 1 : 0],
    function(err) {
      if (err) {
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
          return res.status(500).json({ error: 'Failed to fetch created announcement' });
        }
        res.status(201).json(announcement);
      });
    }
  );
});

// Update announcement (admin only)
app.put('/api/admin/announcements/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, content, published } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  db.run(
    'UPDATE announcements SET title = ?, content = ?, published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, content, published ? 1 : 0, id],
    function(err) {
      if (err) {
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
          return res.status(500).json({ error: 'Failed to fetch updated announcement' });
        }
        res.json(announcement);
      });
    }
  );
});

// Delete announcement (admin only)
app.delete('/api/admin/announcements/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM announcements WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete announcement' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ message: 'Announcement deleted successfully' });
  });
});

// Get current user info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;