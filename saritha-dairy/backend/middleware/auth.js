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

// ✅ New middleware: Allow if admin OR if it's the delivery boy's own data
const isAdminOrSelf = (req, res, next) => {
  // Admin can access anything
  if (req.user?.role === 'admin') {
    return next();
  }
  
  // Delivery boy can access their own data
  if (req.user?.role === 'delivery') {
    const requestedId = parseInt(req.params.id);
    const userId = req.user.id;
    
    console.log(`🔍 Self-check: requested=${requestedId}, user=${userId}`);
    
    if (requestedId === userId) {
      return next();
    }
    
    return res.status(403).json({ success: false, error: 'You can only access your own data' });
  }
  
  return res.status(403).json({ success: false, error: 'Access denied' });
};

module.exports = { verifyToken, isAdmin, isAdminOrSelf, JWT_SECRET, ADMIN_EMAILS };