const bcrypt = require('bcryptjs');
const pool = require('./config/db');

const setCustomerPassword = async () => {
  const phone = '9347745431'; // Customer phone
  const newPassword = 'customer123'; // Set this password
  
  try {
    // Check if customer exists
    const result = await pool.query('SELECT * FROM customers WHERE phone = $1', [phone]);
    
    if (result.rows.length === 0) {
      console.log('❌ No customer found with phone:', phone);
      return;
    }
    
    const customer = result.rows[0];
    console.log('Found customer:', customer.name);
    
    // Hash password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await pool.query('UPDATE customers SET password = $1 WHERE phone = $2', [hashedPassword, phone]);
    
    console.log('✅ Password set successfully!');
    console.log('Phone:', phone);
    console.log('Password:', newPassword);
    console.log('Hashed:', hashedPassword);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
};

setCustomerPassword();