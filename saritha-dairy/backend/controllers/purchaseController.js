// controllers/purchaseController.js
const pool = require('../config/db');

// ✅ Helper to get today's date in Indian timezone
const getTodayDate = () => {
  const now = new Date();
  // Convert to Indian time (GMT+5:30)
  const indiaTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return indiaTime.toISOString().split('T')[0];
};

exports.getAll = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *, COALESCE(remaining_quantity, quantity) as remaining_quantity 
       FROM farm_purchases ORDER BY purchase_date DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.create = async (req, res) => {
  const { productName, quantity, unit, pricePerUnit, totalCost, farmName, invoiceNumber, purchaseDate, notes } = req.body;
  
  // ✅ Use the date from frontend, or use Indian timezone date
  const validDate = purchaseDate || getTodayDate();
  
  console.log('📝 Creating purchase:');
  console.log('  - Product:', productName);
  console.log('  - Quantity:', quantity);
  console.log('  - Date from frontend:', purchaseDate);
  console.log('  - Final date used:', validDate);
  console.log('  - Indian today:', getTodayDate());
  console.log('  - UTC today:', new Date().toISOString().split('T')[0]);
  
  try {
    const result = await pool.query(
      `INSERT INTO farm_purchases (product_name, quantity, unit, price_per_unit, total_cost, farm_name, invoice_number, purchase_date, notes, remaining_quantity) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [productName, quantity, unit, pricePerUnit, totalCost, farmName, invoiceNumber, validDate, notes, quantity]
    );
    
    console.log('✅ Purchase saved with date:', result.rows[0].purchase_date);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('❌ Error creating purchase:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { productName, quantity, unit, pricePerUnit, totalCost, farmName, invoiceNumber, purchaseDate, notes } = req.body;
  
  const validDate = purchaseDate || getTodayDate();
  
  console.log('📝 Updating purchase ID:', id, 'Date:', validDate);
  
  try {
    const result = await pool.query(
      `UPDATE farm_purchases 
       SET product_name=$1, quantity=$2, unit=$3, price_per_unit=$4, total_cost=$5, 
           farm_name=$6, invoice_number=$7, purchase_date=$8, notes=$9, remaining_quantity=$2
       WHERE id=$10 RETURNING *`,
      [productName, quantity, unit, pricePerUnit, totalCost, farmName, invoiceNumber, validDate, notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }
    
    console.log('✅ Purchase updated with date:', result.rows[0].purchase_date);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('❌ Error updating purchase:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.remove = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM packing_items WHERE purchase_id = $1', [id]);
    await client.query('DELETE FROM store_stock WHERE purchase_id = $1', [id]);
    await client.query('DELETE FROM farm_purchases WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Purchase deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};