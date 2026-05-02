// src/pages/Admin/CustomerManagement/CustomerManagement.jsx
import React, { useState, useEffect } from 'react';
import './CustomerManagement.css';

const API_URL = 'http://localhost:5000/api';

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [dailyDeliveries, setDailyDeliveries] = useState([]);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [viewMode, setViewMode] = useState('table');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    registrationNumber: '',
    alternatePhone: '',
    address: {
      area: '', colony: '', apartment: '', flatNo: '',
      landmark: '', pincode: '', city: '', state: ''
    },
    dailyProducts: [
      { product_name: 'Milk', pack_size: '500ml', quantity: 1, price: 30 }
    ],
    deliveryTime: 'morning',
    notes: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const getToken = () => sessionStorage.getItem('authToken');

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3500);
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/customers`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        const formatted = data.customers.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          registrationNumber: c.registration_number || `SD${String(c.id).padStart(4, '0')}`,
          alternatePhone: c.alternate_phone || '',
          address: {
            area: c.area || '',
            colony: c.colony || '',
            apartment: c.apartment || '',
            flatNo: c.flat_no || '',
            landmark: c.landmark || '',
            pincode: c.pincode || '',
            city: c.city || '',
            state: c.state || ''
          },
          dailyProducts: c.daily_products || [],
          deliveryTime: c.delivery_time || 'morning',
          notes: c.notes || '',
          status: c.is_active ? 'active' : 'inactive',
          assigned_boy_id: c.assigned_boy_id,
          assigned_boy_name: c.assigned_boy_name,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        }));
        setCustomers(formatted);
      }
    } catch (error) {
      console.error('Error:', error);
      showMessage('error', 'Failed to load customers');
    }
    setLoading(false);
  };

  // ✅ Fetch ALL deliveries for a specific customer
  const fetchCustomerDeliveries = async (customerId) => {
    try {
      const response = await fetch(`${API_URL}/admin/customer-deliveries/${customerId}`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) return;
      
      const data = await response.json();
      if (data.success) {
        setDailyDeliveries(data.deliveries || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const generateRegistrationNumber = () => {
    const prefix = 'SD';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    try {
      const regNumber = formData.registrationNumber || generateRegistrationNumber();
      const customerData = {
        ...formData,
        registrationNumber: regNumber,
        password: formData.password || undefined
      };
      
      const url = editingCustomer 
        ? `${API_URL}/admin/customers/${editingCustomer.id}`
        : `${API_URL}/admin/customers`;
      
      const method = editingCustomer ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(customerData)
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', editingCustomer ? 'Customer updated!' : `Customer created!`);
        closeModal();
        fetchCustomers();
      } else {
        showMessage('error', data.error || 'Operation failed');
      }
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Delete customer "${name}"?`)) {
      try {
        const response = await fetch(`${API_URL}/admin/customers/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        
        const data = await response.json();
        if (data.success) {
          showMessage('success', 'Customer deleted!');
          fetchCustomers();
        }
      } catch (error) {
        showMessage('error', 'Failed to delete');
      }
    }
  };

  const handleStatusToggle = async (id) => {
    try {
      const customer = customers.find(c => c.id === id);
      const newStatus = customer.status === 'active' ? 'inactive' : 'active';
      
      const response = await fetch(`${API_URL}/admin/customers/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...customer, status: newStatus, is_active: newStatus === 'active' })
      });
      
      if (response.status === 401) return;
      
      const data = await response.json();
      if (data.success) {
        fetchCustomers();
        showMessage('success', `Customer ${newStatus === 'active' ? 'activated' : 'deactivated'}!`);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // ✅ Record delivery for customer
  const recordDelivery = async (customerId) => {
    const products = selectedCustomer?.dailyProducts || [];
    const totalAmount = products.reduce((s, p) => s + ((p.price || 0) * (p.quantity || 1)), 0);

    const delivery = {
      customer_id: customerId,
      delivery_date: new Date().toISOString().split('T')[0],
      products: products.map(p => ({
        product_name: p.product_name,
        pack_size: p.pack_size,
        quantity: p.quantity || 1,
        price: p.price || 0
      })),
      status: 'delivered',
      total_amount: totalAmount,
      delivery_boy_id: selectedCustomer?.assigned_boy_id || null
    };

    try {
      const response = await fetch(`${API_URL}/delivery/record`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(delivery)
      });
      
      if (response.status === 401) return;
      
      const data = await response.json();
      if (data.success) {
        showMessage('success', '✅ Delivery recorded!');
        fetchCustomerDeliveries(customerId);
      } else {
        showMessage('error', data.error || 'Failed to record delivery');
      }
    } catch (error) {
      showMessage('error', 'Failed to record delivery');
    }
  };

  // ✅ Open delivery history for a customer
  const openDeliveryHistory = (customer) => {
    setSelectedCustomer(customer);
    fetchCustomerDeliveries(customer.id);
    setShowDeliveryModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setCurrentStep(1);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '', email: '', phone: '', password: '', registrationNumber: '', alternatePhone: '',
      address: { area: '', colony: '', apartment: '', flatNo: '', landmark: '', pincode: '', city: '', state: '' },
      dailyProducts: [{ product_name: 'Milk', pack_size: '500ml', quantity: 1, price: 30 }],
      deliveryTime: 'morning', notes: ''
    });
  };

  const addProduct = () => {
    setFormData({
      ...formData,
      dailyProducts: [...formData.dailyProducts, { product_name: '', pack_size: '', quantity: 1, price: 0 }]
    });
  };

  const updateProduct = (index, field, value) => {
    const newProducts = [...formData.dailyProducts];
    newProducts[index][field] = field === 'quantity' || field === 'price' ? (parseInt(value) || 0) : value;
    setFormData({ ...formData, dailyProducts: newProducts });
  };

  const removeProduct = (index) => {
    if (formData.dailyProducts.length > 1) {
      setFormData({ ...formData, dailyProducts: formData.dailyProducts.filter((_, i) => i !== index) });
    }
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      password: '',
      registrationNumber: customer.registrationNumber || '',
      alternatePhone: customer.alternatePhone || '',
      address: customer.address || { area: '', colony: '', apartment: '', flatNo: '', landmark: '', pincode: '', city: '', state: '' },
      dailyProducts: customer.dailyProducts?.length ? customer.dailyProducts : [{ product_name: 'Milk', pack_size: '500ml', quantity: 1, price: 30 }],
      deliveryTime: customer.deliveryTime || 'morning',
      notes: customer.notes || ''
    });
    setCurrentStep(1);
    setShowModal(true);
  };

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm) ||
    (c.registrationNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.address?.apartment || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const totalProducts = customers.reduce((sum, c) => sum + (c.dailyProducts?.length || 0), 0);

  // ✅ Calculate delivery stats for a customer
  const getCustomerDeliveryStats = (customerId) => {
    const deliveries = JSON.parse(localStorage.getItem(`deliveries_${customerId}`) || '[]');
    const totalDeliveries = deliveries.length;
    const thisMonth = deliveries.filter(d => {
      const dDate = new Date(d.delivery_date);
      const now = new Date();
      return dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
    });
    return { total: totalDeliveries, thisMonth: thisMonth.length };
  };

  return (
    <div className="customer-management">
      {/* Message Toast */}
      {message && (
        <div className={`cm-toast ${message.type}`}>
          <span className="toast-icon">{message.type === 'success' ? '✅' : '❌'}</span>
          <span className="toast-text">{message.text}</span>
          <button className="toast-close" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Header */}
      <div className="cm-header">
        <div className="cm-header-left">
          <h1>Customer Management</h1>
          <p className="cm-header-subtitle">
            {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="cm-header-actions">
          <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>📋</button>
          <button className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>🟩</button>
          <button className="cm-add-btn" onClick={() => { setEditingCustomer(null); resetForm(); setCurrentStep(1); setShowModal(true); }}>
            + Add Customer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="cm-stats-overview">
        <div className="cm-stat-item"><div className="cm-stat-icon">👥</div><div className="cm-stat-info"><h3>{customers.length}</h3><p>Total</p></div></div>
        <div className="cm-stat-item"><div className="cm-stat-icon" style={{background:'#e8f5e9'}}>✅</div><div className="cm-stat-info"><h3>{activeCustomers}</h3><p>Active</p></div></div>
        <div className="cm-stat-item"><div className="cm-stat-icon" style={{background:'#fff3e0'}}>📦</div><div className="cm-stat-info"><h3>{totalProducts}</h3><p>Products</p></div></div>
        <div className="cm-stat-item"><div className="cm-stat-icon" style={{background:'#e3f2fd'}}>🛵</div><div className="cm-stat-info"><h3>{customers.filter(c => c.assigned_boy_id).length}</h3><p>Assigned</p></div></div>
      </div>

      {/* Search */}
      <div className="cm-toolbar">
        <div className="cm-search-wrapper">
          <span className="cm-search-icon">🔍</span>
          <input type="text" className="cm-search-input" placeholder="Search customers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          {searchTerm && <button className="cm-search-clear" onClick={() => setSearchTerm('')}>×</button>}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="cm-loading-state"><div className="cm-spinner">🥛</div><p>Loading...</p></div>
      ) : filteredCustomers.length === 0 ? (
        <div className="cm-empty-state"><span className="cm-empty-icon">📭</span><h3>No customers</h3><p>Click "+ Add Customer" to add one</p></div>
      ) : viewMode === 'grid' ? (
        <div className="cm-grid-view">
          {filteredCustomers.map(customer => (
            <div key={customer.id} className="cm-grid-card">
              <div className="cm-grid-card-header">
                <div className="cm-grid-avatar">{customer.name?.charAt(0)?.toUpperCase()}</div>
                <div className="cm-grid-status"><span className={`cm-status-dot ${customer.status || 'active'}`}></span><span>{customer.status}</span></div>
              </div>
              <h4 className="cm-grid-name">{customer.name}</h4>
              <div className="cm-grid-details">
                <p>📱 {customer.phone}</p>
                <p>🏢 {customer.address?.apartment || 'N/A'}</p>
                <p>🚪 Flat: {customer.address?.flatNo || 'N/A'}</p>
                {customer.assigned_boy_name && <p>🛵 {customer.assigned_boy_name}</p>}
              </div>
              <div className="cm-grid-products">
                {customer.dailyProducts?.slice(0,3).map((p,i) => (
                  <span key={i} className="cm-product-tag">{p.product_name} ×{p.quantity || 1}</span>
                ))}
              </div>
              <div className="cm-grid-actions">
                <button className="cm-btn-icon" onClick={() => openEditModal(customer)} title="Edit">✏️</button>
                <button className="cm-btn-icon" onClick={() => openDeliveryHistory(customer)} title="Delivery History" style={{background: '#e3f2fd'}}>📦</button>
                <button className="cm-btn-icon" onClick={() => handleStatusToggle(customer.id)} title="Toggle Status">🔄</button>
                <button className="cm-btn-icon cm-btn-danger" onClick={() => handleDelete(customer.id, customer.name)} title="Delete">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cm-table-wrapper">
          <div className="cm-table-scroll">
            <table className="cm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Address</th>
                  <th>Products</th>
                  <th>Delivery Boy</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer, index) => (
                  <tr key={customer.id} className={customer.status === 'inactive' ? 'row-inactive' : ''}>
                    <td><span className="cm-reg-badge">{customer.registrationNumber || `SD${String(index+1).padStart(4,'0')}`}</span></td>
                    <td>
                      <div className="cm-customer-cell">
                        <div className="cm-customer-avatar">{customer.name?.charAt(0)}</div>
                        <div>
                          <div className="cm-customer-name">{customer.name}</div>
                          <small style={{color: '#888'}}>{customer.address?.flatNo ? `Flat ${customer.address.flatNo}` : ''}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cm-contact-cell">
                        <div>{customer.phone}</div>
                        <small>{customer.email || 'N/A'}</small>
                      </div>
                    </td>
                    <td>
                      <div className="cm-address-cell">
                        <strong>{customer.address?.apartment || 'N/A'}</strong>
                        <small style={{display: 'block', color: '#888'}}>{customer.address?.area}</small>
                      </div>
                    </td>
                    <td>
                      <button className="cm-link-btn" onClick={() => openDeliveryHistory(customer)}>
                        📦 {customer.dailyProducts?.length || 0} products
                      </button>
                    </td>
                    <td>
                      {customer.assigned_boy_name ? (
                        <span style={{background: '#e8f5e9', color: '#2e7d32', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 600}}>
                          🛵 {customer.assigned_boy_name}
                        </span>
                      ) : (
                        <span style={{color: '#999', fontSize: '12px'}}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <button className={`cm-status-toggle ${customer.status}`} onClick={() => handleStatusToggle(customer.id)}>
                        {customer.status}
                      </button>
                    </td>
                    <td>
                      <div className="cm-actions">
                        <button className="cm-btn-icon" onClick={() => openEditModal(customer)} title="Edit">✏️</button>
                        <button className="cm-btn-icon" onClick={() => openDeliveryHistory(customer)} title="Delivery History" style={{background: '#e3f2fd'}}>📦</button>
                        <button className="cm-btn-icon cm-btn-danger" onClick={() => handleDelete(customer.id, customer.name)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="cm-modal-overlay" onClick={submitting ? undefined : closeModal}>
          <div className="cm-modal-container" onClick={e => e.stopPropagation()}>
            <div className="cm-modal-header">
              <div><h2>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2></div>
              <button className="cm-modal-close" onClick={closeModal}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="cm-form">
              <div className="cm-form-step">
                <h3 className="cm-form-title">📋 Basic Information</h3>
                <div className="cm-form-row">
                  <div className="cm-form-group"><label>Full Name *</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                  <div className="cm-form-group"><label>Phone Number *</label><input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g,'').slice(0,10)})} required maxLength={10} /></div>
                </div>
                <div className="cm-form-row">
                  <div className="cm-form-group"><label>Email</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                  <div className="cm-form-group"><label>Password {!editingCustomer && '*'}</label><input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!editingCustomer} placeholder={editingCustomer ? 'Leave blank' : 'Set password'} /></div>
                </div>
                <div className="cm-form-row">
                  <div className="cm-form-group"><label>Registration No</label><input type="text" value={formData.registrationNumber} onChange={e => setFormData({...formData, registrationNumber: e.target.value})} /></div>
                  <div className="cm-form-group"><label>Delivery Time</label><select value={formData.deliveryTime} onChange={e => setFormData({...formData, deliveryTime: e.target.value})}><option value="morning">🌅 Morning</option><option value="evening">🌆 Evening</option><option value="both">🔄 Both</option></select></div>
                </div>
              </div>

              <div className="cm-form-step">
                <h3 className="cm-form-title">📍 Address</h3>
                <div className="cm-form-row">
                  <div className="cm-form-group"><label>Apartment *</label><input type="text" value={formData.address.apartment} onChange={e => setFormData({...formData, address: {...formData.address, apartment: e.target.value}})} required /></div>
                  <div className="cm-form-group"><label>Flat No *</label><input type="text" value={formData.address.flatNo} onChange={e => setFormData({...formData, address: {...formData.address, flatNo: e.target.value}})} required /></div>
                </div>
                <div className="cm-form-row">
                  <div className="cm-form-group"><label>Area *</label><input type="text" value={formData.address.area} onChange={e => setFormData({...formData, address: {...formData.address, area: e.target.value}})} required /></div>
                  <div className="cm-form-group"><label>City *</label><input type="text" value={formData.address.city} onChange={e => setFormData({...formData, address: {...formData.address, city: e.target.value}})} required /></div>
                </div>
                <div className="cm-form-row">
                  <div className="cm-form-group"><label>Pincode</label><input type="text" value={formData.address.pincode} onChange={e => setFormData({...formData, address: {...formData.address, pincode: e.target.value.replace(/\D/g,'').slice(0,6)}})} maxLength={6} /></div>
                  <div className="cm-form-group"><label>Landmark</label><input type="text" value={formData.address.landmark} onChange={e => setFormData({...formData, address: {...formData.address, landmark: e.target.value}})} /></div>
                </div>
              </div>

              <div className="cm-form-step">
                <div className="cm-form-section-header"><h3 className="cm-form-title">🥛 Products</h3><button type="button" className="cm-btn-add-product" onClick={addProduct}>+ Add</button></div>
                {formData.dailyProducts.map((product, idx) => (
                  <div key={idx} className="cm-product-row">
                    <div className="cm-product-fields">
                      <input type="text" value={product.product_name} onChange={e => updateProduct(idx, 'product_name', e.target.value)} placeholder="Product" />
                      <input type="text" value={product.pack_size} onChange={e => updateProduct(idx, 'pack_size', e.target.value)} placeholder="Size" />
                      <div className="cm-product-qty">
                        <button type="button" onClick={() => updateProduct(idx, 'quantity', Math.max(1, product.quantity-1))}>−</button>
                        <input type="number" value={product.quantity} onChange={e => updateProduct(idx, 'quantity', parseInt(e.target.value)||1)} min="1" />
                        <button type="button" onClick={() => updateProduct(idx, 'quantity', product.quantity+1)}>+</button>
                      </div>
                      <div className="cm-product-price"><span>₹</span><input type="number" value={product.price} onChange={e => updateProduct(idx, 'price', parseInt(e.target.value)||0)} min="0" /></div>
                    </div>
                    {formData.dailyProducts.length > 1 && <button type="button" className="cm-btn-remove" onClick={() => removeProduct(idx)}>×</button>}
                  </div>
                ))}
                <div className="cm-form-group" style={{marginTop:'20px'}}><label>Notes</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={2} /></div>
              </div>

              <div className="cm-form-footer">
                <button type="button" className="cm-btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="cm-btn-primary" disabled={submitting}>{submitting ? '⏳ Saving...' : editingCustomer ? '💾 Update' : '✅ Save Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ DELIVERY HISTORY MODAL - Shows all deliveries for customer */}
      {showDeliveryModal && selectedCustomer && (
        <div className="cm-modal-overlay" onClick={() => setShowDeliveryModal(false)}>
          <div className="cm-modal-container" style={{maxWidth: '700px'}} onClick={e => e.stopPropagation()}>
            <div className="cm-modal-header" style={{background: '#f0fdf4', borderRadius: '16px 16px 0 0'}}>
              <div>
                <h2>📦 Delivery History</h2>
                <p style={{margin: '4px 0 0', fontSize: '14px', color: '#1a472a'}}>
                  <strong>{selectedCustomer.name}</strong> | 📱 {selectedCustomer.phone} | 🏢 {selectedCustomer.address?.apartment} | 🚪 {selectedCustomer.address?.flatNo}
                </p>
              </div>
              <button className="cm-modal-close" onClick={() => setShowDeliveryModal(false)}>×</button>
            </div>
            
            <div style={{padding: '20px'}}>
              {/* Customer Info Summary */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
                marginBottom: '20px'
              }}>
                <div style={{background: '#f0fdf4', padding: '12px', borderRadius: '10px', textAlign: 'center'}}>
                  <div style={{fontSize: '22px', fontWeight: 700, color: '#1a472a'}}>{dailyDeliveries.length}</div>
                  <div style={{fontSize: '11px', color: '#666'}}>Total Deliveries</div>
                </div>
                <div style={{background: '#e8f5e9', padding: '12px', borderRadius: '10px', textAlign: 'center'}}>
                  <div style={{fontSize: '22px', fontWeight: 700, color: '#2e7d32'}}>
                    {dailyDeliveries.filter(d => d.status === 'delivered').length}
                  </div>
                  <div style={{fontSize: '11px', color: '#666'}}>Delivered</div>
                </div>
                <div style={{background: '#fff3e0', padding: '12px', borderRadius: '10px', textAlign: 'center'}}>
                  <div style={{fontSize: '22px', fontWeight: 700, color: '#e65100'}}>
                    ₹{dailyDeliveries.reduce((s, d) => s + (parseFloat(d.total_amount) || 0), 0).toLocaleString()}
                  </div>
                  <div style={{fontSize: '11px', color: '#666'}}>Total Amount</div>
                </div>
              </div>

              {/* Products Subscribed */}
              <div style={{marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '10px'}}>
                <h4 style={{margin: '0 0 8px', color: '#1a472a'}}>🥛 Subscribed Products</h4>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                  {selectedCustomer.dailyProducts?.map((p, i) => (
                    <span key={i} style={{
                      background: '#e8f5e9', color: '#2e7d32', padding: '5px 12px',
                      borderRadius: '20px', fontSize: '12px', fontWeight: 600
                    }}>
                      {p.product_name} {p.pack_size} ×{p.quantity || 1} = ₹{(p.price || 0) * (p.quantity || 1)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Record Today's Delivery Button */}
              <button 
                onClick={() => recordDelivery(selectedCustomer.id)}
                style={{
                  width: '100%', padding: '12px', background: '#4caf50', color: 'white',
                  border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px',
                  cursor: 'pointer', marginBottom: '20px'
                }}
              >
                ✅ Record Today's Delivery
              </button>

              {/* Delivery History Table */}
              <h4 style={{color: '#1a472a', marginBottom: '10px'}}>📜 Delivery History</h4>
              {dailyDeliveries.length === 0 ? (
                <p style={{textAlign: 'center', color: '#999', padding: '20px'}}>No deliveries recorded yet</p>
              ) : (
                <div style={{maxHeight: '300px', overflow: 'auto'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
                    <thead>
                      <tr style={{background: '#1a472a', color: 'white'}}>
                        <th style={{padding: '8px 10px', textAlign: 'left'}}>Date</th>
                        <th style={{padding: '8px 10px', textAlign: 'left'}}>Product</th>
                        <th style={{padding: '8px 10px', textAlign: 'left'}}>Qty</th>
                        <th style={{padding: '8px 10px', textAlign: 'left'}}>Amount</th>
                        <th style={{padding: '8px 10px', textAlign: 'left'}}>Delivery Boy</th>
                        <th style={{padding: '8px 10px', textAlign: 'center'}}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyDeliveries.map((d, i) => (
                        <tr key={d.id} style={{borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fafdfa' : 'white'}}>
                          <td style={{padding: '8px 10px'}}>{d.delivery_date?.split('T')[0]}</td>
                          <td style={{padding: '8px 10px'}}>{d.product_name} ({d.pack_size})</td>
                          <td style={{padding: '8px 10px'}}>{d.quantity}</td>
                          <td style={{padding: '8px 10px', fontWeight: 600, color: '#1a472a'}}>₹{d.total_amount}</td>
                          <td style={{padding: '8px 10px'}}>{d.delivery_boy_name || 'N/A'}</td>
                          <td style={{padding: '8px 10px', textAlign: 'center'}}>
                            <span style={{
                              padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                              background: d.status === 'delivered' ? '#e8f5e9' : '#fff3e0',
                              color: d.status === 'delivered' ? '#2e7d32' : '#e65100'
                            }}>
                              {d.status === 'delivered' ? '✅ Done' : '⏳ Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;