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
          skip_days: [],
          extra_orders: []
        }
      });
    }
    
    // Parse JSON fields
    let skipDays = result.rows[0].skip_days;
    let extraOrders = result.rows[0].extra_orders;
    
    if (typeof skipDays === 'string') {
      try { skipDays = JSON.parse(skipDays); } catch(e) { skipDays = []; }
    }
    if (typeof extraOrders === 'string') {
      try { extraOrders = JSON.parse(extraOrders); } catch(e) { extraOrders = []; }
    }
    
    res.json({ 
      success: true, 
      data: {
        ...result.rows[0],
        skip_days: skipDays,
        extra_orders: extraOrders
      }
    });
  } catch (error) {
    console.error('Error getting preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Save/Update customer preferences
exports.savePreferences = async (req, res) => {
  const { customerId } = req.params;
  const { wantMilk, quantity, packSize, skipDays, extraOrders } = req.body;
  
  const skipDaysStr = JSON.stringify(Array.isArray(skipDays) ? skipDays : []);
  const extraOrdersStr = JSON.stringify(Array.isArray(extraOrders) ? extraOrders : []);
  
  try {
    const result = await pool.query(`
      INSERT INTO customer_preferences (customer_id, want_milk, quantity, pack_size, skip_days, extra_orders, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (customer_id) 
      DO UPDATE SET 
        want_milk = EXCLUDED.want_milk,
        quantity = EXCLUDED.quantity,
        pack_size = EXCLUDED.pack_size,
        skip_days = EXCLUDED.skip_days,
        extra_orders = EXCLUDED.extra_orders,
        updated_at = NOW()
      RETURNING *
    `, [customerId, wantMilk ?? true, quantity ?? 2, packSize ?? '500ml', skipDaysStr, extraOrdersStr]);
    
    res.json({ success: true, message: 'Preferences saved!', data: result.rows[0] });
  } catch (error) {
    console.error('Error saving preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all customer preferences (for admin)
exports.getAllPreferences = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cp.*, c.name, c.phone, c.apartment, c.flat_no
      FROM customer_preferences cp
      JOIN customers c ON cp.customer_id = c.id
      ORDER BY c.name
    `);
    
    const data = result.rows.map(row => {
      let skipDays = [];
      let extraOrders = [];
      
      try {
        skipDays = typeof row.skip_days === 'string' ? JSON.parse(row.skip_days) : (row.skip_days || []);
      } catch (e) { skipDays = []; }
      
      try {
        extraOrders = typeof row.extra_orders === 'string' ? JSON.parse(row.extra_orders) : (row.extra_orders || []);
      } catch (e) { extraOrders = []; }
      
      return { ...row, skip_days: skipDays, extra_orders: extraOrders };
    });
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error getting all preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get ALL customer extra orders (for admin)
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
          : (row.extra_orders || []);
      } catch (e) { extraOrders = []; }
      
      const todayOrders = extraOrders.filter(o => o.date === today && !o.delivered);
      
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
    console.error('Error getting extra orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get extra orders for delivery boy's assigned customers
exports.getDeliveryBoyExtraOrders = async (req, res) => {
  const { delivery_boy_id } = req.params;
  
  if (req.user.role !== 'admin' && req.user.id !== parseInt(delivery_boy_id)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const result = await pool.query(`
      SELECT 
        c.id as customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        c.apartment,
        c.flat_no,
        c.area,
        cp.extra_orders
      FROM customers c
      JOIN customer_delivery_assignments cda ON c.id = cda.customer_id
      JOIN customer_preferences cp ON c.id = cp.customer_id
      WHERE cda.delivery_boy_id = $1
      ORDER BY c.apartment, c.flat_no
    `, [delivery_boy_id]);
    
    const today = new Date().toISOString().split('T')[0];
    
    const orders = result.rows.map(row => {
      let extraOrders = [];
      try {
        extraOrders = typeof row.extra_orders === 'string' 
          ? JSON.parse(row.extra_orders) 
          : (row.extra_orders || []);
      } catch (e) { extraOrders = []; }
      
      const todayOrders = extraOrders.filter(o => o.date === today && !o.delivered);
      
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
    console.error('Error getting delivery boy extra orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all preferences for delivery boy's assigned customers
exports.getDeliveryBoyAssignedPreferences = async (req, res) => {
  const { delivery_boy_id } = req.params;
  
  if (req.user.role !== 'admin' && req.user.id !== parseInt(delivery_boy_id)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const result = await pool.query(`
      SELECT 
        cp.*,
        c.name,
        c.phone,
        c.apartment,
        c.flat_no,
        c.area
      FROM customer_preferences cp
      JOIN customers c ON cp.customer_id = c.id
      JOIN customer_delivery_assignments cda ON c.id = cda.customer_id
      WHERE cda.delivery_boy_id = $1
      ORDER BY c.apartment, c.flat_no
    `, [delivery_boy_id]);
    
    const data = result.rows.map(row => {
      let skipDays = [];
      let extraOrders = [];
      
      try {
        skipDays = typeof row.skip_days === 'string' ? JSON.parse(row.skip_days) : (row.skip_days || []);
      } catch (e) { skipDays = []; }
      
      try {
        extraOrders = typeof row.extra_orders === 'string' ? JSON.parse(row.extra_orders) : (row.extra_orders || []);
      } catch (e) { extraOrders = []; }
      
      return {
        customer_id: row.customer_id,
        want_milk: row.want_milk,
        quantity: row.quantity,
        pack_size: row.pack_size,
        skip_days: skipDays,
        extra_orders: extraOrders,
        name: row.name,
        phone: row.phone,
        apartment: row.apartment,
        flat_no: row.flat_no,
        area: row.area
      };
    });
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error getting delivery boy preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ NEW: Mark extra order as delivered
exports.markExtraOrderDelivered = async (req, res) => {
  const { customerId, orderId } = req.params;
  
  try {
    // Get current preferences
    const result = await pool.query(
      'SELECT extra_orders FROM customer_preferences WHERE customer_id = $1',
      [customerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Preferences not found' });
    }
    
    let extraOrders = result.rows[0].extra_orders;
    if (typeof extraOrders === 'string') {
      try { extraOrders = JSON.parse(extraOrders); } catch(e) { extraOrders = []; }
    }
    
    // Find and mark the order as delivered
    const updatedOrders = extraOrders.map(order => {
      if (order.id == orderId && !order.delivered) {
        return { ...order, delivered: true };
      }
      return order;
    });
    
    // Save back to database
    await pool.query(
      'UPDATE customer_preferences SET extra_orders = $1, updated_at = NOW() WHERE customer_id = $2',
      [JSON.stringify(updatedOrders), customerId]
    );
    
    res.json({ success: true, message: 'Order marked as delivered' });
  } catch (error) {
    console.error('Error marking order delivered:', error);
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
