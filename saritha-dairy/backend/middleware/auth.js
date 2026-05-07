// controllers/authController.js (Updated adminLoginPhone function)
exports.adminLoginPhone = async (req, res) => {
  const { phone, password } = req.body;
  
  console.log('👑 Admin login attempt (phone):', phone);
  
  // Import ADMIN_PHONES from middleware
  const { ADMIN_PHONES } = require('../middleware/auth');
  
  try {
    // Check if phone number is in the admin list
    if (!ADMIN_PHONES.includes(phone)) {
      console.log('❌ Phone not authorized - Not in admin list');
      console.log('📱 Authorized phones:', ADMIN_PHONES);
      return res.status(401).json({ 
        success: false, 
        error: 'Not authorized as admin. Phone number not recognized.' 
      });
    }
    
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (password !== adminPassword) {
      console.log('❌ Wrong password for admin phone:', phone);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid admin password' 
      });
    }
    
    // Optional: Try to find admin in database to get name
    let adminName = 'Admin';
    let adminEmail = '';
    
    try {
      const result = await pool.query(
        'SELECT name, email FROM users WHERE phone = $1 AND role = $2',
        [phone, 'admin']
      );
      
      if (result.rows.length > 0) {
        adminName = result.rows[0].name;
        adminEmail = result.rows[0].email || '';
        console.log('📝 Found admin in DB:', adminName);
      }
    } catch (dbError) {
      console.log('⚠️ Could not fetch admin from DB, using defaults');
    }
    
    const token = jwt.sign(
      { 
        id: 0, 
        phone, 
        role: 'admin', 
        name: adminName, 
        email: adminEmail 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ Admin logged in via phone:', phone);
    
    res.json({
      success: true,
      token,
      user: { 
        id: 0, 
        phone, 
        name: adminName, 
        email: adminEmail,
        role: 'admin' 
      }
    });
  } catch (error) {
    console.error('❌ Admin phone login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};