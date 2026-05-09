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
        cda.delivery_boy_id as assigned_boy_id,
        db.name as assigned_boy_name
      FROM customers c
      LEFT JOIN customer_delivery_assignments cda ON c.id = cda.customer_id
      LEFT JOIN delivery_boys db ON cda.delivery_boy_id = db.id
      ORDER BY c.id DESC
    `);
    
    const customers = result.rows.map(customer => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      registration_number: null,
      alternate_phone: null,
      area: null,
      colony: null,
      apartment: null,
      flat_no: null,
      landmark: null,
      pincode: null,
      city: null,
      state: null,
      daily_products: [],
      delivery_time: 'morning',
      notes: null,
      is_active: true,
      assigned_boy_id: customer.assigned_boy_id,
      assigned_boy_name: customer.assigned_boy_name,
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    res.json({ success: true, customers });
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ CREATE customer - No updated_at column
router.post('/customers', verifyToken, isAdmin, async (req, res) => {
  console.log('📝 POST /api/admin/customers called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  const { name, email, phone, password } = req.body;
  
  // Validate required fields
  if (!name || !phone) {
    return res.status(400).json({ success: false, error: 'Name and phone are required' });
  }
  
  try {
    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }
    
    // Insert customer - no updated_at or created_at
    const result = await pool.query(`
      INSERT INTO customers (name, phone, email, password)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [name, phone, email || null, hashedPassword]);
    
    const customerId = result.rows[0].id;
    console.log(`✅ Customer created with ID: ${customerId}`);
    
    res.json({ 
      success: true, 
      message: 'Customer created successfully',
      customerId: customerId
    });
    
  } catch (error) {
    console.error('❌ Error creating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single customer
router.get('/customers/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT id, name, email, phone 
      FROM customers 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE customer
router.put('/customers/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;
  
  try {
    await pool.query(`
      UPDATE customers 
      SET name = $1, email = $2, phone = $3
      WHERE id = $4
    `, [name, email, phone, id]);
    
    res.json({ success: true, message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE customer
router.delete('/customers/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Delete from related tables first (ignore errors if tables don't exist)
    await pool.query('DELETE FROM customer_delivery_assignments WHERE customer_id = $1', [id]).catch(() => {});
    await pool.query('DELETE FROM customer_products WHERE customer_id = $1', [id]).catch(() => {});
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
    // Create table if it doesn't exist
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
    // Create table if it doesn't exist
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
    
    // Delete existing deliveries for this customer on this date
    await pool.query('DELETE FROM daily_delivery WHERE customer_id = $1 AND delivery_date = $2', [customer_id, deliveryDate]);
    
    // Insert each product
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
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;