// routes/customers.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// ✅ GET all customers - FIXED
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('📋 Admin fetching all customers...');
    
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
    
    console.log(`✅ Found ${result.rows.length} customers`);
    
    // Format customers with their products
    const customers = [];
    for (const customer of result.rows) {
      try {
        const productsResult = await pool.query(
          'SELECT product_name, pack_size, quantity_per_day as quantity, price FROM customer_products WHERE customer_id = $1',
          [customer.id]
        );
        
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
          daily_products: productsResult.rows,
          delivery_time: customer.delivery_time || 'morning',
          notes: customer.notes,
          is_active: customer.is_active !== false,
          assigned_boy_id: customer.assigned_boy_id,
          assigned_boy_name: customer.assigned_boy_name,
          created_at: customer.created_at,
          updated_at: customer.updated_at
        });
      } catch (err) {
        console.log(`Error fetching products for customer ${customer.id}:`, err.message);
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
          daily_products: [],
          delivery_time: customer.delivery_time || 'morning',
          notes: customer.notes,
          is_active: customer.is_active !== false,
          assigned_boy_id: customer.assigned_boy_id,
          assigned_boy_name: customer.assigned_boy_name,
          created_at: customer.created_at,
          updated_at: customer.updated_at
        });
      }
    }
    
    res.json({ success: true, customers });
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ GET customer deliveries
router.get('/:customerId/deliveries', verifyToken, isAdmin, async (req, res) => {
  const { customerId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT dd.*, db.name as delivery_boy_name 
      FROM daily_delivery dd 
      LEFT JOIN delivery_boys db ON dd.delivery_boy_id = db.id 
      WHERE dd.customer_id = $1 
      ORDER BY dd.delivery_date DESC, dd.id DESC
    `, [customerId]);
    
    console.log(`📋 Found ${result.rows.length} deliveries for customer ${customerId}`);
    res.json({ success: true, deliveries: result.rows });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ POST record delivery
router.post('/daily-delivery', verifyToken, isAdmin, async (req, res) => {
  const { customer_id, delivery_boy_id, delivery_date, products, status } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const deliveryDate = delivery_date || new Date().toISOString().split('T')[0];
    const currentTime = new Date();
    
    console.log('📦 Recording delivery for customer:', customer_id);
    
    // Delete existing delivery records for this customer on this date
    await client.query(
      'DELETE FROM daily_delivery WHERE customer_id = $1 AND delivery_date = $2',
      [customer_id, deliveryDate]
    );
    
    // Insert each product
    for (const product of products) {
      const totalAmount = (product.price || 0) * (product.quantity || 1);
      
      await client.query(`
        INSERT INTO daily_delivery 
        (customer_id, delivery_boy_id, delivery_date, product_name, pack_size, 
         quantity, price, total_amount, status, delivered, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        customer_id, delivery_boy_id, deliveryDate,
        product.product_name, product.pack_size || '',
        product.quantity || 1, product.price || 0, totalAmount,
        status || 'delivered', true, currentTime, currentTime
      ]);
      
      console.log(`✅ Saved: ${product.product_name} x${product.quantity} = ₹${totalAmount}`);
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: `Delivery recorded for ${products.length} product(s)`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error recording delivery:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// ✅ GET single customer
router.get('/customer/:id', verifyToken, isAdmin, async (req, res) => {
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

// ✅ POST create customer
router.post('/', verifyToken, isAdmin, async (req, res) => {
  const { name, email, phone, password, registrationNumber, alternatePhone, address, dailyProducts, deliveryTime, notes } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }
    
    const result = await client.query(`
      INSERT INTO customers (
        name, email, phone, password, registration_number, alternate_phone,
        area, colony, apartment, flat_no, landmark, pincode, city, state,
        delivery_time, notes, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, NOW(), NOW())
      RETURNING id
    `, [
      name, email, phone, hashedPassword, registrationNumber, alternatePhone,
      address?.area || '', address?.colony || '', address?.apartment || '', 
      address?.flatNo || '', address?.landmark || '', address?.pincode || '',
      address?.city || '', address?.state || '',
      deliveryTime || 'morning', notes || ''
    ]);
    
    const customerId = result.rows[0].id;
    
    if (dailyProducts && dailyProducts.length > 0) {
      for (const product of dailyProducts) {
        await client.query(`
          INSERT INTO customer_products (customer_id, product_name, pack_size, quantity_per_day, price)
          VALUES ($1, $2, $3, $4, $5)
        `, [customerId, product.product_name, product.pack_size, product.quantity || 1, product.price || 0]);
      }
    }
    
    await client.query('COMMIT');
    
    res.json({ success: true, message: 'Customer created successfully', customerId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// ✅ PUT update customer
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, registrationNumber, alternatePhone, address, dailyProducts, deliveryTime, notes, is_active } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    await client.query(`
      UPDATE customers 
      SET name = $1, email = $2, phone = $3, registration_number = $4, alternate_phone = $5,
          area = $6, colony = $7, apartment = $8, flat_no = $9, landmark = $10, 
          pincode = $11, city = $12, state = $13, delivery_time = $14, notes = $15, 
          is_active = $16, updated_at = NOW()
      WHERE id = $17
    `, [
      name, email, phone, registrationNumber, alternatePhone,
      address?.area || '', address?.colony || '', address?.apartment || '', 
      address?.flatNo || '', address?.landmark || '', address?.pincode || '',
      address?.city || '', address?.state || '',
      deliveryTime || 'morning', notes || '', is_active !== false, id
    ]);
    
    await client.query('DELETE FROM customer_products WHERE customer_id = $1', [id]);
    
    if (dailyProducts && dailyProducts.length > 0) {
      for (const product of dailyProducts) {
        await client.query(`
          INSERT INTO customer_products (customer_id, product_name, pack_size, quantity_per_day, price)
          VALUES ($1, $2, $3, $4, $5)
        `, [id, product.product_name, product.pack_size, product.quantity || 1, product.price || 0]);
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

// ✅ DELETE customer
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('BEGIN');
    await pool.query('DELETE FROM customer_products WHERE customer_id = $1', [id]);
    await pool.query('DELETE FROM customers WHERE id = $1', [id]);
    await pool.query('COMMIT');
    
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error deleting customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;