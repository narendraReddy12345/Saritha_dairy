// controllers/authController.js
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET, ADMIN_EMAILS } = require('../middleware/auth');

exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;
  
  console.log('🔐 Admin login attempt:', email);
  
  try {
    if (!ADMIN_EMAILS.includes(email?.toLowerCase().trim())) {
      console.log('❌ Email not authorized');
      return res.status(401).json({ success: false, error: 'Not authorized as admin' });
    }
    
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (password !== adminPassword) {
      console.log('❌ Wrong password');
      return res.status(401).json({ success: false, error: 'Invalid admin password' });
    }
    
    const token = jwt.sign(
      { id: 0, email, role: 'admin', name: 'Admin' }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    console.log('✅ Admin logged in');
    
    res.json({ 
      success: true, 
      token, 
      user: { id: 0, email, name: 'Admin', role: 'admin' } 
    });
  } catch (error) { 
    console.error('❌ Admin login error:', error);
    res.status(500).json({ success: false, error: error.message }); 
  }
};

exports.adminLoginPhone = async (req, res) => {
  const { phone, password } = req.body;
  
  console.log('👑 Admin phone login attempt:', phone);
  
  const ADMIN_PHONE = '9347745435';
  
  try {
    if (phone !== ADMIN_PHONE) {
      console.log('❌ Phone not authorized');
      return res.status(401).json({ success: false, error: 'Not authorized as admin' });
    }
    
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (password !== adminPassword) {
      console.log('❌ Wrong password');
      return res.status(401).json({ success: false, error: 'Invalid admin password' });
    }
    
    const token = jwt.sign(
      { id: 0, phone, role: 'admin', name: 'Admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ Admin logged in via phone');
    
    res.json({
      success: true,
      token,
      user: { id: 0, phone: ADMIN_PHONE, name: 'Admin', role: 'admin' }
    });
  } catch (error) {
    console.error('❌ Admin phone login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deliveryBoyLogin = async (req, res) => {
  const { phone, password } = req.body;
  
  console.log('🔐 Delivery boy login attempt - Phone:', phone);
  
  try {
    const result = await pool.query(
      'SELECT * FROM delivery_boys WHERE phone = $1 AND password = $2',
      [phone, password]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No matching delivery boy found');
      return res.status(401).json({ success: false, error: 'Invalid phone number or password' });
    }
    
    const boy = result.rows[0];
    console.log('✅ Delivery boy found:', { id: boy.id, name: boy.name, status: boy.status });
    
    if (boy.status === 'inactive') {
      console.log('❌ Account is deactivated');
      return res.status(401).json({ success: false, error: 'Your account is deactivated. Contact admin.' });
    }
    
    const token = jwt.sign(
      { id: boy.id, phone, role: 'delivery', name: boy.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    const userData = {
      id: boy.id,
      name: boy.name,
      phone: boy.phone,
      email: boy.email || '',
      vehicle: boy.vehicle || '',
      vehicleNo: boy.vehicle_no || '',
      area: boy.area || '',
      address: boy.address || '',
      salary: boy.salary || '',
      shift: boy.shift || 'morning',
      status: boy.status,
      joinedDate: boy.joined_date,
      role: 'delivery'
    };
    
    console.log('📦 Returning user data:', userData);
    
    res.json({ success: true, token, user: userData });
  } catch (error) { 
    console.error('❌ Delivery login error:', error);
    res.status(500).json({ success: false, error: error.message }); 
  }
};

// ✅ CUSTOMER LOGIN
exports.customerLogin = async (req, res) => {
  const { phone, password } = req.body;
  
  console.log('👤 Customer login attempt - Phone:', phone);
  
  try {
    const result = await pool.query(
      'SELECT * FROM customers WHERE phone = $1',
      [phone]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No customer found with phone:', phone);
      return res.status(401).json({ 
        success: false, 
        error: 'No account found with this phone number' 
      });
    }
    
    const customer = result.rows[0];
    console.log('✅ Customer found:', customer.name, 'ID:', customer.id);
    
    if (!customer.password) {
      console.log('❌ Customer has no password set');
      return res.status(401).json({ 
        success: false, 
        error: 'Password not set. Please contact admin.' 
      });
    }
    
    const validPassword = await bcrypt.compare(password, customer.password);
    
    if (!validPassword) {
      console.log('❌ Invalid password');
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid password. Please try again.' 
      });
    }
    
    const token = jwt.sign(
      { id: customer.id, phone, role: 'customer', name: customer.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ Customer logged in successfully');
    
    res.json({
      success: true,
      token,
      user: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        apartment: customer.apartment || '',
        area: customer.area || '',
        flat_no: customer.flat_no || '',
        city: customer.city || '',
        role: 'customer'
      }
    });
  } catch (error) {
    console.error('❌ Customer login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  const { phone, currentPassword, newPassword } = req.body;
  
  console.log('🔒 Password change request for:', phone);
  
  try {
    const result = await pool.query('SELECT * FROM customers WHERE phone = $1', [phone]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    const customer = result.rows[0];
    
    const validPassword = await bcrypt.compare(currentPassword, customer.password);
    
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE customers SET password = $1 WHERE id = $2', [hashedPassword, customer.id]);
    
    console.log('✅ Password changed for customer:', customer.name);
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.verifyToken = (req, res) => { 
  console.log('✅ Token verified for:', req.user?.name);
  res.json({ success: true, user: req.user }); 
};