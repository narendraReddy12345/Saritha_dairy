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
    // First, check if customers table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'customers'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json({ success: true, customers: [] });
    }
    
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.phone,
        c.is_active,
        c.created_at,
        c.updated_at,
        cda.delivery_boy_id as assigned_boy_id,
        db.name as assigned_boy_name
      FROM customers c
      LEFT JOIN customer_delivery_assignments cda ON c.id = cda.customer_id
      LEFT JOIN delivery_boys db ON cda.delivery_boy_id = db.id
      ORDER BY c.created_at DESC
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
      is_active: customer.is_active !== false,
      assigned_boy_id: customer.assigned_boy_id,
      assigned_boy_name: customer.assigned_boy_name,
      created_at: customer.created_at,
      updated_at: customer.updated_at
    }));
    
    res.json({ success: true, customers });
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ CREATE customer - Works with basic columns only
router.post('/customers', verifyToken, isAdmin, async (req, res) => {
  console.log('📝 POST /api/admin/customers called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  const { 
    name, email, phone, password, deliveryTime, notes 
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
    
    // Insert customer with only basic columns that definitely exist
    const result = await client.query(`
      INSERT INTO customers (
        name, 
        phone, 
        email, 
        password, 
        is_active, 
        created_at, 
        updated_at
      ) VALUES ($1, $2, $3, $4, true, NOW(), NOW())
      RETURNING id
    `, [
      name, 
      phone, 
      email || null, 
      hashedPassword
    ]);
    
    const customerId = result.rows[0].id;
    console.log(`✅ Customer created with ID: ${customerId}`);
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: 'Customer created successfully',
      customerId: customerId
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// GET customer deliveries
router.get('/customers/:customerId/deliveries', verifyToken, isAdmin, async (req, res) => {
  const { customerId } = req.params;
  
  try {
    // Check if daily_delivery table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'daily_delivery'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json({ success: true, deliveries: [] });
    }
    
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

// GET single customer
router.get('/customers/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT id, name, email, phone, is_active, created_at, updated_at 
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
  const { name, email, phone, is_active } = req.body;
  
  try {
    await pool.query(`
      UPDATE customers 
      SET name = $1, 
          email = $2, 
          phone = $3, 
          is_active = $4, 
          updated_at = NOW()
      WHERE id = $5
    `, [name, email, phone, is_active !== false, id]);
    
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
    await pool.query('BEGIN');
    
    // Check if customer_delivery_assignments table exists and delete from it
    const assignmentsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'customer_delivery_assignments'
      );
    `);
    
    if (assignmentsCheck.rows[0].exists) {
      await pool.query('DELETE FROM customer_delivery_assignments WHERE customer_id = $1', [id]);
    }
    
    // Check if customer_products table exists and delete from it
    const productsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'customer_products'
      );
    `);
    
    if (productsCheck.rows[0].exists) {
      await pool.query('DELETE FROM customer_products WHERE customer_id = $1', [id]);
    }
    
    // Delete the customer
    await pool.query('DELETE FROM customers WHERE id = $1', [id]);
    await pool.query('COMMIT');
    
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error deleting customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record daily delivery
router.post('/daily-delivery', verifyToken, isAdmin, async (req, res) => {
  console.log('📦 POST /api/admin/daily-delivery called');
  const { customer_id, delivery_boy_id, delivery_date, products, status } = req.body;
  
  try {
    // Check if daily_delivery table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'daily_delivery'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      // Create the table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS daily_delivery (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER REFERENCES customers(id),
          delivery_boy_id INTEGER,
          delivery_date DATE,
          product_name VARCHAR(100),
          pack_size VARCHAR(20),
          quantity INTEGER DEFAULT 1,
          price DECIMAL(10,2),
          total_amount DECIMAL(10,2),
          status VARCHAR(20) DEFAULT 'pending',
          delivered BOOLEAN DEFAULT false,
          created_at TIMESTAMP,
          updated_at TIMESTAMP
        )
      `);
      console.log('✅ Created daily_delivery table');
    }
    
    const deliveryDate = delivery_date || new Date().toISOString().split('T')[0];
    
    // Delete existing deliveries for this customer on this date
    await pool.query('DELETE FROM daily_delivery WHERE customer_id = $1 AND delivery_date = $2', [customer_id, deliveryDate]);
    
    // Insert each product as a separate delivery record
    for (const product of products) {
      const totalAmount = (product.price || 0) * (product.quantity || 1);
      await pool.query(`
        INSERT INTO daily_delivery 
        (customer_id, delivery_boy_id, delivery_date, product_name, pack_size, quantity, price, total_amount, status, delivered, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
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
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'daily_delivery'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json({ success: true, deliveries: [] });
    }
    
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

// Alternative endpoint for customer deliveries (backward compatibility)
router.get('/customer-deliveries/:customerId', verifyToken, isAdmin, async (req, res) => {
  const { customerId } = req.params;
  
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'daily_delivery'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json({ success: true, deliveries: [] });
    }
    
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