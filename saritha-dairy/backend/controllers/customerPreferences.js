const pool = require('../config/db');

// Get customer preferences
exports.getPreferences = async (req, res) => {
  const { customerId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM customer_preferences WHERE customer_id = $1',
      [customerId]
    );
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          want_milk: true,
          quantity: 2,
          pack_size: '500ml',
          skip_days: '[]',
          extra_orders: '[]'
        }
      });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Save/Update customer preferences
exports.savePreferences = async (req, res) => {
  const { customerId } = req.params;
  const { wantMilk, quantity, packSize, skipDays, extraOrders } = req.body;
  
  try {
    await pool.query(`
      INSERT INTO customer_preferences (customer_id, want_milk, quantity, pack_size, skip_days, extra_orders, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (customer_id) 
      DO UPDATE SET want_milk = $2, quantity = $3, pack_size = $4, skip_days = $5, extra_orders = $6, updated_at = NOW()
    `, [
      customerId, 
      wantMilk, 
      quantity, 
      packSize, 
      JSON.stringify(skipDays || []), 
      JSON.stringify(extraOrders || [])
    ]);
    
    res.json({ success: true, message: 'Preferences saved!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all customer preferences (for admin/delivery)
exports.getAllPreferences = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cp.*, c.name, c.phone, c.apartment, c.flat_no
      FROM customer_preferences cp
      JOIN customers c ON cp.customer_id = c.id
      ORDER BY c.name
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Get ALL customer extra orders (for admin & delivery boy)
exports.getAllExtraOrders = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        cp.customer_id,
        cp.extra_orders,
        c.name as customer_name,
        c.phone as customer_phone,
        c.apartment,
        c.flat_no,
        c.area
      FROM customer_preferences cp
      JOIN customers c ON cp.customer_id = c.id
      WHERE cp.extra_orders IS NOT NULL 
        AND cp.extra_orders != '[]'
        AND cp.extra_orders != 'null'
      ORDER BY c.name
    `);
    
    const today = new Date().toISOString().split('T')[0];
    
    const orders = result.rows.map(row => {
      let extraOrders = [];
      try {
        extraOrders = typeof row.extra_orders === 'string' 
          ? JSON.parse(row.extra_orders) 
          : row.extra_orders;
      } catch (e) { extraOrders = []; }
      
      const todayOrders = extraOrders.filter(o => o.date === today);
      
      return {
        customerId: row.customer_id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        apartment: row.apartment,
        flatNo: row.flat_no,
        area: row.area,
        orders: todayOrders
      };
    }).filter(o => o.orders.length > 0);
    
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create table if not exists
exports.createTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_preferences (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
        want_milk BOOLEAN DEFAULT true,
        quantity INTEGER DEFAULT 2,
        pack_size VARCHAR(20) DEFAULT '500ml',
        skip_days TEXT DEFAULT '[]',
        extra_orders TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Customer preferences table ready');
  } catch (error) {
    console.error('Error creating preferences table:', error);
  }
};