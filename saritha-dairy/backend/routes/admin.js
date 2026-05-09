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
        c.*,
        cda.delivery_boy_id as assigned_boy_id,
        db.name as assigned_boy_name
      FROM customers c
      LEFT JOIN customer_delivery_assignments cda ON c.id = cda.customer_id
      LEFT JOIN delivery_boys db ON cda.delivery_boy_id = db.id
      ORDER BY c.created_at DESC
    `);
    
    const customers = [];
    for (const customer of result.rows) {
      // Check if customer_products table exists
      const productsTableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'customer_products'
        );
      `);
      
      let products = [];
      if (productsTableCheck.rows[0].exists) {
        try {
          const productsResult = await pool.query(
            'SELECT product_name, pack_size, quantity_per_day as quantity, price FROM customer_products WHERE customer_id = $1',
            [customer.id]
          );
          products = productsResult.rows;
        } catch (err) {
          console.log('Products query error:', err.message);
        }
      }
      
      customers.push({
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
        daily_products: products,
        delivery_time: customer.delivery_time || 'morning',
        notes: customer.notes,
        is_active: customer.is_active !== false,
        assigned_boy_id: customer.assigned_boy_id,
        assigned_boy_name: customer.assigned_boy_name,
        created_at: customer.created_at,
        updated_at: customer.updated_at
      });
    }
    
    res.json({ success: true, customers });
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ CREATE customer - Simplified version that definitely works
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
    
    // Simple insert first - only with columns that definitely exist
    const result = await client.query(`
      INSERT INTO customers (
        name, phone, email, password, delivery_time, notes, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING id
    `, [
      name, 
      phone, 
      email || null, 
      hashedPassword, 
      deliveryTime || 'morning', 
      notes || ''
    ]);
    
    const customerId = result.rows[0].id;
    console.log(`✅ Customer created with ID: ${customerId}`);
    
    // Update additional fields if provided
    if (registrationNumber || alternatePhone || address) {
      await client.query(`
        UPDATE customers 
        SET registration_number = COALESCE($1, registration_number),
            alternate_phone = COALESCE($2, alternate_phone),
            area = COALESCE($3, area),
            colony = COALESCE($4, colony),
            apartment = COALESCE($5, apartment),
            flat_no = COALESCE($6, flat_no),
            landmark = COALESCE($7, landmark),
            pincode = COALESCE($8, pincode),
            city = COALESCE($9, city),
            state = COALESCE($10, state)
        WHERE id = $11
      `, [
        registrationNumber || null,
        alternatePhone || null,
        address?.area || null,
        address?.colony || null,
        address?.apartment || null,
        address?.flatNo || null,
        address?.landmark || null,
        address?.pincode || null,
        address?.city || null,
        address?.state || null,
        customerId
      ]);
    }
    
    // Insert products if any
    if (dailyProducts && dailyProducts.length > 0) {
      // Check if customer_products table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'customer_products'
        );
      `);
      
      if (tableCheck.rows[0].exists) {
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
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE customer
router.put('/customers/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, registrationNumber, alternatePhone, address, dailyProducts, deliveryTime, notes, is_active } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    await client.query(`
      UPDATE customers 
      SET name = $1, 
          email = $2, 
          phone = $3, 
          registration_number = $4, 
          alternate_phone = $5,
          area = $6, 
          colony = $7, 
          apartment = $8, 
          flat_no = $9, 
          landmark = $10, 
          pincode = $11, 
          city = $12, 
          state = $13, 
          delivery_time = $14, 
          notes = $15, 
          is_active = $16, 
          updated_at = NOW()
      WHERE id = $17
    `, [
      name, 
      email, 
      phone, 
      registrationNumber || null, 
      alternatePhone || null,
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
    
    // Check if customer_products table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'customer_products'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      // Update products - delete old and insert new
      await client.query('DELETE FROM customer_products WHERE customer_id = $1', [id]);
      
      if (dailyProducts && dailyProducts.length > 0) {
        for (const product of dailyProducts) {
          if (product.product_name) {
            await client.query(`
              INSERT INTO customer_products (customer_id, product_name, pack_size, quantity_per_day, price)
              VALUES ($1, $2, $3, $4, $5)
            `, [id, product.product_name, product.pack_size || '500ml', product.quantity || 1, product.price || 0]);
          }
        }
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Customer updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// DELETE customer
router.delete('/customers/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('BEGIN');
    
    // Check if customer_products table exists and delete from it
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'customer_products'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      await pool.query('DELETE FROM customer_products WHERE customer_id = $1', [id]);
    }
    
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
      return res.status(500).json({ success: false, error: 'Daily delivery table does not exist' });
    }
    
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

// Alternative endpoint for customer deliveries
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