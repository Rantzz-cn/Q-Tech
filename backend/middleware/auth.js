const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */
const authenticateToken = (req, res, next) => {
  // Get token from header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Access denied. No token provided.',
        code: 'AUTH_REQUIRED',
      },
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token expired',
          code: 'AUTH_INVALID',
        },
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid token',
        code: 'AUTH_INVALID',
      },
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Access denied. Authentication required.',
          code: 'AUTH_REQUIRED',
        },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied. Insufficient permissions.',
          code: 'FORBIDDEN',
        },
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorize,
};

