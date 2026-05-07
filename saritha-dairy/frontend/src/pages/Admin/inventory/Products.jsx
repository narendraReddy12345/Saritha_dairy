// src/pages/Admin/inventory/Products.jsx
import React, { useState, useEffect } from 'react';
import './Products.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';
const BASE_URL = 'https://saritha-dairy-api.onrender.com';

// Helper for image URLs
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return `${BASE_URL}/${url}`;
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showToast, setShowToast] = useState({ show: false, message: '', type: '' });
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    packs: [{ size: '', price: '', unit: 'ml' }],
    image: null,
    imagePreview: ''
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const getToken = () => sessionStorage.getItem('authToken');
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${getToken()}`
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/products`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();
      if (result.success) {
        setProducts(result.data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const showMessage = (message, type = 'success') => {
    setShowToast({ show: true, message, type });
    setTimeout(() => setShowToast({ show: false, message: '', type: '' }), 3000);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showMessage('Image size should be less than 5MB', 'error');
        return;
      }
      if (!file.type.startsWith('image/')) {
        showMessage('Please select an image file', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: file, imagePreview: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePackChange = (index, field, value) => {
    const updatedPacks = [...formData.packs];
    updatedPacks[index][field] = value;
    setFormData({ ...formData, packs: updatedPacks });
  };

  const addPackSize = () => {
    setFormData({
      ...formData,
      packs: [...formData.packs, { size: '', price: '', unit: 'ml' }]
    });
  };

  const removePackSize = (index) => {
    if (formData.packs.length > 1) {
      setFormData({ ...formData, packs: formData.packs.filter((_, i) => i !== index) });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    if (!formData.name.trim()) {
      showMessage('Please enter product name', 'error');
      setSubmitting(false);
      return;
    }

    const validPacks = formData.packs.filter(p => p.size && p.price && parseFloat(p.size) > 0 && parseFloat(p.price) > 0);
    if (validPacks.length === 0) {
      showMessage('Please add at least one valid pack size with price', 'error');
      setSubmitting(false);
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('name', formData.name);
    formDataToSend.append('packs', JSON.stringify(validPacks));
    if (formData.image) {
      formDataToSend.append('image', formData.image);
    }

    try {
      const url = editingProduct 
        ? `${API_URL}/products/${editingProduct.id}`
        : `${API_URL}/products`;
      
      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { ...getAuthHeaders() },
        body: formDataToSend
      });
      
      const result = await response.json();
      
      if (result.success) {
        showMessage(editingProduct ? '✅ Product updated!' : '✅ Product added!');
        setShowAddModal(false);
        setEditingProduct(null);
        resetForm();
        fetchProducts();
      } else {
        showMessage(result.error || 'Failed to save', 'error');
      }
    } catch (error) {
      showMessage('Error saving product', 'error');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      try {
        const response = await fetch(`${API_URL}/products/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        const result = await response.json();
        if (result.success) {
          showMessage('🗑️ Product deleted!');
          fetchProducts();
        }
      } catch (error) {
        showMessage('Error deleting product', 'error');
      }
    }
  };

  const handleEdit = (product) => {
    let packs = [];
    if (product.packs) {
      packs = typeof product.packs === 'string' ? JSON.parse(product.packs) : product.packs;
    } else {
      packs = [{ size: '', price: '', unit: 'ml' }];
    }
    
    setEditingProduct(product);
    setFormData({
      name: product.name,
      packs: packs,
      image: null,
      imagePreview: getImageUrl(product.image_url)
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      packs: [{ size: '', price: '', unit: 'ml' }],
      image: null,
      imagePreview: ''
    });
  };

  const getProductIcon = (name) => {
    if (!name) return '📦';
    const n = name.toLowerCase();
    if (n.includes('milk')) return '🥛';
    if (n.includes('curd')) return '🥄';
    if (n.includes('paneer')) return '🧀';
    if (n.includes('ghee')) return '🫕';
    if (n.includes('butter')) return '🧈';
    if (n.includes('cream')) return '🍶';
    return '📦';
  };

  const filteredProducts = products.filter(product =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="products-container-modern">
      {/* Toast Notification */}
      {showToast.show && (
        <div className={`toast-notification ${showToast.type}`}>
          <span>{showToast.message}</span>
          <button onClick={() => setShowToast({ show: false })}>×</button>
        </div>
      )}

      {/* Header Section */}
      <div className="products-header">
        <div className="header-left">
          <div className="header-icon">🍶</div>
          <div className="header-text">
            <h1>Product Gallery</h1>
            <p>{products.length} products in your collection</p>
          </div>
        </div>
        <button className="add-product-button" onClick={() => { setEditingProduct(null); resetForm(); setShowAddModal(true); }}>
          <span>+</span> Add New Product
        </button>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>✕</button>
          )}
        </div>
        <div className="search-stats">
          {filteredProducts.length} of {products.length} products
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner-modern">
            <span>🥛</span>
          </div>
          <p>Loading your products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        /* Empty State */
        <div className="empty-state-modern">
          <div className="empty-illustration">
            <span>📦</span>
            <div className="empty-glow"></div>
          </div>
          <h3>{searchTerm ? 'No products found' : 'Your gallery is empty'}</h3>
          <p>{searchTerm ? `No results for "${searchTerm}"` : 'Start by adding your first product'}</p>
          {!searchTerm && (
            <button className="empty-add-btn" onClick={() => { resetForm(); setShowAddModal(true); }}>
              + Add Your First Product
            </button>
          )}
        </div>
      ) : (
        /* Product Grid - With Top-Right Action Buttons */
        <div className="product-gallery">
          {filteredProducts.map(product => {
            const imageUrl = getImageUrl(product.image_url);
            
            return (
              <div key={product.id} className="product-card-simple">
                {/* Product Image with Overlay Actions */}
                <div className="card-image-wrapper">
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={product.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.querySelector('.image-placeholder').style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="image-placeholder" style={{ display: imageUrl ? 'none' : 'flex' }}>
                    <span>{getProductIcon(product.name)}</span>
                  </div>
                  
                  {/* Action Buttons - Top Right Corner */}
                  <div className="card-actions-overlay">
                    <button 
                      className="action-btn-overlay edit-btn-overlay" 
                      onClick={() => handleEdit(product)}
                      title="Edit Product"
                    >
                      ✏️
                    </button>
                    <button 
                      className="action-btn-overlay delete-btn-overlay" 
                      onClick={() => handleDelete(product.id, product.name)}
                      title="Delete Product"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Product Name */}
                <div className="card-info">
                  <h3 className="product-name">{product.name}</h3>
                </div>

                {/* Hover Glow Effect */}
                <div className="card-glow"></div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditingProduct(null); }}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? '✏️ Edit Product' : '✨ Add New Product'}</h2>
              <button className="modal-close" onClick={() => { setShowAddModal(false); setEditingProduct(null); }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {/* Product Name */}
              <div className="form-group">
                <label>🏷️ Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="e.g., Fresh Milk, Cream, Paneer"
                  autoFocus
                />
              </div>

              {/* Pack Sizes */}
              <div className="form-group">
                <label>📦 Pack Sizes & Prices *</label>
                <div className="packs-container">
                  {formData.packs.map((pack, index) => (
                    <div key={index} className="pack-input-row">
                      <input type="number" placeholder="Size" value={pack.size}
                        onChange={(e) => handlePackChange(index, 'size', e.target.value)} />
                      <select value={pack.unit}
                        onChange={(e) => handlePackChange(index, 'unit', e.target.value)}>
                        <option value="ml">ml</option>
                        <option value="L">L</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                      </select>
                      <span className="pack-currency">₹</span>
                      <input type="number" placeholder="Price" value={pack.price}
                        onChange={(e) => handlePackChange(index, 'price', e.target.value)} />
                      {formData.packs.length > 1 && (
                        <button type="button" className="pack-remove-btn" onClick={() => removePackSize(index)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" className="add-pack-btn" onClick={addPackSize}>
                  + Add Another Size
                </button>
              </div>

              {/* Image Upload */}
              <div className="form-group">
                <label>🖼️ Product Image</label>
                
                {formData.imagePreview ? (
                  <div className="image-preview-container">
                    <img src={formData.imagePreview} alt="Preview" />
                    <button type="button" className="image-remove-btn" onClick={() => setFormData({...formData, image: null, imagePreview: ''})}>
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <label className="image-upload-zone">
                    <div className="upload-icon">📷</div>
                    <div className="upload-text">Click to upload image</div>
                    <div className="upload-hint">PNG, JPG up to 5MB</div>
                    <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                  </label>
                )}
              </div>

              {/* Buttons */}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => { setShowAddModal(false); setEditingProduct(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-save" disabled={submitting}>
                  {submitting ? '⏳ Saving...' : editingProduct ? '💾 Update Product' : '✅ Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;