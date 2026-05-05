// src/pages/Admin/inventory/Products.jsx
import React, { useState, useEffect } from 'react';
import './Products.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';
const BASE_URL = 'https://saritha-dairy-api.onrender.com';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showToast, setShowToast] = useState({ show: false, message: '', type: '' });
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
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
      imagePreview: product.image_url ? `${BASE_URL}${product.image_url}` : ''
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
    if (n.includes('lassi')) return '🥤';
    return '📦';
  };

  const getProductColor = (name) => {
    const n = name.toLowerCase();
    if (n.includes('milk')) return { bg: '#eff6ff', text: '#3b82f6', grad: 'linear-gradient(135deg, #eff6ff, #dbeafe)' };
    if (n.includes('curd')) return { bg: '#f0fdf4', text: '#10b981', grad: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' };
    if (n.includes('paneer')) return { bg: '#fffbeb', text: '#f59e0b', grad: 'linear-gradient(135deg, #fffbeb, #fef3c7)' };
    if (n.includes('ghee')) return { bg: '#fef2f2', text: '#ef4444', grad: 'linear-gradient(135deg, #fef2f2, #fee2e2)' };
    if (n.includes('butter')) return { bg: '#faf5ff', text: '#8b5cf6', grad: 'linear-gradient(135deg, #faf5ff, #ede9fe)' };
    return { bg: '#f8fafc', text: '#64748b', grad: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' };
  };

  const formatPacks = (packs) => {
    if (!packs) return [];
    return typeof packs === 'string' ? JSON.parse(packs) : packs;
  };

  const filteredProducts = products.filter(product =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="modern-products-container">
      {/* Toast */}
      {showToast.show && (
        <div className={`modern-toast ${showToast.type}`}>
          <span>{showToast.message}</span>
          <button onClick={() => setShowToast({ show: false })}>×</button>
        </div>
      )}

      {/* Hero Header */}
      <div className="products-hero">
        <div className="hero-content">
          <div className="hero-icon">🍀</div>
          <div>
            <h1>Product Catalog</h1>
            <p>{products.length} products • Manage your dairy catalog</p>
          </div>
        </div>
        <div className="hero-actions">
          <div className="view-toggle">
            <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid View">⊞</button>
            <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="List View">☰</button>
          </div>
          <button className="add-product-btn" onClick={() => { setEditingProduct(null); resetForm(); setShowAddModal(true); }}>
            <span>+</span> Add Product
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="products-search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search products by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="search-clear" onClick={() => setSearchTerm('')}>×</button>
        )}
        <span className="search-results">{filteredProducts.length} of {products.length}</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="products-loading">
          <div className="loading-pulse">
            <span>🥛</span>
          </div>
          <p>Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="products-empty">
          <div className="empty-illustration">
            <span>📦</span>
            <div className="empty-shadow"></div>
          </div>
          <h3>{searchTerm ? 'No products match your search' : 'No products yet'}</h3>
          <p>{searchTerm ? 'Try a different search term' : 'Click "Add Product" to create your first product'}</p>
          {!searchTerm && (
            <button onClick={() => { resetForm(); setShowAddModal(true); }}>+ Add Your First Product</button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ========== GRID VIEW ========== */
        <div className="products-grid">
          {filteredProducts.map(product => {
            const packs = formatPacks(product.packs);
            const imageUrl = product.image_url ? `${BASE_URL}${product.image_url}` : null;
            const color = getProductColor(product.name);
            
            return (
              <div key={product.id} className="product-card">
                <div className="product-card-image" style={{ background: color.grad }}>
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <span className="product-card-icon">{getProductIcon(product.name)}</span>
                  )}
                  <div className="product-card-overlay">
                    <button onClick={() => handleEdit(product)} className="overlay-btn edit" title="Edit">✏️</button>
                    <button onClick={() => handleDelete(product.id, product.name)} className="overlay-btn delete" title="Delete">🗑️</button>
                  </div>
                </div>
                <div className="product-card-body">
                  <h3 className="product-card-name">{product.name}</h3>
                  <div className="product-card-packs">
                    {packs.map((pack, idx) => (
                      <div key={idx} className="pack-row">
                        <span className="pack-size">{pack.size}{pack.unit}</span>
                        <span className="pack-price">₹{pack.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========== LIST VIEW ========== */
        <div className="products-list">
          {filteredProducts.map(product => {
            const packs = formatPacks(product.packs);
            const imageUrl = product.image_url ? `${BASE_URL}${product.image_url}` : null;
            const color = getProductColor(product.name);
            
            return (
              <div key={product.id} className="product-list-item">
                <div className="list-item-image" style={{ background: color.bg }}>
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <span>{getProductIcon(product.name)}</span>
                  )}
                </div>
                <div className="list-item-info">
                  <h3>{product.name}</h3>
                  <div className="list-item-packs">
                    {packs.map((pack, idx) => (
                      <span key={idx} className="list-pack-tag">{pack.size}{pack.unit} - ₹{pack.price}</span>
                    ))}
                  </div>
                </div>
                <div className="list-item-actions">
                  <button onClick={() => handleEdit(product)} className="list-action-btn edit">✏️ Edit</button>
                  <button onClick={() => handleDelete(product.id, product.name)} className="list-action-btn delete">🗑️</button>
                </div>
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