// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Protect routes – verifies Bearer JWT in Authorization header.
 * Attaches decoded payload to req.user.
 */
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
}

/**
 * Role guard – use after authMiddleware.
 * Usage: requireRole('admin','superadmin')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    next();
  };
}

/**
 * Optional client auth — attaches req.client if a valid client JWT is present.
 * Does NOT block the request if no token is provided.
 */
function clientAuthOptional(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return next();
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'client') req.client = decoded;
  } catch {}
  next();
}

module.exports = { authMiddleware, requireRole, clientAuthOptional };
