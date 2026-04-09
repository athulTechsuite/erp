const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database initialization
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'employee',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Announcements table
    db.run(`CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_published BOOLEAN DEFAULT 0,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
    )`);

    // Create default admin user
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, password, email, role) 
            VALUES ('admin', ?, 'admin@company.com', 'admin')`, [hashedPassword]);

    // Create sample employees
    const employeePassword = bcrypt.hashSync('password123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, password, email, role) 
            VALUES ('employee1', ?, 'employee1@company.com', 'employee')`, [employeePassword]);
    db.run(`INSERT OR IGNORE INTO users (username, password, email, role) 
            VALUES ('manager1', ?, 'manager1@company.com', 'manager')`, [employeePassword]);

    // Create sample announcements
    db.run(`INSERT OR IGNORE INTO announcements (title, content, is_published, created_by) 
            VALUES ('Welcome to Q4 2024', 'We are excited to announce our new initiatives for the fourth quarter. Please review the updated policies and procedures.', 1, 1)`);
    db.run(`INSERT OR IGNORE INTO announcements (title, content, is_published, created_by) 
            VALUES ('Holiday Schedule Update', 'The holiday schedule has been updated. Please check the HR portal for complete details on time off policies.', 1, 1)`);
    db.run(`INSERT OR IGNORE INTO announcements (title, content, is_published, created_by) 
            VALUES ('System Maintenance Notice', 'Scheduled system maintenance will occur this weekend. Some services may be temporarily unavailable.', 1, 1)`);
}

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
            { id: user.id, username: user.username, role: user.role },
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

// Announcements routes
app.get('/api/announcements', authenticateToken, (req, res) => {
    db.all(`SELECT a.*, u.username as created_by_name 
            FROM announcements a 
            JOIN users u ON a.created_by = u.id 
            WHERE a.is_published = 1 
            ORDER BY a.created_at DESC 
            LIMIT 5`, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch announcements' });
        }
        res.json(rows);
    });
});

app.get('/api/admin/announcements', authenticateToken, requireAdmin, (req, res) => {
    db.all(`SELECT a.*, u.username as created_by_name 
            FROM announcements a 
            JOIN users u ON a.created_by = u.id 
            ORDER BY a.created_at DESC`, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch announcements' });
        }
        res.json(rows);
    });
});

app.post('/api/admin/announcements', authenticateToken, requireAdmin, (req, res) => {
    const { title, content, is_published = false } = req.body;

    // Validation
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
    }
    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Content is required' });
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    db.run(`INSERT INTO announcements (title, content, is_published, created_by) 
            VALUES (?, ?, ?, ?)`, 
            [trimmedTitle, trimmedContent, is_published ? 1 : 0, req.user.id], 
            function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to create announcement' });
        }

        db.get(`SELECT a.*, u.username as created_by_name 
                FROM announcements a 
                JOIN users u ON a.created_by = u.id 
                WHERE a.id = ?`, [this.lastID], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to retrieve created announcement' });
            }
            res.status(201).json(row);
        });
    });
});

app.put('/api/admin/announcements/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { title, content, is_published } = req.body;

    // Validation
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
    }
    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Content is required' });
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    db.run(`UPDATE announcements 
            SET title = ?, content = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`, 
            [trimmedTitle, trimmedContent, is_published ? 1 : 0, id], 
            function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to update announcement' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        db.get(`SELECT a.*, u.username as created_by_name 
                FROM announcements a 
                JOIN users u ON a.created_by = u.id 
                WHERE a.id = ?`, [id], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to retrieve updated announcement' });
            }
            res.json(row);
        });
    });
});

app.delete('/api/admin/announcements/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM announcements WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to delete announcement' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        res.json({ message: 'Announcement deleted successfully' });
    });
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;