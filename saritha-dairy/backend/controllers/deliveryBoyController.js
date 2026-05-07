// controllers/deliveryController.js
const pool = require('../config/db');

// ✅ Helper to get current IST date
const getISTDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Record a delivery
exports.record = async (req, res) => {
  const { customer_id, delivery_boy_id, products, status, total_amount } = req.body;
  const todayIST = getISTDate();
  
  console.log('📝 RECORDING DELIVERY');
  console.log('IST Today:', todayIST);
  console.log('Customer ID:', customer_id);
  console.log('Server Time (IST):', new Date().toString());
  
  if (!customer_id || !delivery_boy_id || !products || products.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: customer_id, delivery_boy_id, products' 
    });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ✅ Set timezone for this session
    await client.query("SET TIME ZONE 'Asia/Kolkata'");
    
    for (const product of products) {
      const packSize = product.pack_size || '';
      
      // ✅ Use IST date instead of CURRENT_DATE
      // First check if delivery already exists for today
      const existing = await client.query(
        `SELECT id FROM daily_delivery 
         WHERE customer_id = $1 AND delivery_boy_id = $2 AND delivery_date = $3`,
        [customer_id, delivery_boy_id, todayIST]
      );
      
      let deliveryResult;
      if (existing.rows.length > 0) {
        // Update existing
        deliveryResult = await client.query(
          `UPDATE daily_delivery 
           SET product_name = $1, pack_size = $2, quantity = $3, price = $4, 
               total_amount = $5, status = $6, delivered = true, updated_at = NOW()
           WHERE customer_id = $7 AND delivery_boy_id = $8 AND delivery_date = $9
           RETURNING id`,
          [product.product_name, packSize, product.quantity, product.price, 
           total_amount, status || 'delivered', customer_id, delivery_boy_id, todayIST]
        );
        console.log(`✅ Updated delivery for customer ${customer_id}`);
      } else {
        // Insert new
        deliveryResult = await client.query(
          `INSERT INTO daily_delivery 
           (customer_id, delivery_boy_id, delivery_date, product_name, pack_size, quantity, price, total_amount, status, delivered, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
           RETURNING id`,
          [customer_id, delivery_boy_id, todayIST, product.product_name, packSize,
           product.quantity, product.price, total_amount, status || 'delivered']
        );
        console.log(`✅ Inserted new delivery for customer ${customer_id}`);
      }
      console.log(`✅ Delivery recorded ID: ${deliveryResult.rows[0].id}`);

      // Reduce stock
      let stockResult = await client.query(
        `UPDATE store_stock SET quantity = quantity - $1 
         WHERE product_name = $2 AND pack_size_display = $3 AND quantity >= $1
         RETURNING id, quantity, product_name, pack_size_display`,
        [product.quantity, product.product_name, packSize]
      );
      
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
    
    await client.query('DELETE FROM store_stock WHERE quantity <= 0');
    await client.query('COMMIT');
    console.log('✅ All deliveries recorded successfully for date:', todayIST);
    
    res.json({ success: true, message: 'Delivery recorded successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// Get today's deliveries for a specific delivery boy
exports.getToday = async (req, res) => {
  const { boyId } = req.params;
  const todayIST = getISTDate();
  
  console.log('📡 GET TODAY DELIVERIES - Boy ID:', boyId, 'IST Date:', todayIST);
  
  try {
    const result = await pool.query(`
      SELECT dd.*, c.name as customer_name, c.phone, c.area, c.apartment, c.flat_no
      FROM daily_delivery dd
      JOIN customers c ON dd.customer_id = c.id
      WHERE dd.delivery_boy_id = $1 AND dd.delivery_date = $2
      ORDER BY dd.created_at DESC
    `, [boyId, todayIST]);
    
    console.log(`✅ Found ${result.rows.length} today deliveries`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('❌ Error in getToday:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get ALL deliveries (for admin history page)
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

// DELETE single delivery record
exports.remove = async (req, res) => {
  const { id } = req.params;
  
  console.log('🗑️ Deleting delivery ID:', id);
  
  try {
    const delivery = await pool.query(
      'SELECT * FROM daily_delivery WHERE id = $1',
      [id]
    );
    
    if (delivery.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delivery record not found' });
    }
    
    const d = delivery.rows[0];
    
    if (d.product_name && d.quantity) {
      await pool.query(
        `UPDATE store_stock SET quantity = quantity + $1 
         WHERE LOWER(product_name) LIKE LOWER($2)`,
        [d.quantity, `%${d.product_name}%`]
      );
      console.log(`📦 Stock restored: ${d.product_name} +${d.quantity}`);
    }
    
    await pool.query('DELETE FROM daily_delivery WHERE id = $1', [id]);
    
    console.log('✅ Delivery deleted');
    res.json({ success: true, message: 'Delivery record deleted!' });
  } catch (error) {
    console.error('❌ Error deleting delivery:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// BULK DELETE delivery records
exports.bulkRemove = async (req, res) => {
  const { ids } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'No IDs provided' });
  }
  
  console.log(`🗑️ Bulk deleting ${ids.length} deliveries`);
  
  try {
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