const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token is required' 
      });
    }

    // Validate JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ 
        success: false, 
        message: 'Authentication configuration error' 
      });
    }

    // Verify token with additional options for security
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'], // Explicitly specify allowed algorithms
      clockTolerance: 30, // Allow 30 seconds clock skew
      ignoreExpiration: false // Ensure expiration is checked
    });

    // Validate token payload structure
    if (!decoded.userId || typeof decoded.userId !== 'string') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token payload' 
      });
    }

    // Check token expiration explicitly (additional safety check)
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token has expired' 
      });
    }
    
    // Fetch user from database to ensure they still exist and are active
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token - user not found' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated' 
      });
    }

    // Optional: Check if token was issued before user's last password change
    if (user.passwordChangedAt && decoded.iat && 
        new Date(user.passwordChangedAt).getTime() > decoded.iat * 1000) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token is no longer valid - please login again' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    // Handle specific JWT errors with proper messages
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token format or signature',
        code: 'INVALID_TOKEN'
      });
    } else if (error.name === 'NotBeforeError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token is not active yet',
        code: 'TOKEN_NOT_ACTIVE'
      });
    } else if (error.name === 'CastError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid user identifier in token',
        code: 'INVALID_USER_ID'
      });
    } else {
      console.error('Authentication error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return res.status(500).json({ 
        success: false, 
        message: 'Authentication failed',
        code: 'AUTH_ERROR'
      });
    }
  }
};

// Middleware to check if user has required role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
    }

    next();
  };
};

// Middleware to check if user is admin
const requireAdmin = requireRole('admin');

// Middleware to check if user is admin or manager
const requireManager = requireRole('admin', 'manager');

// Middleware to check if user can access their own data or is admin/manager
const requireOwnershipOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  const resourceUserId = req.params.userId || req.params.id || req.body.userId;
  const isOwner = req.user._id.toString() === resourceUserId;
  const isAdminOrManager = ['admin', 'manager'].includes(req.user.role);

  if (!isOwner && !isAdminOrManager) {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied - can only access your own data' 
    });
  }

  next();
};

// Middleware to optionally authenticate (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token && process.env.JWT_SECRET) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        clockTolerance: 30,
        ignoreExpiration: false
      });
      
      if (decoded.userId && typeof decoded.userId === 'string') {
        const user = await User.findById(decoded.userId).select('-password');
        
        if (user && user.isActive) {
          // Check password change timestamp for optional auth too
          if (!user.passwordChangedAt || !decoded.iat || 
              new Date(user.passwordChangedAt).getTime() <= decoded.iat * 1000) {
            req.user = user;
          }
        }
      }
    }
    
    next();
  } catch (error) {
    // Silently continue without authentication for optional auth
    // But log potential security issues
    if (error.name !== 'TokenExpiredError') {
      console.warn('Optional auth warning:', error.message);
    }
    next();
  }
};

// Middleware to check if user can manage leave requests
const canManageLeave = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  const isAdminOrManager = ['admin', 'manager'].includes(req.user.role);
  const leaveRequestUserId = req.params.userId || req.body.userId;
  const isOwnRequest = req.user._id.toString() === leaveRequestUserId;

  // Admins and managers can manage all leave requests
  // Employees can only manage their own requests
  if (req.method === 'POST' && isOwnRequest) {
    // Allow employees to create their own leave requests
    next();
  } else if (['PUT', 'PATCH'].includes(req.method) && isAdminOrManager) {
    // Only admins/managers can approve/reject leave requests
    next();
  } else if (['GET', 'DELETE'].includes(req.method) && (isOwnRequest || isAdminOrManager)) {
    // Allow viewing/deleting own requests or admin/manager access
    next();
  } else {
    return res.status(403).json({ 
      success: false, 
      message: 'Insufficient permissions for leave management' 
    });
  }
};

// Middleware to check if user can manage announcements
const canManageAnnouncements = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // Only admins can create, edit, or delete announcements
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Only administrators can manage announcements' 
    });
  }

  next();
};

// Rate limiting middleware for sensitive operations
const createRateLimit = (windowMs = 15 * 60 * 1000, max = 5) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip + (req.user ? req.user._id : '');
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old requests
    const userRequests = requests.get(key) || [];
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);

    if (validRequests.length >= max) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }

    validRequests.push(now);
    requests.set(key, validRequests);
    next();
  };
};

// Middleware to log user activities
const logActivity = (action) => {
  return (req, res, next) => {
    req.userActivity = {
      action,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireManager,
  requireOwnershipOrAdmin,
  optionalAuth,
  canManageLeave,
  canManageAnnouncements,
  createRateLimit,
  logActivity
};