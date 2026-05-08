// controllers/customerController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getAll = async (req, res) => {
  try {
    const r = await pool.query(`SELECT c.*, (SELECT delivery_boy_id FROM customer_delivery_assignments WHERE customer_id=c.id) as assigned_boy_id, (SELECT db.name FROM delivery_boys db JOIN customer_delivery_assignments cda ON db.id=cda.delivery_boy_id WHERE cda.customer_id=c.id) as assigned_boy_name, (SELECT json_agg(json_build_object('product_name',cp.product_name,'pack_size',cp.pack_size,'quantity',cp.quantity_per_day,'price',cp.price)) FROM customer_products cp WHERE cp.customer_id=c.id) as daily_products FROM customers c ORDER BY c.created_at DESC`);
    res.json({ success: true, customers: r.rows });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.create = async (req, res) => {
  const { name, email, phone, password, address, dailyProducts } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hp = password ? await bcrypt.hash(password, 10) : null;
    const r = await client.query(`INSERT INTO customers (name,email,phone,password,area,colony,apartment,flat_no,landmark,pincode,city,state,address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, [name, email, phone, hp, address?.area, address?.colony, address?.apartment, address?.flatNo, address?.landmark, address?.pincode, address?.city, address?.state, `${address?.apartment||''} ${address?.area||''}`.trim()]);
    if (dailyProducts?.length) for (const p of dailyProducts) await client.query(`INSERT INTO customer_products (customer_id,product_name,pack_size,quantity_per_day,price) VALUES ($1,$2,$3,$4,$5)`, [r.rows[0].id, p.product_name, p.pack_size, p.quantity||1, p.price||0]);
    await client.query('COMMIT');
    res.json({ success: true, customerId: r.rows[0].id });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ success: false, error: e.message }); }
  finally { client.release(); }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, phone, address, dailyProducts } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE customers SET name=$1,phone=$2,area=$3,colony=$4,apartment=$5,flat_no=$6,landmark=$7,pincode=$8,city=$9,state=$10,address=$11 WHERE id=$12`, [name, phone, address?.area, address?.colony, address?.apartment, address?.flatNo, address?.landmark, address?.pincode, address?.city, address?.state, `${address?.apartment||''} ${address?.area||''}`.trim(), id]);
    await client.query('DELETE FROM customer_products WHERE customer_id=$1', [id]);
    if (dailyProducts?.length) for (const p of dailyProducts) await client.query(`INSERT INTO customer_products (customer_id,product_name,pack_size,quantity_per_day,price) VALUES ($1,$2,$3,$4,$5)`, [id, p.product_name, p.pack_size, p.quantity||1, p.price||0]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ success: false, error: e.message }); }
  finally { client.release(); }
};

exports.remove = async (req, res) => {
  try { await pool.query('DELETE FROM customers WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.getDeliveries = async (req, res) => {
  try {
    const r = await pool.query(`SELECT dd.*, db.name as delivery_boy_name FROM daily_delivery dd LEFT JOIN delivery_boys db ON dd.delivery_boy_id=db.id WHERE dd.customer_id=$1 ORDER BY dd.delivery_date DESC, dd.id DESC`, [req.params.customerId]);
    console.log(`📋 Found ${r.rows.length} deliveries for customer ${req.params.customerId}`);
    res.json({ success: true, deliveries: r.rows });
  } catch (e) { 
    console.error('Error getting deliveries:', e);
    res.status(500).json({ success: false, error: e.message }); 
  }
};

// ✅ FIXED: Properly record delivery with all columns
exports.recordDelivery = async (req, res) => {
  const { customer_id, delivery_boy_id, delivery_date, products, status } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const deliveryDate = delivery_date || new Date().toISOString().split('T')[0];
    const currentTime = new Date();
    
    console.log('📦 Recording delivery for customer:', customer_id);
    console.log('📦 Products to save:', JSON.stringify(products, null, 2));
    
    // First, delete any existing delivery records for this customer on this date
    await client.query(
      'DELETE FROM daily_delivery WHERE customer_id = $1 AND delivery_date = $2',
      [customer_id, deliveryDate]
    );
    
    // Insert each product as a separate delivery record
    for (const product of products) {
      const totalAmount = (product.price || 0) * (product.quantity || 1);
      
      const query = `
        INSERT INTO daily_delivery 
        (customer_id, delivery_boy_id, delivery_date, product_name, pack_size, 
         quantity, price, total_amount, status, delivered, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;
      
      const values = [
        customer_id,
        delivery_boy_id,
        deliveryDate,
        product.product_name,
        product.pack_size || '',
        product.quantity || 1,
        product.price || 0,
        totalAmount,
        status || 'delivered',
        true,  // delivered = true
        currentTime,
        currentTime
      ];
      
      const result = await client.query(query, values);
      console.log(`✅ Saved: ${product.product_name} (${product.pack_size}) x${product.quantity} = ₹${totalAmount}`);
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: `Delivery recorded for ${products.length} product(s)`,
      products_delivered: products.length
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error recording delivery:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  } finally {
    client.release();
  }
};

// ✅ Add this function to get today's deliveries for delivery boy
exports.getTodayDeliveries = async (req, res) => {
  const { delivery_boy_id } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const result = await pool.query(`
      SELECT dd.*, c.name as customer_name, c.phone, c.flat_no, c.apartment, c.area
      FROM daily_delivery dd
      JOIN customers c ON dd.customer_id = c.id
      WHERE dd.delivery_boy_id = $1 
        AND dd.delivery_date = $2
        AND dd.status = 'delivered'
      ORDER BY c.name
    `, [delivery_boy_id, today]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error getting today\'s deliveries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Add this function to delete a delivery (for undo)
exports.deleteDelivery = async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM daily_delivery WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }
    
    res.json({ success: true, message: 'Delivery deleted' });
  } catch (error) {
    console.error('Error deleting delivery:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};