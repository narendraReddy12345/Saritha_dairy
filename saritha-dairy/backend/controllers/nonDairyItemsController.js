// controllers/nonDairyItemsController.js
const pool = require('../config/db');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dmu3tqxgb',
  api_key: process.env.CLOUDINARY_API_KEY || '342286483387765',
  api_secret: process.env.CLOUDINARY_API_SECRET || '4xcgwRnRM3m6VJHXupnXzummQaU'
});

// Use memory storage for multer (to upload directly to cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.mimetype);
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Helper function to upload to Cloudinary
const uploadToCloudinary = (fileBuffer, folder = 'non-dairy-products') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        transformation: [
          { width: 500, height: 500, crop: 'limit' },
          { quality: 'auto' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    
    const readableStream = new Readable();
    readableStream.push(fileBuffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

// Middleware for image upload
exports.uploadImage = upload.single('image');

// Get all non-dairy items
exports.getAllItems = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM non_dairy_items ORDER BY name'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching non-dairy items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add new non-dairy product with Cloudinary image
exports.addProduct = async (req, res) => {
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);
  
  const { name, packSize, packUnit, sellingPrice, quantity } = req.body;
  
  // Validate required fields
  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'Product name is required' });
  }
  
  if (!sellingPrice || sellingPrice <= 0) {
    return res.status(400).json({ success: false, error: 'Valid selling price is required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    let image_url = null;
    
    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'non-dairy-products');
        image_url = cloudinaryResult.secure_url;
        console.log('✅ Image uploaded to Cloudinary:', image_url);
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({ success: false, error: 'Failed to upload image' });
      }
    }
    
    const result = await client.query(
      `INSERT INTO non_dairy_items 
       (name, pack_size, pack_unit, selling_price, quantity, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [name.trim(), packSize || '1', packUnit || 'piece', sellingPrice, quantity || 0, image_url]
    );
    
    await client.query('COMMIT');
    
    console.log('✅ Product added:', result.rows[0]);
    res.json({ success: true, data: result.rows[0], message: `${name} added successfully!` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding product:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// Purchase additional stock
exports.addStock = async (req, res) => {
  const { productId, quantity, purchasePrice, supplier, invoiceNumber, notes } = req.body;
  
  if (!productId || !quantity || !purchasePrice) {
    return res.status(400).json({ success: false, error: 'Product ID, quantity, and purchase price are required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get current product
    const product = await client.query('SELECT * FROM non_dairy_items WHERE id = $1', [productId]);
    
    if (product.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    const currentProduct = product.rows[0];
    const newQuantity = (currentProduct.quantity || 0) + parseInt(quantity);
    const totalCost = purchasePrice * quantity;
    
    // Calculate weighted average purchase price
    const currentTotalValue = (currentProduct.purchase_price || 0) * (currentProduct.quantity || 0);
    const newTotalValue = currentTotalValue + (purchasePrice * quantity);
    const newAvgPurchasePrice = newTotalValue / newQuantity;
    
    // Update product
    await client.query(
      `UPDATE non_dairy_items 
       SET quantity = $1, 
           purchase_price = $2,
           updated_at = NOW() 
       WHERE id = $3`,
      [newQuantity, newAvgPurchasePrice, productId]
    );
    
    // Record purchase history
    await client.query(
      `INSERT INTO non_dairy_purchase_history 
       (product_id, product_name, quantity, purchase_price, total_cost, supplier, invoice_number, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [productId, currentProduct.name, quantity, purchasePrice, totalCost, supplier, invoiceNumber, notes]
    );
    
    await client.query('COMMIT');
    
    const updatedProduct = await client.query('SELECT * FROM non_dairy_items WHERE id = $1', [productId]);
    
    res.json({ success: true, data: updatedProduct.rows[0], message: `Added ${quantity} units to ${currentProduct.name}` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding stock:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, sellingPrice, packSize, packUnit } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE non_dairy_items 
       SET name = COALESCE($1, name),
           selling_price = COALESCE($2, selling_price),
           pack_size = COALESCE($3, pack_size),
           pack_unit = COALESCE($4, pack_unit),
           updated_at = NOW()
       WHERE id = $5 
       RETURNING *`,
      [name, sellingPrice, packSize, packUnit, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    res.json({ success: true, data: result.rows[0], message: 'Product updated!' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const product = await client.query('SELECT name, image_url FROM non_dairy_items WHERE id = $1', [id]);
    
    if (product.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    // Delete image from Cloudinary if exists
    const imageUrl = product.rows[0].image_url;
    if (imageUrl && imageUrl.includes('cloudinary')) {
      try {
        // Extract public ID from Cloudinary URL
        const parts = imageUrl.split('/');
        const filename = parts[parts.length - 1].split('.')[0];
        const publicId = `non-dairy-products/${filename}`;
        await cloudinary.uploader.destroy(publicId);
        console.log('✅ Image deleted from Cloudinary');
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
      }
    }
    
    await client.query('DELETE FROM non_dairy_purchase_history WHERE product_id = $1', [id]);
    await client.query('DELETE FROM non_dairy_items WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    res.json({ success: true, message: `${product.rows[0].name} deleted!` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

// Get purchase history
exports.getPurchaseHistory = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM non_dairy_purchase_history ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete single purchase history record
exports.deletePurchaseRecord = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const record = await client.query('SELECT * FROM non_dairy_purchase_history WHERE id = $1', [id]);
    
    if (record.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    
    const purchase = record.rows[0];
    
    // Update product stock
    await client.query(
      'UPDATE non_dairy_items SET quantity = quantity - $1 WHERE id = $2',
      [purchase.quantity, purchase.product_id]
    );
    
    await client.query('DELETE FROM non_dairy_purchase_history WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    res.json({ success: true, message: 'Record deleted and stock updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting record:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};