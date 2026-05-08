// middleware/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'saritha_dairy_secret_key_2024';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'narendrareddybadam553@gmail.com').split(',').map(e => e.trim().toLowerCase());

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  console.log('🔑 Verifying token:', token ? 'Present' : 'Missing');
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token verified:', req.user.role, req.user.name, 'ID:', req.user.id);
    next();
  } catch (error) {
    console.log('❌ Token invalid:', error.message);
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  console.log('👑 Checking admin role:', req.user?.role);
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

// ✅ Updated: Allow admin, delivery boy, or customer to access their own data
const isAdminOrSelf = (req, res, next) => {
  // Admin can access anything
  if (req.user?.role === 'admin') {
    return next();
  }
  
  // Get the requested ID from params (supports both :customerId and :id)
  const requestedId = parseInt(req.params.customerId || req.params.id || req.params.delivery_boy_id);
  const userId = req.user.id;
  
  console.log(`🔍 Self-check: role=${req.user?.role}, requested=${requestedId}, user=${userId}`);
  
  // Allow if requesting own data
  if (requestedId === userId) {
    return next();
  }
  
  return res.status(403).json({ success: false, error: 'Access denied. You can only access your own data.' });
};

module.exports = { verifyToken, isAdmin, isAdminOrSelf, JWT_SECRET, ADMIN_EMAILS };