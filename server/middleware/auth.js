const jwt = require('jsonwebtoken');
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'announcement-sms-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

// middleware with database lookup to enrich user info (dept/year)
async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // load additional fields from database
    const user = await db.get(
      `SELECT u.user_id, u.role, up.department, up.year_level 
       FROM users u 
       LEFT JOIN user_profiles up ON u.user_id = up.user_id 
       WHERE u.user_id = ?`,
      [payload.user_id]
    );
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (e) {
    console.error('auth error', e);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { auth, requireRole, JWT_SECRET, JWT_EXPIRES_IN };
