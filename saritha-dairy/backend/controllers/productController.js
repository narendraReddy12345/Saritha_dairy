const pool = require('../config/db');

exports.getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.create = async (req, res) => {
  const { name, packs } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const result = await pool.query(
      'INSERT INTO products (name, packs, image_url) VALUES ($1, $2, $3) RETURNING *',
      [name, packs, image_url]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, packs } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  
  try {
    let query, params;
    if (image_url) {
      query = 'UPDATE products SET name=$1, packs=$2, image_url=$3 WHERE id=$4 RETURNING *';
      params = [name, packs, image_url, id];
    } else {
      query = 'UPDATE products SET name=$1, packs=$2 WHERE id=$3 RETURNING *';
      params = [name, packs, id];
    }
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};