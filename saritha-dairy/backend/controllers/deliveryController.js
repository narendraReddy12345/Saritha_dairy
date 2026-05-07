// controllers/deliveryController.js - COMPLETE FILE WITH DELETE + STOCK REDUCTION
const pool = require('../config/db');

// ✅ Record a delivery AND reduce stock from store_stock
exports.record = async (req, res) => {
  const { customer_id, delivery_boy_id, products, status, total_amount } = req.body;
  
  console.log('📝 RECORDING DELIVERY');
  console.log('Customer ID:', customer_id);
  console.log('Products:', JSON.stringify(products));
  
  if (!customer_id || !delivery_boy_id || !products || products.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: customer_id, delivery_boy_id, products' 
    });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const product of products) {
      const packSize = product.pack_size || '';
      
      // STEP 1: Insert into daily_delivery
      const deliveryResult = await client.query(
        `INSERT INTO daily_delivery 
         (customer_id, delivery_boy_id, delivery_date, product_name, pack_size, quantity, price, total_amount, status)
         VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [customer_id, delivery_boy_id, product.product_name, packSize,
         product.quantity, product.price, total_amount, status || 'delivered']
      );
      console.log(`✅ Inserted delivery ID: ${deliveryResult.rows[0].id}`);

      // STEP 2: Reduce stock - try exact match first
      let stockResult = await client.query(
        `UPDATE store_stock SET quantity = quantity - $1 
         WHERE product_name = $2 AND pack_size_display = $3 AND quantity >= $1
         RETURNING id, quantity, product_name, pack_size_display`,
        [product.quantity, product.product_name, packSize]
      );
      
      // Fallback: case-insensitive match
      if (stockResult.rows.length === 0 && packSize) {
        stockResult = await client.query(
          `UPDATE store_stock SET quantity = quantity - $1 
           WHERE LOWER(product_name) = LOWER($2) 
           AND LOWER(REPLACE(pack_size_display, ' ', '')) = LOWER(REPLACE($3, ' ', ''))
           AND quantity >= $1
           RETURNING id, quantity, product_name, pack_size_display`,
          [product.quantity, product.product_name, packSize]
        );
      }
      
      // Fallback: any pack size for this product
      if (stockResult.rows.length === 0) {
        stockResult = await client.query(
          `UPDATE store_stock SET quantity = quantity - $1 
           WHERE LOWER(product_name) LIKE LOWER($2) AND quantity >= $1
           RETURNING id, quantity, product_name, pack_size_display`,
          [product.quantity, `%${product.product_name}%`]
        );
      }
      
      if (stockResult.rows.length > 0) {
        console.log(`📊 Stock reduced: ${stockResult.rows[0].quantity} remaining`);
      } else {
        console.log(`⚠️ Could NOT reduce stock for "${product.product_name}"`);
      }
    }
    
    // Clean up zero quantity items
    await client.query('DELETE FROM store_stock WHERE quantity <= 0');
    
    await client.query('COMMIT');
    console.log('✅ All deliveries recorded successfully');
    
    res.json({ success: true, message: 'Delivery recorded successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ✅ Get today's deliveries for a specific delivery boy
exports.getToday = async (req, res) => {
  const { boyId } = req.params;
  
  console.log('📡 GET TODAY DELIVERIES - Boy ID:', boyId);
  
  try {
    const result = await pool.query(`
      SELECT dd.*, c.name as customer_name, c.phone, c.area, c.apartment, c.flat_no
      FROM daily_delivery dd
      JOIN customers c ON dd.customer_id = c.id
      WHERE dd.delivery_boy_id = $1 AND DATE(dd.delivery_date) = CURRENT_DATE
      ORDER BY dd.created_at DESC
    `, [boyId]);
    
    console.log(`✅ Found ${result.rows.length} today deliveries`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('❌ Error in getToday:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Get ALL deliveries (for admin history page)
exports.getAll = async (req, res) => {
  console.log('📡 Fetching ALL deliveries...');
  try {
    const result = await pool.query(`
      SELECT 
        dd.*,
        c.name as customer_name, c.phone as customer_phone,
        c.apartment, c.area, c.flat_no, c.city, c.landmark,
        db.name as delivery_boy_name, db.phone as delivery_boy_phone, db.vehicle as delivery_boy_vehicle
      FROM daily_delivery dd
      LEFT JOIN customers c ON dd.customer_id = c.id
      LEFT JOIN delivery_boys db ON dd.delivery_boy_id = db.id
      ORDER BY dd.delivery_date DESC, dd.created_at DESC
    `);
    
    console.log(`✅ Found ${result.rows.length} total deliveries`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('❌ Error in getAll:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ DELETE single delivery record
exports.remove = async (req, res) => {
  const { id } = req.params;
  
  console.log('🗑️ Deleting delivery ID:', id);
  
  try {
    // Get delivery details before deleting (to restore stock if needed)
    const delivery = await pool.query(
      'SELECT * FROM daily_delivery WHERE id = $1',
      [id]
    );
    
    if (delivery.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delivery record not found' });
    }
    
    const d = delivery.rows[0];
    
    // Optional: Restore stock back to store_stock
    if (d.product_name && d.quantity) {
      await pool.query(
        `UPDATE store_stock SET quantity = quantity + $1 
         WHERE LOWER(product_name) LIKE LOWER($2)`,
        [d.quantity, `%${d.product_name}%`]
      );
      console.log(`📦 Stock restored: ${d.product_name} +${d.quantity}`);
    }
    
    // Delete the delivery record
    await pool.query('DELETE FROM daily_delivery WHERE id = $1', [id]);
    
    console.log('✅ Delivery deleted:', d.customer_name || 'Unknown');
    res.json({ success: true, message: 'Delivery record deleted!' });
  } catch (error) {
    console.error('❌ Error deleting delivery:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ BULK DELETE delivery records
exports.bulkRemove = async (req, res) => {
  const { ids } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'No IDs provided' });
  }
  
  console.log(`🗑️ Bulk deleting ${ids.length} deliveries`);
  
  try {
    // Restore stock for all deleted deliveries
    const deliveries = await pool.query(
      'SELECT product_name, quantity FROM daily_delivery WHERE id = ANY($1)',
      [ids]
    );
    
    for (const d of deliveries.rows) {
      if (d.product_name && d.quantity) {
        await pool.query(
          `UPDATE store_stock SET quantity = quantity + $1 
           WHERE LOWER(product_name) LIKE LOWER($2)`,
          [d.quantity, `%${d.product_name}%`]
        );
      }
    }
    
    const result = await pool.query(
      'DELETE FROM daily_delivery WHERE id = ANY($1) RETURNING id',
      [ids]
    );
    
    console.log(`✅ Deleted ${result.rows.length} records`);
    res.json({ 
      success: true, 
      deleted: result.rows.length,
      message: `${result.rows.length} records deleted!` 
    });
  } catch (error) {
    console.error('❌ Error in bulk delete:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};