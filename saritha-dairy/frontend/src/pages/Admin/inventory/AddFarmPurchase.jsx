// src/pages/Admin/inventory/AddFarmPurchase.jsx
import React, { useState, useEffect } from 'react';
import './AddPurchase.css';

const API_URL = 'http://localhost:5000/api';

const AddPurchase = () => {
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('add');
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState(null);

  const [formData, setFormData] = useState({
    productName: '',
    quantity: '',
    unit: 'Litre',
    pricePerUnit: '',
    supplier: '',
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    fetchProducts();
    fetchPurchases();
  }, []);

  // Get auth token
  const getToken = () => sessionStorage.getItem('authToken');

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/products`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();
      if (result.success) {
        setProducts(result.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchPurchases = async () => {
    try {
      const response = await fetch(`${API_URL}/farm-purchases`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();
      if (result.success) setPurchases(result.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getProductIcon = (productName) => {
    if (!productName) return '📦';
    const n = productName.toLowerCase();
    if (n.includes('milk')) return '🥛';
    if (n.includes('curd')) return '🥄';
    if (n.includes('paneer')) return '🧀';
    if (n.includes('ghee')) return '🫕';
    if (n.includes('butter')) return '🧈';
    return '📦';
  };

  const getProductColor = (productName) => {
    if (!productName) return '#64748b';
    const n = productName.toLowerCase();
    if (n.includes('milk')) return '#3b82f6';
    if (n.includes('curd')) return '#10b981';
    if (n.includes('paneer')) return '#f59e0b';
    if (n.includes('ghee')) return '#ef4444';
    if (n.includes('butter')) return '#8b5cf6';
    return '#64748b';
  };

  const getProductBgLight = (productName) => {
    if (!productName) return '#f8fafc';
    const n = productName.toLowerCase();
    if (n.includes('milk')) return '#eff6ff';
    if (n.includes('curd')) return '#f0fdf4';
    if (n.includes('paneer')) return '#fffbeb';
    if (n.includes('ghee')) return '#fef2f2';
    if (n.includes('butter')) return '#faf5ff';
    return '#f8fafc';
  };

  const handleQuantityChange = (e) => {
    const qty = parseFloat(e.target.value) || 0;
    const price = parseFloat(formData.pricePerUnit) || 0;
    setFormData({ ...formData, quantity: e.target.value });
    setTotalCost(qty * price);
  };

  const handlePriceChange = (e) => {
    const price = parseFloat(e.target.value) || 0;
    const qty = parseFloat(formData.quantity) || 0;
    setFormData({ ...formData, pricePerUnit: e.target.value });
    setTotalCost(qty * price);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProductSelect = (e) => {
    setFormData({ ...formData, productName: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.productName || !formData.quantity || !formData.pricePerUnit) {
      showMessage('Please fill all required fields', 'error');
      return;
    }

    setLoading(true);
    const purchaseData = {
      productName: formData.productName,
      quantity: parseFloat(formData.quantity),
      unit: formData.unit,
      pricePerUnit: parseFloat(formData.pricePerUnit),
      totalCost: totalCost,
      farmName: formData.supplier,
      invoiceNumber: formData.invoiceNumber,
      purchaseDate: formData.date,
      notes: formData.notes
    };

    try {
      const response = await fetch(`${API_URL}/farm-purchases`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(purchaseData)
      });
      const result = await response.json();
      if (result.success) {
        showMessage('✅ Purchase saved successfully!');
        setFormData({
          productName: '', quantity: '', unit: 'Litre', pricePerUnit: '',
          supplier: '', invoiceNumber: '', date: new Date().toISOString().split('T')[0], notes: ''
        });
        setTotalCost(0);
        fetchPurchases();
      } else {
        showMessage('❌ ' + (result.error || 'Error saving purchase'), 'error');
      }
    } catch (error) {
      showMessage('❌ ' + error.message, 'error');
    }
    setLoading(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!formData.productName || !formData.quantity || !formData.pricePerUnit) {
      showMessage('Please fill all fields', 'error');
      return;
    }

    setLoading(true);
    const updateData = {
      productName: formData.productName,
      quantity: parseFloat(formData.quantity),
      unit: formData.unit,
      pricePerUnit: parseFloat(formData.pricePerUnit),
      totalCost: totalCost,
      farmName: formData.supplier,
      invoiceNumber: formData.invoiceNumber,
      purchaseDate: formData.date,
      notes: formData.notes
    };

    try {
      const response = await fetch(`${API_URL}/farm-purchases/${editingId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData)
      });
      const result = await response.json();
      if (result.success) {
        showMessage('✅ Purchase updated!');
        cancelEdit();
        fetchPurchases();
      } else {
        showMessage('❌ ' + (result.error || 'Error updating'), 'error');
      }
    } catch (error) {
      showMessage('❌ ' + error.message, 'error');
    }
    setLoading(false);
  };

  const handleDelete = async (id, productName) => {
    if (window.confirm(`Delete ${productName} purchase?`)) {
      try {
        const response = await fetch(`${API_URL}/farm-purchases/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const result = await response.json();
        if (result.success) {
          showMessage('✅ Purchase deleted');
          fetchPurchases();
        } else {
          showMessage('❌ Error deleting', 'error');
        }
      } catch (error) {
        showMessage('❌ ' + error.message, 'error');
      }
    }
  };

  const handleEdit = (purchase) => {
    setEditingId(purchase.id);
    setActiveTab('add');
    setFormData({
      productName: purchase.product_name,
      quantity: purchase.quantity,
      unit: purchase.unit || 'Litre',
      pricePerUnit: purchase.price_per_unit,
      supplier: purchase.farm_name || '',
      invoiceNumber: purchase.invoice_number || '',
      date: purchase.purchase_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      notes: purchase.notes || ''
    });
    setTotalCost(purchase.quantity * purchase.price_per_unit);
    setTimeout(() => {
      document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      productName: '', quantity: '', unit: 'Litre', pricePerUnit: '',
      supplier: '', invoiceNumber: '', date: new Date().toISOString().split('T')[0], notes: ''
    });
    setTotalCost(0);
  };

  const filteredPurchases = purchases.filter(purchase =>
    purchase.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.farm_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = purchases.reduce((sum, p) => sum + (parseFloat(p.total_cost) || 0), 0);
  const totalQuantity = purchases.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);

  return (
    <div className="purchase-tabs-container">
      {/* Toast Notification */}
      {message && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 3000,
          padding: '14px 20px', borderRadius: '10px', color: 'white',
          background: message.type === 'success' ? '#4caf50' : '#ef4444',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.2)', fontWeight: 500,
          animation: 'slideInRight 0.3s ease'
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
            cursor: 'pointer', padding: '2px 8px', borderRadius: '50%', fontSize: '16px'
          }}>×</button>
        </div>
      )}

      <div className="tabs-header">
        <h1>📦 Purchase Management</h1>
        <p>Manage your farm purchases efficiently</p>
      </div>

      <div className="stats-tabs">
        <div className="stat-card-tab">
          <div className="stat-icon-tab">📋</div>
          <div className="stat-info-tab">
            <span className="stat-value-tab">{purchases.length}</span>
            <span className="stat-label-tab">Total Purchases</span>
          </div>
        </div>
        <div className="stat-card-tab">
          <div className="stat-icon-tab">📦</div>
          <div className="stat-info-tab">
            <span className="stat-value-tab">{Number(totalQuantity).toFixed(0)}</span>
            <span className="stat-label-tab">Total Quantity</span>
          </div>
        </div>
        <div className="stat-card-tab">
          <div className="stat-icon-tab">💰</div>
          <div className="stat-info-tab">
            <span className="stat-value-tab">₹{Number(totalAmount).toLocaleString()}</span>
            <span className="stat-label-tab">Total Spent</span>
          </div>
        </div>
      </div>

      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => { setActiveTab('add'); cancelEdit(); }}
        >
          <span className="tab-icon">➕</span>
          Add New Purchase
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="tab-icon">📋</span>
          Purchase History
          <span className="tab-count">{purchases.length}</span>
        </button>
      </div>

      {activeTab === 'add' && (
        <div className="tab-content">
          <div className="form-card-tab">
            <div className="form-header-tab">
              <h2>{editingId ? '✏️ Edit Purchase' : '➕ Add New Purchase'}</h2>
              {editingId && <span className="edit-badge-tab">Editing Mode</span>}
            </div>

            <form id="form-section" onSubmit={editingId ? handleUpdate : handleSubmit}>
              <div className="form-grid-tab">
                <div className="input-group-tab">
                  <label>Product <span className="required">*</span></label>
                  <select value={formData.productName} onChange={handleProductSelect} required>
                    <option value="">-- Select Product --</option>
                    {products.map((p, i) => (
                      <option key={i} value={p.name}>
                        {getProductIcon(p.name)} {p.name} 
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group-tab">
                  <label>Quantity <span className="required">*</span></label>
                  <input type="number" name="quantity" value={formData.quantity} onChange={handleQuantityChange} step="0.01" placeholder="0.00" required />
                </div>

                <div className="input-group-tab">
                  <label>Unit</label>
                  <select name="unit" value={formData.unit} onChange={handleChange}>
                    <option value="Litre">Litre</option>
                    <option value="Kg">Kg</option>
                    <option value="Gram">Gram</option>
                    <option value="Piece">Piece</option>
                  </select>
                </div>

                <div className="input-group-tab">
                  <label>Price/Unit (₹) <span className="required">*</span></label>
                  <input type="number" name="pricePerUnit" value={formData.pricePerUnit} onChange={handlePriceChange} step="0.01" placeholder="0.00" required />
                </div>

                <div className="input-group-tab total-field-tab">
                  <label>Total Cost</label>
                  <div className="total-value-tab">₹{Number(totalCost).toLocaleString()}</div>
                </div>

                <div className="input-group-tab">
                  <label>Supplier</label>
                  <input type="text" name="supplier" value={formData.supplier} onChange={handleChange} placeholder="Farm name" />
                </div>

                <div className="input-group-tab">
                  <label>Invoice No</label>
                  <input type="text" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} placeholder="Bill number" />
                </div>

                <div className="input-group-tab">
                  <label>Date</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange} required />
                </div>

                <div className="input-group-tab full-width-tab">
                  <label>Notes</label>
                  <input type="text" name="notes" value={formData.notes} onChange={handleChange} placeholder="Additional notes..." />
                </div>
              </div>

              <div className="form-actions-tab">
                {editingId && <button type="button" className="btn-cancel-tab" onClick={cancelEdit}>Cancel Edit</button>}
                <button type="submit" className="btn-submit-tab" disabled={loading}>
                  {loading ? 'Saving...' : (editingId ? 'Update Purchase' : 'Save Purchase')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="tab-content">
          <div className="history-card-tab">
            <div className="history-header-tab">
              <div className="search-wrapper-tab">
                <span className="search-icon-tab">🔍</span>
                <input 
                  type="text" 
                  placeholder="Search by product or supplier..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
                <span className="result-count-tab">{filteredPurchases.length} entries</span>
              </div>
            </div>

            {filteredPurchases.length === 0 ? (
              <div className="empty-tab">
                <div className="empty-icon-tab">📦</div>
                <h3>No purchases yet</h3>
                <p>Click "Add New Purchase" tab to get started</p>
              </div>
            ) : (
              <div className="timeline-tab">
                {filteredPurchases.map((purchase) => {
                  const remainingStock = parseFloat(purchase.remaining_quantity || purchase.quantity);
                  const isFullyPacked = remainingStock <= 0;
                  
                  return (
                    <div key={purchase.id} className="timeline-item-tab">
                      <div className="timeline-dot-tab" style={{ background: getProductColor(purchase.product_name) }}></div>
                      <div className="timeline-content-tab">
                        <div className="timeline-header-tab">
                          <div className="product-info-tab">
                            <div className="product-badge-tab" style={{ background: getProductBgLight(purchase.product_name), color: getProductColor(purchase.product_name) }}>
                              {getProductIcon(purchase.product_name)} {purchase.product_name}
                            </div>
                            <div className="date-tab">📅 {new Date(purchase.purchase_date).toLocaleDateString('en-IN')}</div>
                          </div>
                          <div className="actions-tab">
                            <button className="edit-action-tab" onClick={() => handleEdit(purchase)}>✏️ Edit</button>
                            <button className="delete-action-tab" onClick={() => handleDelete(purchase.id, purchase.product_name)}>🗑️ Delete</button>
                          </div>
                        </div>
                        <div className="timeline-details-tab">
                          <div className="detail-item-tab">
                            <span className="detail-label-tab">Quantity:</span>
                            <span className="detail-value-tab quantity">{purchase.quantity} {purchase.unit || 'Litre'}</span>
                          </div>
                          <div className="detail-item-tab">
                            <span className="detail-label-tab">Rate:</span>
                            <span className="detail-value-tab">₹{purchase.price_per_unit}</span>
                          </div>
                          <div className="detail-item-tab">
                            <span className="detail-label-tab">Total:</span>
                            <span className="detail-value-tab total">₹{Number(purchase.total_cost).toLocaleString()}</span>
                          </div>
                          <div className="detail-item-tab">
                            <span className="detail-label-tab">Supplier:</span>
                            <span className="detail-value-tab">{purchase.farm_name || '-'}</span>
                          </div>
                          {purchase.invoice_number && (
                            <div className="detail-item-tab">
                              <span className="detail-label-tab">Invoice:</span>
                              <span className="detail-value-tab invoice">{purchase.invoice_number}</span>
                            </div>
                          )}
                          <div className="detail-item-tab">
                            <span className="detail-label-tab">Stock Status:</span>
                            <span className={`detail-value-tab ${isFullyPacked ? 'status-finished' : 'status-available'}`}>
                              {isFullyPacked ? '✅ Fully Packed' : `📦 ${remainingStock.toFixed(2)} ${purchase.unit} remaining`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddPurchase;