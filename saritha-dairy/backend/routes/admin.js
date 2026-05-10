// routes/admin.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Admin route is working!' });
});

// ==================== CUSTOMER MANAGEMENT ====================

// GET all customers
router.get('/customers', verifyToken, isAdmin, async (req, res) => {
  console.log('📋 GET /api/admin/customers called');
  
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.phone,
        c.area,
        c.colony,
        c.apartment,
        c.flat_no,
        c.landmark,
        c.pincode,
        c.city,
        c.state,
        c.delivery_time,
        c.notes,
        c.is_active,
        c.created_at,
        cda.delivery_boy_id as assigned_boy_id,
        db.name as assigned_boy_name
      FROM customers c
      LEFT JOIN customer_delivery_assignments cda ON c.id = cda.customer_id
      LEFT JOIN delivery_boys db ON cda.delivery_boy_id = db.id
      ORDER BY c.id DESC
    `);
    
    const customers = [];
    for (const customer of result.rows) {
      let products = [];
      try {
        const productsResult = await pool.query(
          'SELECT product_name, pack_size, quantity_per_day as quantity, price FROM customer_products WHERE customer_id = $1',
          [customer.id]
        );
        products = productsResult.rows;
      } catch (err) {
        console.log('Products query error:', err.message);
      }
      
      customers.push({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        registration_number: null,
        alternate_phone: null,
        area: customer.area,
        colony: customer.colony,
        apartment: customer.apartment,
        flat_no: customer.flat_no,
        landmark: customer.landmark,
        pincode: customer.pincode,
        city: customer.city,
        state: customer.state,
        daily_products: products,
        delivery_time: customer.delivery_time || 'morning',
        notes: customer.notes,
        is_active: customer.is_active !== false,
        assigned_boy_id: customer.assigned_boy_id,
        assigned_boy_name: customer.assigned_boy_name,
        created_at: customer.created_at,
        updated_at: customer.created_at
      });
    }
    
    res.json({ success: true, customers });
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ CREATE customer - Handle optional email properly
router.post('/customers', verifyToken, isAdmin, async (req, res) => {
  console.log('📝 POST /api/admin/customers called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  const { 
    name, email, phone, password, registrationNumber, alternatePhone,
    address, dailyProducts, deliveryTime, notes 
  } = req.body;
  
  // Validate required fields
  if (!name || !phone) {
    return res.status(400).json({ success: false, error: 'Name and phone are required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }
    
    // Check if customer with same phone already exists
    const existingCustomer = await client.query(
      'SELECT id FROM customers WHERE phone = $1',
      [phone]
    );
    
    if (existingCustomer.rows.length > 0 && !editingCustomer) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'Customer with this phone number already exists' 
      });
    }
    
    // Handle email: if email is empty string, set to null to avoid unique constraint
    const emailValue = email && email.trim() !== '' ? email.trim() : null;
    
    // Insert customer with ALL fields
    const result = await client.query(`
      INSERT INTO customers (
        name, phone, email, password, 
        area, colony, apartment, flat_no, landmark, pincode, city, state,
        delivery_time, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
      name, 
      phone, 
      emailValue,  // Use null if empty
      hashedPassword,
      address?.area || null,
      address?.colony || null,
      address?.apartment || null,
      address?.flatNo || null,
      address?.landmark || null,
      address?.pincode || null,
      address?.city || null,
      address?.state || null,
      deliveryTime || 'morning',
      notes || null
    ]);
    
    const customerId = result.rows[0].id;
    console.log(`✅ Customer created with ID: ${customerId}`);
    
    // Insert products if any
    if (dailyProducts && dailyProducts.length > 0) {
      for (const product of dailyProducts) {
        if (product.product_name) {
          await client.query(`
            INSERT INTO customer_products (customer_id, product_name, pack_size, quantity_per_day, price)
            VALUES ($1, $2, $3, $4, $5)
          `, [customerId, product.product_name, product.pack_size || '500ml', product.quantity || 1, product.price || 0]);
          console.log(`✅ Product added: ${product.product_name}`);
        }
      }
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: 'Customer created successfully',
      customerId: customerId
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating customer:', error);
    
    // Handle duplicate email error
    if (error.code === '23505') {
      res.status(400).json({ 
        success: false, 
        error: 'Email already exists. Please use a different email or leave it blank.' 
      });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  } finally {
    client.release();
  }
});

