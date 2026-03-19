/**
 * Role-based access control middleware
 * Validates user roles and permissions for ERP system endpoints
 */

const roleCheck = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check if user has required role
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to access this resource'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking user permissions',
        error: error.message
      });
    }
  };
};

/**
 * Predefined role check functions for common access patterns
 */
const roles = {
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
  MANAGER: 'manager'
};

const adminOnly = () => roleCheck([roles.ADMIN]);
const adminOrManager = () => roleCheck([roles.ADMIN, roles.MANAGER]);
const allRoles = () => roleCheck([roles.ADMIN, roles.MANAGER, roles.EMPLOYEE]);

/**
 * Resource-specific permission checker
 * Allows employees to access their own resources
 */
const checkResourceOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    try {
      const userRole = req.user.role;
      const userId = req.user.id;

      // Admins and managers can access all resources
      if (userRole === roles.ADMIN || userRole === roles.MANAGER) {
        return next();
      }

      // Employees can only access their own resources
      if (userRole === roles.EMPLOYEE) {
        const resourceUserId = req.params[resourceUserIdField] || 
                              req.body[resourceUserIdField] || 
                              req.query[resourceUserIdField];

        if (!resourceUserId) {
          return res.status(400).json({
            success: false,
            message: 'Resource user ID is required'
          });
        }

        if (resourceUserId.toString() !== userId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You can only access your own resources'
          });
        }
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking resource ownership',
        error: error.message
      });
    }
  };
};

/**
 * Leave-specific permission checker
 * Handles special cases for leave management
 */
const checkLeavePermissions = (action) => {
  return (req, res, next) => {
    try {
      const userRole = req.user.role;
      const userId = req.user.id;

      switch (action) {
        case 'create':
          // All authenticated users can create leave requests
          return next();

        case 'approve':
        case 'reject':
          // Only admins and managers can approve/reject leaves
          if (userRole === roles.ADMIN || userRole === roles.MANAGER) {
            return next();
          }
          return res.status(403).json({
            success: false,
            message: 'Only admins and managers can approve/reject leave requests'
          });

        case 'view':
          // Admins and managers can view all, employees can view their own
          if (userRole === roles.ADMIN || userRole === roles.MANAGER) {
            return next();
          }
          // For employees, check ownership
          return checkResourceOwnership('employeeId')(req, res, next);

        case 'edit':
          // Only pending leaves can be edited by the creator
          if (userRole === roles.ADMIN || userRole === roles.MANAGER) {
            return next();
          }
          // Additional logic needed to check if leave is pending and belongs to user
          return checkResourceOwnership('employeeId')(req, res, next);

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid permission action'
          });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking leave permissions',
        error: error.message
      });
    }
  };
};

module.exports = {
  roleCheck,
  roles,
  adminOnly,
  adminOrManager,
  allRoles,
  checkResourceOwnership,
  checkLeavePermissions
};