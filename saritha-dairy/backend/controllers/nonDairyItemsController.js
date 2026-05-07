// controllers/nonDairyItemsController.js
const pool = require('../config/db');

// Get all non-dairy items
exports.getAllItems = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM non_dairy_items ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching non-dairy items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add new non-dairy product with initial stock
exports.addProduct = async (req, res) => {
  const { name, packSize, packUnit, sellingPrice, purchasePrice, quantity, supplier, notes } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const productResult = await client.query(
      `INSERT INTO non_dairy_items 
       (name, pack_size, pack_unit, selling_price, purchase_price, quantity, supplier, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [name, packSize || '1', packUnit || 'piece', sellingPrice, purchasePrice, quantity, supplier, notes]
    );
    
    const totalCost = purchasePrice * quantity;
    await client.query(
      `INSERT INTO non_dairy_purchase_history 
       (product_id, product_name, quantity, purchase_price, total_cost, supplier, transaction_type, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [productResult.rows[0].id, name, quantity, purchasePrice, totalCost, supplier, 'initial_stock', notes]
    );
    
    await client.query('COMMIT');
    
    console.log('✅ Non-dairy product added:', name);
    res.json({ success: true, data: productResult.rows[0], message: `${name} added successfully!` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding non-dairy product:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// Purchase additional stock for existing product
exports.addStock = async (req, res) => {
  const { productId, quantity, purchasePrice, supplier, invoiceNumber, notes, transactionType } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const product = await client.query('SELECT * FROM non_dairy_items WHERE id = $1', [productId]);
    
    if (product.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    const currentProduct = product.rows[0];
    const newQuantity = currentProduct.quantity + parseInt(quantity);
    const totalCost = purchasePrice * quantity;
    
    // Calculate weighted average purchase price
    const totalValue = (currentProduct.purchase_price * currentProduct.quantity) + (purchasePrice * quantity);
    const newAvgPurchasePrice = totalValue / newQuantity;
    
    await client.query(
      `UPDATE non_dairy_items 
       SET quantity = $1, purchase_price = $2, updated_at = NOW() 
       WHERE id = $3`,
      [newQuantity, newAvgPurchasePrice, productId]
    );
    
    await client.query(
      `INSERT INTO non_dairy_purchase_history 
       (product_id, product_name, quantity, purchase_price, total_cost, supplier, invoice_number, transaction_type, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [productId, currentProduct.name, quantity, purchasePrice, totalCost, supplier, invoiceNumber, transactionType || 'additional_stock', notes]
    );
    
    await client.query('COMMIT');
    
    const updatedProduct = await pool.query('SELECT * FROM non_dairy_items WHERE id = $1', [productId]);
    
    console.log('✅ Stock added for:', currentProduct.name, '+', quantity);
    res.json({ success: true, data: updatedProduct.rows[0], message: `Added ${quantity} units to ${currentProduct.name}` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding stock:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// Update product details
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, sellingPrice, purchasePrice, packSize, packUnit, supplier } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE non_dairy_items 
       SET name = COALESCE($1, name),
           selling_price = COALESCE($2, selling_price),
           purchase_price = COALESCE($3, purchase_price),
           pack_size = COALESCE($4, pack_size),
           pack_unit = COALESCE($5, pack_unit),
           supplier = COALESCE($6, supplier),
           updated_at = NOW()
       WHERE id = $7 
       RETURNING *`,
      [name, sellingPrice, purchasePrice, packSize, packUnit, supplier, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    res.json({ success: true, data: result.rows[0], message: 'Product updated successfully!' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete product and its history
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const product = await client.query('SELECT name FROM non_dairy_items WHERE id = $1', [id]);
    
    if (product.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    await client.query('DELETE FROM non_dairy_purchase_history WHERE product_id = $1', [id]);
    await client.query('DELETE FROM non_dairy_items WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    console.log('✅ Non-dairy product deleted:', product.rows[0].name);
    res.json({ success: true, message: `${product.rows[0].name} deleted successfully!` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// Get purchase history for a product
exports.getPurchaseHistory = async (req, res) => {
  const { productId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT * FROM non_dairy_purchase_history 
       WHERE product_id = $1 
       ORDER BY created_at DESC`,
      [productId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all purchase history (for reporting)
exports.getAllPurchaseHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT h.*, i.pack_size, i.pack_unit, i.selling_price as current_selling_price
       FROM non_dairy_purchase_history h
       LEFT JOIN non_dairy_items i ON h.product_id = i.id
       ORDER BY h.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};