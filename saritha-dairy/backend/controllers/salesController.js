const pool = require('../config/db');

exports.create = async (req, res) => {
  const { customer_name, customer_phone, items, total } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const saleResult = await client.query(
      `INSERT INTO sales (customer_name, customer_phone, total_amount, sold_at)
       VALUES ($1, $2, $3, NOW()) RETURNING id`,
      [customer_name || 'Walk-in Customer', customer_phone || 'N/A', total]
    );
    
    const saleId = saleResult.rows[0].id;
    
    for (const item of items) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_name, pack_size_display, quantity, price, total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [saleId, item.product_name, item.pack_size_display, item.quantity, item.price, item.total]
      );
      
      await client.query(
        `UPDATE store_stock 
         SET quantity = quantity - $1 
         WHERE product_name = $2 AND pack_size_display = $3`,
        [item.quantity, item.product_name, item.pack_size_display]
      );
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Sale completed', sale_id: saleId });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

exports.getHistory = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, 
        COALESCE(
          (SELECT json_agg(json_build_object(
            'product_name', si.product_name,
            'pack_size_display', si.pack_size_display,
            'quantity', si.quantity,
            'price', si.price,
            'total', si.total
          ) ORDER BY si.id) 
          FROM sale_items si WHERE si.sale_id = s.id),
          '[]'::json
        ) as items
      FROM sales s
      ORDER BY s.sold_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.remove = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
    await client.query('DELETE FROM sales WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Sale record deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};