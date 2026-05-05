const pool = require('../config/db');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: 'dzuixvh7w',
  api_key: process.env.CLOUDINARY_API_KEY || '518573852955247',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'YOUR_API_SECRET'
});

// ✅ Cloudinary storage - stores FULL images clearly
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'saritha_dairy_products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { 
        width: 600,           // ✅ Fixed width
        height: 600,          // ✅ Fixed height
        crop: 'fit',          // ✅ FIT mode - shows full image, no cropping
        quality: 'auto:best', // ✅ Best quality
        fetch_format: 'auto',
        background: 'auto'    // ✅ Auto background for transparent images
      }
    ]
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // ✅ Increased to 10MB for high quality
});

// ✅ Export multer middleware
exports.uploadImage = upload.single('image');

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
  const { name, packs } = req.body;
  
  // ✅ Image URL from Cloudinary (permanent URL)
  const image_url = req.file ? req.file.path : null;
  
  console.log('📸 Creating product:', { name, image_url });
  
  try {
    const result = await pool.query(
      'INSERT INTO products (name, packs, image_url) VALUES ($1, $2, $3) RETURNING *',
      [name, packs, image_url]
    );
    
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
  const { name, packs } = req.body;
  
  try {
    let image_url;
    
    if (req.file) {
      // ✅ New image uploaded to Cloudinary
      image_url = req.file.path;
      console.log('📸 New image:', image_url);
      
      // Delete old image from Cloudinary if exists
      const oldProduct = await pool.query('SELECT image_url FROM products WHERE id = $1', [id]);
      if (oldProduct.rows[0]?.image_url && oldProduct.rows[0].image_url.includes('cloudinary')) {
        try {
          const urlParts = oldProduct.rows[0].image_url.split('/');
          const filename = urlParts[urlParts.length - 1].split('.')[0];
          const publicId = `saritha_dairy_products/${filename}`;
          await cloudinary.uploader.destroy(publicId);
          console.log('🗑️ Old image deleted from Cloudinary');
        } catch (e) { 
          console.log('Old image cleanup failed:', e.message); 
        }
      }
    }
    
    let query, params;
    if (image_url) {
      query = 'UPDATE products SET name=$1, packs=$2, image_url=$3 WHERE id=$4 RETURNING *';
      params = [name, packs, image_url, id];
    } else {
      query = 'UPDATE products SET name=$1, packs=$2 WHERE id=$3 RETURNING *';
      params = [name, packs, id];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
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
    
    // Delete image from Cloudinary
    if (product.rows[0].image_url && product.rows[0].image_url.includes('cloudinary')) {
      try {
        const urlParts = product.rows[0].image_url.split('/');
        const filename = urlParts[urlParts.length - 1].split('.')[0];
        const publicId = `saritha_dairy_products/${filename}`;
        await cloudinary.uploader.destroy(publicId);
        console.log('🗑️ Image deleted from Cloudinary');
      } catch (e) { 
        console.log('Image cleanup failed:', e.message); 
      }
    }
    
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    
    console.log('✅ Product deleted:', product.rows[0].name);
    res.json({ success: true, message: `${product.rows[0].name} deleted!` });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};