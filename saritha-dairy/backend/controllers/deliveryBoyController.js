// controllers/deliveryBoyController.js
const pool = require('../config/db');

const getISTDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ✅ GET all delivery boys (admin)
exports.getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT db.*,
        (SELECT COUNT(*) FROM customer_delivery_assignments WHERE delivery_boy_id = db.id) as customer_count,
        (SELECT COUNT(*) FROM daily_delivery WHERE delivery_boy_id = db.id AND delivery_date = $1) as today_deliveries
      FROM delivery_boys db ORDER BY db.created_at DESC
    `, [getISTDate()]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error getting delivery boys:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ CREATE delivery boy (admin)
exports.create = async (req, res) => {
  const { name, phone, password, email, vehicle, vehicleNo, area, address, salary, shift } = req.body;
  
  console.log('📝 Creating delivery boy:', { name, phone });
  
  try {
    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, error: 'Name, phone, and password are required' });
    }
    
    const existing = await pool.query('SELECT id FROM delivery_boys WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Phone number already registered' });
    }
    
    const result = await pool.query(
      `INSERT INTO delivery_boys (name, phone, password, email, vehicle, vehicle_no, area, address, salary, shift)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [name, phone, password, email || null, vehicle || null, vehicleNo || null, area || null, address || null, salary ? parseFloat(salary) : null, shift || 'morning']
    );
    
    console.log('✅ Delivery boy created:', result.rows[0].id);
    res.json({ success: true, data: result.rows[0], message: `${name} added successfully` });
  } catch (error) {
    console.error('❌ Error creating delivery boy:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create delivery boy' });
  }
};

// ✅ UPDATE delivery boy (admin)
exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, phone, password, email, vehicle, vehicleNo, area, address, salary, shift } = req.body;
  
  try {
    let query, params;
    if (password) {
      query = `UPDATE delivery_boys SET name=$1, phone=$2, password=$3, email=$4, vehicle=$5, vehicle_no=$6, area=$7, address=$8, salary=$9, shift=$10, updated_at=NOW() WHERE id=$11 RETURNING *`;
      params = [name, phone, password, email, vehicle, vehicleNo, area, address, salary ? parseFloat(salary) : null, shift, id];
    } else {
      query = `UPDATE delivery_boys SET name=$1, phone=$2, email=$3, vehicle=$4, vehicle_no=$5, area=$6, address=$7, salary=$8, shift=$9, updated_at=NOW() WHERE id=$10 RETURNING *`;
      params = [name, phone, email, vehicle, vehicleNo, area, address, salary ? parseFloat(salary) : null, shift, id];
    }
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delivery boy not found' });
    }
    
    res.json({ success: true, data: result.rows[0], message: 'Updated' });
  } catch (error) {
    console.error('❌ Error updating delivery boy:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ DELETE delivery boy (admin)
exports.remove = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`🗑️ Starting deletion of delivery boy ID: ${id}`);
    
    await client.query('DELETE FROM daily_delivery WHERE delivery_boy_id = $1', [id]);
    await client.query('DELETE FROM customer_delivery_assignments WHERE delivery_boy_id = $1', [id]);
    const boyResult = await client.query('DELETE FROM delivery_boys WHERE id = $1 RETURNING id, name', [id]);
    
    if (boyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Delivery boy not found' });
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: `"${boyResult.rows[0].name}" deleted successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error deleting delivery boy:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ✅ TOGGLE delivery boy status (admin)
exports.toggleStatus = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE delivery_boys SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END, updated_at=NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delivery boy not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error toggling status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ ASSIGN customers to delivery boy (admin)
exports.assignCustomers = async (req, res) => {
  const { id } = req.params;
  const { customerIds } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM customer_delivery_assignments WHERE delivery_boy_id = $1', [id]);
    
    if (customerIds && customerIds.length > 0) {
      for (const cid of customerIds) {
        await client.query(
          'INSERT INTO customer_delivery_assignments (customer_id, delivery_boy_id) VALUES ($1, $2) ON CONFLICT (customer_id) DO UPDATE SET delivery_boy_id = $2',
          [cid, id]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: `${customerIds?.length || 0} customers assigned` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error assigning:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// ✅ GET assigned customers for delivery boy (delivery boy access) - THIS WAS MISSING
exports.getAssignedCustomers = async (req, res) => {
  const { id } = req.params;
  const todayIST = getISTDate();
  
  console.log('📡 Fetching assigned customers for delivery boy ID:', id);
  console.log('📡 IST Today:', todayIST);
  
  try {
    const result = await pool.query(`
      SELECT 
        c.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'product_name', cp.product_name,
            'pack_size', cp.pack_size,
            'quantity', cp.quantity_per_day,
            'quantity_per_day', cp.quantity_per_day,
            'price', cp.price
          ))
          FROM customer_products cp WHERE cp.customer_id = c.id),
          '[]'::json
        ) as products,
        EXISTS(
          SELECT 1 FROM daily_delivery dd 
          WHERE dd.customer_id = c.id 
          AND dd.delivery_boy_id = $1 
          AND dd.delivery_date = $2
          AND dd.delivered = true
        ) as delivered
      FROM customers c
      JOIN customer_delivery_assignments cda ON c.id = cda.customer_id
      WHERE cda.delivery_boy_id = $1 
      ORDER BY c.name
    `, [id, todayIST]);
    
    console.log(`✅ Found ${result.rows.length} assigned customers with delivery status`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('❌ Error getting assigned customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};