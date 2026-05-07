// middleware/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'saritha_dairy_secret_key_2024';

// Admin emails for email-based authentication (with defaults)
const ADMIN_EMAILS = process.env.ADMIN_EMAILS 
  ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase())
  : ['narendrareddybadam553@gmail.com'];  // ✅ Default value

// Admin phone numbers for phone-based authentication (with defaults)
const ADMIN_PHONES = process.env.ADMIN_PHONES 
  ? process.env.ADMIN_PHONES.split(',').map(p => p.trim())
  : ['9347745435', '9398263810', '9666966811'];  // ✅ Default value

console.log('👑 Admin Emails configured:', ADMIN_EMAILS);
console.log('📱 Admin Phone Numbers configured:', ADMIN_PHONES);

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

// Check if a phone number belongs to an admin
const isAdminPhone = (phone) => {
  return ADMIN_PHONES.includes(phone);
};

// Check if an email belongs to an admin
const isAdminEmail = (email) => {
  return ADMIN_EMAILS.includes(email?.toLowerCase());
};

// Check if user is admin by email or phone
const isAdminByEmailOrPhone = (email, phone) => {
  if (email && isAdminEmail(email)) return true;
  if (phone && isAdminPhone(phone)) return true;
  return false;
};

// Allow if admin OR if it's the delivery boy's own data
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

// Optional: Middleware to check if user is admin by token or phone
const isAdminOrHasAdminPhone = (req, res, next) => {
  // If user is already admin from token
  if (req.user?.role === 'admin') {
    return next();
  }
  
  // Check if the request has a phone number that is admin
  const phone = req.body.phone || req.query.phone || req.params.phone;
  
  if (phone && isAdminPhone(phone)) {
    console.log('👑 User has admin phone number:', phone);
    req.user = { ...req.user, role: 'admin', isAdminByPhone: true };
    return next();
  }
  
  return res.status(403).json({ success: false, error: 'Admin access required' });
};

module.exports = { 
  verifyToken, 
  isAdmin, 
  isAdminOrSelf, 
  JWT_SECRET, 
  ADMIN_EMAILS,
  ADMIN_PHONES,
  isAdminPhone,
  isAdminEmail,
  isAdminByEmailOrPhone,
  isAdminOrHasAdminPhone
};