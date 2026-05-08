// routes/admin.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Test endpoint - FIRST, add this to verify route is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Admin route is working!', timestamp: new Date().toISOString() });
});

// GET all customers
router.get('/customers', verifyToken, isAdmin, async (req, res) => {
  console.log('📋 GET /api/admin/customers called');
  console.log('User:', req.user);
  
  try {
    // Simple query first to test
    const result = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
    console.log(`✅ Found ${result.rows.length} customers`);
    
    const customers = result.rows.map(customer => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      registration_number: customer.registration_number,
      alternate_phone: customer.alternate_phone,
      area: customer.area,
      colony: customer.colony,
      apartment: customer.apartment,
      flat_no: customer.flat_no,
      landmark: customer.landmark,
      pincode: customer.pincode,
      city: customer.city,
      state: customer.state,
      daily_products: [],
      delivery_time: customer.delivery_time || 'morning',
      notes: customer.notes,
      is_active: customer.is_active !== false,
      assigned_boy_id: null,
      assigned_boy_name: null,
      created_at: customer.created_at,
      updated_at: customer.updated_at
    }));
    
    res.json({ success: true, customers });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get customer deliveries
router.get('/customers/:customerId/deliveries', verifyToken, isAdmin, async (req, res) => {
  const { customerId } = req.params;
  console.log(`📋 GET /api/admin/customers/${customerId}/deliveries called`);
  
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

// Create customer
router.post('/customers', verifyToken, isAdmin, async (req, res) => {
  console.log('📝 POST /api/admin/customers called');
  const { name, email, phone, deliveryTime, notes } = req.body;
  
  try {
    const result = await pool.query(`
      INSERT INTO customers (name, email, phone, delivery_time, notes, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
      RETURNING id
    `, [name, email, phone, deliveryTime || 'morning', notes || '']);
    
    res.json({ success: true, message: 'Customer created', customerId: result.rows[0].id });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update customer
router.put('/customers/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, is_active } = req.body;
  console.log(`📝 PUT /api/admin/customers/${id} called`);
  
  try {
    await pool.query(
      'UPDATE customers SET name = $1, email = $2, phone = $3, is_active = $4, updated_at = NOW() WHERE id = $5',
      [name, email, phone, is_active, id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete customer
router.delete('/customers/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  console.log(`🗑️ DELETE /api/admin/customers/${id} called`);
  
  try {
    await pool.query('DELETE FROM customers WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record daily delivery
router.post('/daily-delivery', verifyToken, isAdmin, async (req, res) => {
  console.log('📦 POST /api/admin/daily-delivery called');
  const { customer_id, delivery_boy_id, delivery_date, products, status } = req.body;
  
  try {
    const deliveryDate = delivery_date || new Date().toISOString().split('T')[0];
    
    // Delete existing
    await pool.query('DELETE FROM daily_delivery WHERE customer_id = $1 AND delivery_date = $2', [customer_id, deliveryDate]);
    
    // Insert new
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
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;