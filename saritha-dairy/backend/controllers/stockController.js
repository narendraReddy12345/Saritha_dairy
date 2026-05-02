const pool = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ss.*, p.image_url 
      FROM store_stock ss
      LEFT JOIN products p ON ss.product_name = p.name
      WHERE ss.quantity > 0
      ORDER BY ss.product_name, ss.pack_size_display
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.sell = async (req, res) => {
  const { product_name, pack_size_display, quantity = 1 } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE store_stock 
       SET quantity = quantity - $1 
       WHERE product_name = $2 AND pack_size_display = $3 AND quantity >= $1
       RETURNING *`,
      [quantity, product_name, pack_size_display]
    );
    
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Product not found or insufficient stock' });
    }
    
    res.json({ success: true, message: 'Product sold successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};