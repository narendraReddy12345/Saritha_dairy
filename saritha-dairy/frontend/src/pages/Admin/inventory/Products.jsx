// src/pages/Admin/inventory/Products.jsx
import React, { useState, useEffect } from 'react';
import './Products.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
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

  // Get auth token
  const getToken = () => sessionStorage.getItem('authToken');

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${getToken()}`
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // ✅ FIXED: Removed extra /api
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

    // ✅ Use FormData for image upload
    const formDataToSend = new FormData();
    formDataToSend.append('name', formData.name);
    formDataToSend.append('packs', JSON.stringify(validPacks));
    if (formData.image) {
      formDataToSend.append('image', formData.image);
    }

    try {
      // ✅ FIXED: Removed extra /api
      const url = editingProduct 
        ? `${API_URL}/products/${editingProduct.id}`
        : `${API_URL}/products`;
      
      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: {
          ...getAuthHeaders()  // Only auth header, no Content-Type for FormData
        },
        body: formDataToSend
      });
      
      const result = await response.json();
      
      if (result.success) {
        showMessage(editingProduct ? 'Product updated!' : 'Product added!');
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
    if (window.confirm(`Delete "${name}"?`)) {
      try {
        // ✅ FIXED: Removed extra /api
        const response = await fetch(`${API_URL}/products/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          }
        });
        const result = await response.json();
        if (result.success) {
          showMessage('Product deleted!');
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
      imagePreview: product.image_url ? `${API_URL}${product.image_url}` : ''
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

  const formatPacks = (packs) => {
    if (!packs) return [];
    return typeof packs === 'string' ? JSON.parse(packs) : packs;
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="saritha-products" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Toast */}
      {showToast.show && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 3000,
          padding: '14px 20px', borderRadius: '10px', color: 'white',
          background: showToast.type === 'success' ? '#4caf50' : '#ef4444',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.2)', fontWeight: 500
        }}>
          <span>{showToast.message}</span>
          <button onClick={() => setShowToast({ show: false })} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '2px 8px', borderRadius: '50%' }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a472a, #2d6a4f)',
        color: 'white', padding: '24px 28px', borderRadius: '16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px', flexWrap: 'wrap', gap: '12px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>🍀 Our Products</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '14px' }}>Manage your dairy products catalog</p>
        </div>
        <button onClick={() => { setEditingProduct(null); resetForm(); setShowAddModal(true); }}
          style={{
            padding: '12px 24px', background: '#4caf50', color: 'white',
            border: 'none', borderRadius: '10px', cursor: 'pointer',
            fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap'
          }}>
          + Add New Product
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%', padding: '14px 14px 14px 42px',
            border: '2px solid #e0e0e0', borderRadius: '12px',
            fontSize: '14px', background: 'white'
          }}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: '#eee', border: 'none', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer' }}>
            ×
          </button>
        )}
      </div>

      {/* Products Grid with Images */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🥛</div>
          <p>Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#666', background: 'white', borderRadius: '16px' }}>
          <div style={{ fontSize: '50px', marginBottom: '12px' }}>📦</div>
          <h3>No products found</h3>
          <p>{searchTerm ? 'Try a different search' : 'Add your first product'}</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '20px'
        }}>
          {filteredProducts.map(product => {
            const packs = formatPacks(product.packs);
            const imageUrl = product.image_url ? `${API_URL}${product.image_url}` : null;
            
            return (
              <div key={product.id} style={{
                background: 'white',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                border: '1px solid #eee',
                transition: 'all 0.2s'
              }}>
                {/* Product Image */}
                <div style={{
                  width: '100%',
                  height: '200px',
                  overflow: 'hidden',
                  position: 'relative',
                  background: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `<div style="font-size:60px">${getProductIcon(product.name)}</div>`;
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: '60px' }}>{getProductIcon(product.name)}</div>
                  )}
                  
                  {/* Action Buttons Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    display: 'flex',
                    gap: '6px',
                    opacity: 0.85
                  }}>
                    <button onClick={() => handleEdit(product)}
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: '#2196f3', color: 'white', border: 'none',
                        cursor: 'pointer', fontSize: '16px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
                      }} title="Edit">✏️</button>
                    <button onClick={() => handleDelete(product.id, product.name)}
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: '#f44336', color: 'white', border: 'none',
                        cursor: 'pointer', fontSize: '16px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
                      }} title="Delete">🗑️</button>
                  </div>
                </div>

                {/* Product Info */}
                <div style={{ padding: '16px' }}>
                  <h3 style={{ margin: '0 0 12px', color: '#1a472a', fontSize: '18px', textAlign: 'center' }}>
                    {product.name}
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {packs.map((pack, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#f0fdf4',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}>
                        <span style={{ fontWeight: 500, color: '#333' }}>
                          {pack.size}{pack.unit}
                        </span>
                        <span style={{ fontWeight: 700, color: '#4caf50' }}>
                          ₹{pack.price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal with Image Upload */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }} onClick={() => { setShowAddModal(false); setEditingProduct(null); }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '550px', maxHeight: '85vh', overflow: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, color: '#1a472a', fontSize: '20px' }}>
                {editingProduct ? '✏️ Edit Product' : '✨ Add New Product'}
              </h2>
              <button onClick={() => { setShowAddModal(false); setEditingProduct(null); }}
                style={{ background: '#f0f0f0', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Product Name */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#444', fontSize: '14px' }}>
                  🏷️ Product Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="e.g., Fresh Milk, Cream, Paneer"
                  style={{
                    width: '100%', padding: '12px', border: '2px solid #e0e0e0',
                    borderRadius: '10px', fontSize: '14px'
                  }}
                />
              </div>

              {/* Pack Sizes */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#444', fontSize: '14px' }}>
                  📦 Pack Sizes & Prices *
                </label>
                {formData.packs.map((pack, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input type="number" placeholder="Size" value={pack.size}
                      onChange={(e) => handlePackChange(index, 'size', e.target.value)}
                      style={{ flex: 1, padding: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} />
                    <select value={pack.unit}
                      onChange={(e) => handlePackChange(index, 'unit', e.target.value)}
                      style={{ padding: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }}>
                      <option value="ml">ml</option>
                      <option value="L">L</option>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                    </select>
                    <span style={{ fontWeight: 600 }}>₹</span>
                    <input type="number" placeholder="Price" value={pack.price}
                      onChange={(e) => handlePackChange(index, 'price', e.target.value)}
                      style={{ flex: 1, padding: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} />
                    {formData.packs.length > 1 && (
                      <button type="button" onClick={() => removePackSize(index)}
                        style={{ background: '#ffebee', border: 'none', color: '#c62828', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addPackSize}
                  style={{
                    width: '100%', padding: '10px', background: 'none',
                    border: '2px dashed #4caf50', color: '#4caf50',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px'
                  }}>+ Add Another Size</button>
              </div>

              {/* ✅ Image Upload Section */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#444', fontSize: '14px' }}>
                  🖼️ Product Image
                </label>
                
                {formData.imagePreview ? (
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' }}>
                    <img
                      src={formData.imagePreview}
                      alt="Preview"
                      style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '12px' }}
                    />
                    <button type="button" onClick={() => setFormData({...formData, image: null, imagePreview: ''})}
                      style={{
                        position: 'absolute', top: '10px', right: '10px',
                        background: '#f44336', color: 'white', border: 'none',
                        padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                        fontWeight: 600, fontSize: '12px'
                      }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '40px',
                    border: '2px dashed #e0e0e0', borderRadius: '12px',
                    cursor: 'pointer', background: '#fafafa', transition: 'all 0.2s'
                  }}>
                    <div style={{ fontSize: '40px', marginBottom: '8px' }}>📷</div>
                    <div style={{ fontWeight: 600, color: '#666', fontSize: '14px' }}>Click to upload image</div>
                    <div style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>PNG, JPG up to 5MB</div>
                    <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                  </label>
                )}
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => { setShowAddModal(false); setEditingProduct(null); }}
                  style={{
                    flex: 1, padding: '14px', background: '#f0f0f0', border: 'none',
                    borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: '#666'
                  }}>Cancel</button>
                <button type="submit" disabled={submitting}
                  style={{
                    flex: 1, padding: '14px', background: '#4caf50', color: 'white',
                    border: 'none', borderRadius: '10px', cursor: 'pointer',
                    fontWeight: 700, fontSize: '14px', opacity: submitting ? 0.7 : 1
                  }}>
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