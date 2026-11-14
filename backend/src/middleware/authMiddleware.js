const jwt = require('jsonwebtoken');
const db = require('../config/database');

const selectUserStmt = db.prepare(`
  SELECT id, name, email, created_at
  FROM users
  WHERE id = ?
`);

/**
 * Authentication middleware that verifies JWT access token.
 * Extracts the user from the database and attaches it to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No authentication token provided.',
    });
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token format. Expected "Bearer <token>".',
    });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET || 'ledgerflow_jwt_secret_key_secure_2026_xyz!';

  try {
    const decoded = jwt.verify(token, secret);
    
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token payload.',
      });
    }

    const user = selectUserStmt.get(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed. User account not found.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Authentication token has expired. Please log in again.',
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.',
    });
  }
}

module.exports = {
  authenticateToken,
};

