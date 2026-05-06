const pool = require('../config/db');

// ✅ Try to set up Cloudinary, fallback to local if not available
let cloudinary = null;
let CloudinaryStorage = null;
let upload = null;

try {
  cloudinary = require('cloudinary').v2;
  CloudinaryStorage = require('multer-storage-cloudinary').CloudinaryStorage;
  
  cloudinary.config({
    cloud_name: 'dmu3tqxgb',
    api_key: process.env.CLOUDINARY_API_KEY || '342286483387765',
    api_secret: process.env.CLOUDINARY_API_SECRET || '4xcgwRnRM3m6VJHXupnXzummQaU'
  });
  
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'saritha_dairy_products',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    }
  });
  
  const multer = require('multer');
  upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
  console.log('✅ Cloudinary configured successfully');
} catch (error) {
  console.log('⚠️ Cloudinary not available, using local storage:', error.message);
  
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');
  
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
  });
  
  upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
}

// ✅ Export multer middleware
exports.uploadImage = (req, res, next) => {
  if (!upload) {
    return res.status(500).json({ success: false, error: 'Upload not configured' });
  }
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('❌ Upload error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

// Get all products
exports.getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY name');
    console.log(`📦 Fetched ${result.rows.length} products`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create product
exports.create = async (req, res) => {
  const { name, packs, productType, isNonDairy, quantity, costPrice } = req.body;
  
  let image_url = null;
  if (req.file) {
    image_url = req.file.path || `/uploads/${req.file.filename}`;
  }
  
  console.log('📸 Creating product:', { name, productType, isNonDairy, quantity, image_url });
  
  try {
    const isNonDairyProduct = productType === 'non-dairy' || isNonDairy === 'true';
    
    const result = await pool.query(
      `INSERT INTO products (name, packs, image_url, product_type, is_non_dairy) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, packs, image_url, isNonDairyProduct ? 'non-dairy' : 'dairy', isNonDairyProduct]
    );
    
    // ✅ For non-dairy products, add directly to store_stock
    if (isNonDairyProduct && quantity && parseInt(quantity) > 0) {
      const packsData = typeof packs === 'string' ? JSON.parse(packs) : packs;
      const sellingPrice = packsData[0]?.price || 0;
      const stockId = `${name.replace(/\s/g, '')}-${Date.now()}`;
      
      await pool.query(
        `INSERT INTO store_stock (barcode, product_name, pack_size_display, selling_price, quantity, unit, packed_date)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
        [stockId, name, '1 piece', sellingPrice, parseInt(quantity), 'piece']
      );
      
      console.log(`✅ Non-dairy product added to store_stock: ${name} x${quantity}`);
    }
    
    console.log('✅ Product created:', result.rows[0].id);
    res.json({ success: true, data: result.rows[0], message: `${name} added!` });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update product
exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, packs, productType, isNonDairy, quantity, costPrice } = req.body;
  
  try {
    let image_url = null;
    
    if (req.file) {
      image_url = req.file.path || `/uploads/${req.file.filename}`;
      console.log('📸 New image:', image_url);
    }
    
    const isNonDairyProduct = productType === 'non-dairy' || isNonDairy === 'true';
    
    let query, params;
    if (image_url) {
      query = `UPDATE products SET name=$1, packs=$2, image_url=$3, product_type=$4, is_non_dairy=$5 WHERE id=$6 RETURNING *`;
      params = [name, packs, image_url, isNonDairyProduct ? 'non-dairy' : 'dairy', isNonDairyProduct, id];
    } else {
      query = `UPDATE products SET name=$1, packs=$2, product_type=$3, is_non_dairy=$4 WHERE id=$5 RETURNING *`;
      params = [name, packs, isNonDairyProduct ? 'non-dairy' : 'dairy', isNonDairyProduct, id];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    // ✅ Update store_stock for non-dairy products
    if (isNonDairyProduct && quantity && parseInt(quantity) > 0) {
      const packsData = typeof packs === 'string' ? JSON.parse(packs) : packs;
      const sellingPrice = packsData[0]?.price || 0;
      
      // Check if already in store_stock
      const stockCheck = await pool.query(
        'SELECT id FROM store_stock WHERE product_name = $1 AND pack_size_display = $2',
        [name, '1 piece']
      );
      
      if (stockCheck.rows.length > 0) {
        await pool.query(
          'UPDATE store_stock SET selling_price = $1, quantity = $2 WHERE product_name = $3 AND pack_size_display = $4',
          [sellingPrice, parseInt(quantity), name, '1 piece']
        );
      } else {
        const stockId = `${name.replace(/\s/g, '')}-${Date.now()}`;
        await pool.query(
          `INSERT INTO store_stock (barcode, product_name, pack_size_display, selling_price, quantity, unit, packed_date)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)`,
          [stockId, name, '1 piece', sellingPrice, parseInt(quantity), 'piece']
        );
      }
      
      console.log(`✅ Non-dairy stock updated: ${name} x${quantity}`);
    }
    
    console.log('✅ Product updated:', result.rows[0].id);
    res.json({ success: true, data: result.rows[0], message: `${name} updated!` });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete product
exports.remove = async (req, res) => {
  const { id } = req.params;
  
  try {
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    
    if (product.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    // ✅ Also remove from store_stock if it exists there
    await pool.query('DELETE FROM store_stock WHERE product_name = $1', [product.rows[0].name]);
    
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    
    console.log('✅ Product deleted:', product.rows[0].name);
    res.json({ success: true, message: `${product.rows[0].name} deleted!` });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};