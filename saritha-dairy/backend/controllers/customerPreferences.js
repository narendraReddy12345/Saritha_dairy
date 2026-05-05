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
          wantMilk: true,
          quantity: 2,
          packSize: '500ml',
          skipDays: []
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
  const { wantMilk, quantity, packSize, skipDays } = req.body;
  
  try {
    await pool.query(`
      INSERT INTO customer_preferences (customer_id, want_milk, quantity, pack_size, skip_days, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (customer_id) 
      DO UPDATE SET want_milk = $2, quantity = $3, pack_size = $4, skip_days = $5, updated_at = NOW()
    `, [customerId, wantMilk, quantity, packSize, JSON.stringify(skipDays || [])]);
    
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Customer preferences table ready');
  } catch (error) {
    console.error('Error creating preferences table:', error);
  }
};