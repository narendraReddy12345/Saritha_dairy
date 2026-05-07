// controllers/productController.js
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
  const { name, packs, product_type, is_non_dairy } = req.body;
  
  // Determine product type from request
  let finalProductType = product_type || 'dairy';
  let finalIsNonDairy = is_non_dairy === 'true' || finalProductType === 'non-dairy';
  
  // Get image URL
  let image_url = null;
  if (req.file) {
    image_url = req.file.path || `/uploads/${req.file.filename}`;
  }
  
  console.log('📸 Creating product:', { name, product_type: finalProductType, is_non_dairy: finalIsNonDairy, packs });
  
  try {
    const result = await pool.query(
      `INSERT INTO products (name, packs, image_url, product_type, is_non_dairy) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, packs, image_url, finalProductType, finalIsNonDairy]
    );
    
    console.log('✅ Product created:', result.rows[0].id, 'Type:', finalProductType);
    res.json({ success: true, data: result.rows[0], message: `${name} added!` });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update product
exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, packs, product_type, is_non_dairy } = req.body;
  
  // Determine product type
  let finalProductType = product_type || 'dairy';
  let finalIsNonDairy = is_non_dairy === 'true' || finalProductType === 'non-dairy';
  
  try {
    let image_url = null;
    
    if (req.file) {
      image_url = req.file.path || `/uploads/${req.file.filename}`;
      console.log('📸 New image:', image_url);
    }
    
    let query, params;
    if (image_url) {
      query = `UPDATE products 
               SET name=$1, packs=$2, image_url=$3, product_type=$4, is_non_dairy=$5 
               WHERE id=$6 RETURNING *`;
      params = [name, packs, image_url, finalProductType, finalIsNonDairy, id];
    } else {
      query = `UPDATE products 
               SET name=$1, packs=$2, product_type=$3, is_non_dairy=$4 
               WHERE id=$5 RETURNING *`;
      params = [name, packs, finalProductType, finalIsNonDairy, id];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    console.log('✅ Product updated:', result.rows[0].id, 'Type:', finalProductType);
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
    
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    
    console.log('✅ Product deleted:', product.rows[0].name);
    res.json({ success: true, message: `${product.rows[0].name} deleted!` });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};