// UPDATE customer
router.put('/customers/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address, deliveryTime, notes, is_active } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if phone already exists for another customer
    const existingCustomer = await client.query(
      'SELECT id FROM customers WHERE phone = $1 AND id != $2',
      [phone, id]
    );
    
    if (existingCustomer.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: 'Another customer with this phone number already exists' 
      });
    }
    
    // Handle email: if email is empty string, set to null
    const emailValue = email && email.trim() !== '' ? email.trim() : null;
    
    await client.query(`
      UPDATE customers 
      SET name = $1, 
          email = $2, 
          phone = $3,
          area = $4, 
          colony = $5, 
          apartment = $6, 
          flat_no = $7,
          landmark = $8, 
          pincode = $9, 
          city = $10, 
          state = $11,
          delivery_time = $12, 
          notes = $13, 
          is_active = $14
      WHERE id = $15
    `, [
      name, 
      emailValue,
      phone,
      address?.area || null,
      address?.colony || null,
      address?.apartment || null,
      address?.flatNo || null,
      address?.landmark || null,
      address?.pincode || null,
      address?.city || null,
      address?.state || null,
      deliveryTime || 'morning',
      notes || null,
      is_active !== false,
      id
    ]);
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Customer updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating customer:', error);
    
    if (error.code === '23505') {
      res.status(400).json({ 
        success: false, 
        error: 'Email already exists. Please use a different email or leave it blank.' 
      });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  } finally {
    client.release();
  }
});

// DELETE customer
router.delete('/customers/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM customer_products WHERE customer_id = $1', [id]).catch(() => {});
    await pool.query('DELETE FROM customer_delivery_assignments WHERE customer_id = $1', [id]).catch(() => {});
    await pool.query('DELETE FROM customers WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET customer deliveries
router.get('/customers/:customerId/deliveries', verifyToken, isAdmin, async (req, res) => {
  const { customerId } = req.params;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_delivery (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER,
        delivery_boy_id INTEGER,
        delivery_date DATE,
        product_name VARCHAR(100),
        pack_size VARCHAR(20),
        quantity INTEGER DEFAULT 1,
        price DECIMAL(10,2),
        total_amount DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'pending',
        delivered BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    const result = await pool.query(`
      SELECT dd.*, db.name as delivery_boy_name 
      FROM daily_delivery dd 
      LEFT JOIN delivery_boys db ON dd.delivery_boy_id = db.id 
      WHERE dd.customer_id = $1 
      ORDER BY dd.delivery_date DESC, dd.id DESC
    `, [customerId]);
    
    res.json({ success: true, deliveries: result.rows });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record daily delivery
router.post('/daily-delivery', verifyToken, isAdmin, async (req, res) => {
  console.log('📦 POST /api/admin/daily-delivery called');
  const { customer_id, delivery_boy_id, delivery_date, products, status } = req.body;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_delivery (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER,
        delivery_boy_id INTEGER,
        delivery_date DATE,
        product_name VARCHAR(100),
        pack_size VARCHAR(20),
        quantity INTEGER DEFAULT 1,
        price DECIMAL(10,2),
        total_amount DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'pending',
        delivered BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    const deliveryDate = delivery_date || new Date().toISOString().split('T')[0];
    
    await pool.query('DELETE FROM daily_delivery WHERE customer_id = $1 AND delivery_date = $2', [customer_id, deliveryDate]);
    
    for (const product of products) {
      const totalAmount = (product.price || 0) * (product.quantity || 1);
      await pool.query(`
        INSERT INTO daily_delivery 
        (customer_id, delivery_boy_id, delivery_date, product_name, pack_size, quantity, price, total_amount, status, delivered, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [customer_id, delivery_boy_id, deliveryDate, product.product_name, product.pack_size || '', product.quantity || 1, product.price || 0, totalAmount, status || 'delivered', true]);
    }
    
    res.json({ success: true, message: `Delivery recorded for ${products.length} product(s)` });
  } catch (error) {
    console.error('Error recording delivery:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all deliveries for admin
router.get('/all-deliveries', verifyToken, isAdmin, async (req, res) => {
  console.log('📋 GET /api/admin/all-deliveries called');
  
  try {
    const result = await pool.query(`
      SELECT 
        dd.*,
        c.name as customer_name,
        c.phone as customer_phone,
        db.name as delivery_boy_name
      FROM daily_delivery dd
      JOIN customers c ON dd.customer_id = c.id
      LEFT JOIN delivery_boys db ON dd.delivery_boy_id = db.id
      ORDER BY dd.delivery_date DESC, dd.created_at DESC
    `);
    
    res.json({ success: true, deliveries: result.rows });
  } catch (error) {
    console.error('Error fetching all deliveries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Alternative endpoint for customer deliveries
router.get('/customer-deliveries/:customerId', verifyToken, isAdmin, async (req, res) => {
  const { customerId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT dd.*, db.name as delivery_boy_name 
      FROM daily_delivery dd 
      LEFT JOIN delivery_boys db ON dd.delivery_boy_id = db.id 
      WHERE dd.customer_id = $1 
      ORDER BY dd.delivery_date DESC, dd.id DESC
    `, [customerId]);
    
    res.json({ success: true, deliveries: result.rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;