// controllers/deliveryController.js - COMPLETE FILE WITH STOCK REDUCTION
const pool = require('../config/db');

// ✅ Record a delivery AND reduce stock from store_stock
exports.record = async (req, res) => {
  const { customer_id, delivery_boy_id, products, status, total_amount } = req.body;
  
  console.log('========================================');
  console.log('📝 RECORDING DELIVERY');
  console.log('Customer ID:', customer_id);
  console.log('Delivery Boy ID:', delivery_boy_id);
  console.log('Products:', JSON.stringify(products));
  console.log('Total amount:', total_amount);
  console.log('Status:', status);
  console.log('========================================');
  
  if (!customer_id || !delivery_boy_id || !products || products.length === 0) {
    console.log('❌ Missing required fields');
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
      
      console.log(`📦 Processing: ${product.product_name} x${product.quantity} (pack: "${packSize}")`);
      
      // ✅ STEP 1: Insert into daily_delivery
      const deliveryResult = await client.query(
        `INSERT INTO daily_delivery 
         (customer_id, delivery_boy_id, delivery_date, product_name, pack_size, quantity, price, total_amount, status)
         VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
         RETURNING id, delivery_date`,
        [
          customer_id, delivery_boy_id, 
          product.product_name, packSize,
          product.quantity, product.price, 
          total_amount, status || 'delivered'
        ]
      );
      console.log(`✅ Inserted delivery ID: ${deliveryResult.rows[0].id}`);

      // ✅ STEP 2: Check available stock
      const stockCheck = await client.query(
        `SELECT product_name, pack_size_display, quantity 
         FROM store_stock WHERE quantity > 0 
         AND LOWER(product_name) LIKE LOWER($1)`,
        [`%${product.product_name}%`]
      );
      
      if (stockCheck.rows.length === 0) {
        console.log(`⚠️ NO stock exists for "${product.product_name}"`);
        console.log(`   Make sure products are packed before delivery!`);
        continue;
      }
      
      console.log(`📦 Available stock for "${product.product_name}":`);
      stockCheck.rows.forEach(s => {
        console.log(`   - "${s.product_name}" | "${s.pack_size_display}" | Qty: ${s.quantity}`);
      });

      // ✅ STEP 3: Try to reduce stock - Strategy 1: Exact match
      let stockResult = await client.query(
        `UPDATE store_stock 
         SET quantity = quantity - $1 
         WHERE product_name = $2 AND pack_size_display = $3 AND quantity >= $1
         RETURNING id, quantity, product_name, pack_size_display`,
        [product.quantity, product.product_name, packSize]
      );
      
      // Strategy 2: Match without spaces ("500ml" matches "500 ml")
      if (stockResult.rows.length === 0 && packSize) {
        const packSizeNoSpace = packSize.replace(/\s/g, '');
        stockResult = await client.query(
          `UPDATE store_stock SET quantity = quantity - $1 
           WHERE product_name = $2 AND REPLACE(pack_size_display, ' ', '') = $3 AND quantity >= $1
           RETURNING id, quantity, product_name, pack_size_display`,
          [product.quantity, product.product_name, packSizeNoSpace]
        );
      }
      
      // Strategy 3: Case-insensitive match
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
      
      // Strategy 4: Any pack size for this product
      if (stockResult.rows.length === 0) {
        stockResult = await client.query(
          `UPDATE store_stock SET quantity = quantity - $1 
           WHERE LOWER(product_name) LIKE LOWER($2) AND quantity >= $1
           RETURNING id, quantity, product_name, pack_size_display`,
          [product.quantity, `%${product.product_name}%`]
        );
      }
      
      if (stockResult.rows.length > 0) {
        const stock = stockResult.rows[0];
        console.log(`📊 Stock reduced: "${stock.product_name}" (${stock.pack_size_display}) - ${stock.quantity} remaining`);
      } else {
        console.log(`⚠️ Could NOT reduce stock for "${product.product_name}" (${packSize})`);
        console.log(`   Delivery recorded but stock unchanged. Check pack size match.`);
      }
    }
    
    // ✅ STEP 4: Clean up items with 0 quantity
    const deleted = await client.query(
      `DELETE FROM store_stock WHERE quantity <= 0 RETURNING id, product_name, pack_size_display`
    );
    if (deleted.rows.length > 0) {
      console.log(`🗑️ Removed ${deleted.rows.length} out-of-stock items`);
    }
    
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
      SELECT 
        dd.*, 
        c.name as customer_name, c.phone, c.area, c.apartment, c.flat_no
      FROM daily_delivery dd
      JOIN customers c ON dd.customer_id = c.id
      WHERE dd.delivery_boy_id = $1 
      AND DATE(dd.delivery_date) = CURRENT_DATE
      ORDER BY dd.created_at DESC
    `, [boyId]);
    
    console.log(`✅ Found ${result.rows.length} today deliveries`);
    
    if (result.rows.length > 0) {
      result.rows.forEach((d, i) => {
        console.log(`  ${i+1}. ${d.customer_name} | ${d.product_name} x${d.quantity} | ${d.status}`);
      });
    } else {
      const allRes = await pool.query(
        `SELECT dd.id, dd.customer_id, dd.delivery_date, dd.status, c.name 
         FROM daily_delivery dd LEFT JOIN customers c ON dd.customer_id = c.id 
         WHERE dd.delivery_boy_id = $1 ORDER BY dd.id DESC LIMIT 10`,
        [boyId]
      );
      console.log(`  Last 10 deliveries for boy ${boyId}:`);
      allRes.rows.forEach(d => {
        console.log(`    ID:${d.id} | ${d.name || d.customer_id} | Date:${d.delivery_date} | ${d.status}`);
      });
    }
    
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