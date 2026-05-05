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
      // Return defaults if no preferences set
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
    
    console.log(`📦 Preferences loaded for customer ${customerId}:`, {
      wantMilk: result.rows[0].want_milk,
      skipDays: result.rows[0].skip_days,
      extraOrders: typeof result.rows[0].extra_orders === 'string' ? 'string' : 'object'
    });
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error getting preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Save/Update customer preferences
exports.savePreferences = async (req, res) => {
  const { customerId } = req.params;
  const { wantMilk, quantity, packSize, skipDays, extraOrders } = req.body;
  
  console.log('💾 Saving preferences for customer:', customerId);
  console.log('📤 Request body:', JSON.stringify(req.body));
  
  // ✅ Ensure skipDays and extraOrders are properly stringified
  const skipDaysStr = JSON.stringify(Array.isArray(skipDays) ? skipDays : []);
  const extraOrdersStr = JSON.stringify(Array.isArray(extraOrders) ? extraOrders : []);
  
  console.log('🔧 Processed:', {
    wantMilk,
    quantity,
    packSize,
    skipDays: skipDaysStr,
    extraOrders: extraOrdersStr
  });
  
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
    
    console.log('✅ Saved successfully. Returned skip_days:', result.rows[0].skip_days);
    
    res.json({ 
      success: true, 
      message: 'Preferences saved!',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error saving preferences:', error);
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
    
    // Parse JSON fields for each row
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
        ...row,
        skip_days: skipDays,
        extra_orders: extraOrders
      };
    });
    
    console.log(`📦 Fetched ${data.length} customer preferences`);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error getting all preferences:', error);
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
          : (row.extra_orders || []);
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
    
    console.log(`📦 Found ${orders.length} customers with today's orders`);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error getting extra orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Create table if not exists
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
    
    // Ensure columns exist (in case table was created before migration)
    await pool.query(`
      DO $$ 
      BEGIN 
        BEGIN ALTER TABLE customer_preferences ADD COLUMN skip_days TEXT DEFAULT '[]'; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE customer_preferences ADD COLUMN extra_orders TEXT DEFAULT '[]'; EXCEPTION WHEN duplicate_column THEN NULL; END;
      END $$;
    `);
    
    console.log('✅ Customer preferences table ready');
  } catch (error) {
    console.error('Error creating preferences table:', error);
  }
};