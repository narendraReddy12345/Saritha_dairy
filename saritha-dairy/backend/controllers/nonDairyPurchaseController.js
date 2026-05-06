// controllers/nonDairyPurchaseController.js
const pool = require('../config/db'); // Adjust path to your DB config

// Get all non-dairy purchases
const getAllNonDairyPurchases = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ndp.*, p.name as product_name_from_db 
       FROM non_dairy_purchases ndp
       LEFT JOIN products p ON ndp.product_id = p.id
       ORDER BY ndp.purchase_date DESC`
    );
    
    res.json({ 
      success: true, 
      data: result.rows 
    });
  } catch (error) {
    console.error('Error fetching non-dairy purchases:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Get single non-dairy purchase by ID
const getNonDairyPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM non_dairy_purchases WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Purchase not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('Error fetching purchase:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Create new non-dairy purchase
const createNonDairyPurchase = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const {
      productId,
      productName,
      packSize,
      packUnit,
      quantity,
      pricePerUnit,
      totalCost,
      supplier,
      invoiceNumber,
      purchaseDate,
      notes,
      supplierId
    } = req.body;
    
    await client.query('BEGIN');
    
    // Insert the purchase
    const result = await client.query(
      `INSERT INTO non_dairy_purchases 
       (product_id, product_name, pack_size, pack_unit, quantity, 
        price_per_unit, total_cost, supplier, invoice_number, 
        purchase_date, notes, supplier_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [
        productId || null,
        productName,
        packSize || '1',
        packUnit || 'piece',
        quantity,
        pricePerUnit,
        totalCost,
        supplier || null,
        invoiceNumber || null,
        purchaseDate || new Date().toISOString().split('T')[0],
        notes || null,
        supplierId || null
      ]
    );
    
    const newPurchase = result.rows[0];
    
    // Update or insert into non_dairy_stock
    if (productId) {
      const stockCheck = await client.query(
        `SELECT * FROM non_dairy_stock 
         WHERE product_id = $1 AND pack_size = $2`,
        [productId, packSize || '1']
      );
      
      if (stockCheck.rows.length > 0) {
        // Update existing stock
        await client.query(
          `UPDATE non_dairy_stock 
           SET quantity = quantity + $1,
               last_purchase_id = $2,
               purchase_price = $3,
               selling_price = COALESCE($4, selling_price),
               updated_at = NOW()
           WHERE product_id = $5 AND pack_size = $6`,
          [
            quantity,
            newPurchase.id,
            pricePerUnit,
            pricePerUnit * 1.2, // Suggested selling price (20% margin)
            productId,
            packSize || '1'
          ]
        );
      } else {
        // Insert new stock record
        await client.query(
          `INSERT INTO non_dairy_stock 
           (product_id, product_name, pack_size, pack_unit, quantity, 
            purchase_price, selling_price, last_purchase_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            productId,
            productName,
            packSize || '1',
            packUnit || 'piece',
            quantity,
            pricePerUnit,
            pricePerUnit * 1.2, // Suggested selling price
            newPurchase.id
          ]
        );
      }
    }
    
    // Log stock movement
    await client.query(
      `INSERT INTO stock_movements 
       (product_name, product_type, movement_type, quantity, unit, 
        reference_id, reference_type, previous_stock, new_stock, notes, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        productName,
        'non-dairy',
        'purchase',
        quantity,
        packUnit || 'piece',
        newPurchase.id,
        'non_dairy_purchase',
        0,
        quantity,
        `Purchased ${quantity} ${packUnit} packs at ₹${pricePerUnit} each`,
        req.user?.email || 'admin'
      ]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      data: newPurchase,
      message: 'Purchase saved successfully' 
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  } finally {
    client.release();
  }
};

// Update non-dairy purchase
const updateNonDairyPurchase = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const {
      productName,
      packSize,
      packUnit,
      quantity,
      pricePerUnit,
      totalCost,
      supplier,
      invoiceNumber,
      purchaseDate,
      notes,
      productId
    } = req.body;
    
    // Get old purchase data first
    const oldPurchase = await client.query(
      'SELECT * FROM non_dairy_purchases WHERE id = $1',
      [id]
    );
    
    if (oldPurchase.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Purchase not found' 
      });
    }
    
    await client.query('BEGIN');
    
    // Update the purchase
    const result = await client.query(
      `UPDATE non_dairy_purchases 
       SET product_name = $1, pack_size = $2, pack_unit = $3, 
           quantity = $4, price_per_unit = $5, total_cost = $6, 
           supplier = $7, invoice_number = $8, purchase_date = $9, 
           notes = $10, product_id = $11, updated_at = NOW()
       WHERE id = $12 
       RETURNING *`,
      [
        productName,
        packSize,
        packUnit,
        quantity,
        pricePerUnit,
        totalCost,
        supplier,
        invoiceNumber,
        purchaseDate,
        notes,
        productId || null,
        id
      ]
    );
    
    // Update stock quantities (adjust by difference)
    if (productId && oldPurchase.rows[0].product_id === productId) {
      const quantityDiff = quantity - oldPurchase.rows[0].quantity;
      
      if (quantityDiff !== 0) {
        await client.query(
          `UPDATE non_dairy_stock 
           SET quantity = quantity + $1,
               purchase_price = $2,
               updated_at = NOW()
           WHERE product_id = $3 AND pack_size = $4`,
          [quantityDiff, pricePerUnit, productId, packSize]
        );
      }
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      data: result.rows[0],
      message: 'Purchase updated successfully' 
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating purchase:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  } finally {
    client.release();
  }
};

// Delete non-dairy purchase
const deleteNonDairyPurchase = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // Get purchase data before deletion
    const purchase = await client.query(
      'SELECT * FROM non_dairy_purchases WHERE id = $1',
      [id]
    );
    
    if (purchase.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Purchase not found' 
      });
    }
    
    // Reduce stock quantity
    if (purchase.rows[0].product_id) {
      await client.query(
        `UPDATE non_dairy_stock 
         SET quantity = quantity - $1,
             updated_at = NOW()
         WHERE product_id = $2 AND pack_size = $3`,
        [
          purchase.rows[0].quantity,
          purchase.rows[0].product_id,
          purchase.rows[0].pack_size
        ]
      );
    }
    
    // Delete the purchase
    await client.query('DELETE FROM non_dairy_purchases WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: 'Purchase deleted successfully' 
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting purchase:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  } finally {
    client.release();
  }
};

// Get non-dairy stock summary
const getNonDairyStock = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT nds.*, p.image_url 
       FROM non_dairy_stock nds
       LEFT JOIN products p ON nds.product_id = p.id
       WHERE nds.quantity > 0
       ORDER BY nds.product_name`
    );
    
    res.json({ 
      success: true, 
      data: result.rows 
    });
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

module.exports = {
  getAllNonDairyPurchases,
  getNonDairyPurchaseById,
  createNonDairyPurchase,
  updateNonDairyPurchase,
  deleteNonDairyPurchase,
  getNonDairyStock
};