// src/pages/Admin/DeliveryBoys/DeliveryBoyManagement.jsx
import React, { useState, useEffect } from 'react';
import './DeliveryBoyManagement.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const DeliveryBoyManagement = () => {
  const [deliveryBoys, setDeliveryBoys] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBoyModal, setShowBoyModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingBoy, setEditingBoy] = useState(null);
  const [selectedBoy, setSelectedBoy] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState([]);

  const [formData, setFormData] = useState({
    name: '', phone: '', password: '', email: '',
    vehicle: '', vehicleNo: '', area: '', address: '',
    salary: '', shift: 'morning'
  });

  useEffect(() => {
    loadData();
  }, []);

  // ✅ Get auth token
  const getToken = () => sessionStorage.getItem('authToken');

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // ✅ Load data from SQL backend with auth
  const loadData = async () => {
    setLoading(true);
    
    const token = getToken();
    
    if (!token) {
      showMessage('error', 'Please login again');
      setLoading(false);
      return;
    }

    try {
      const [boysRes, custRes] = await Promise.all([
        fetch(`${API_URL}/delivery-boys`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/customers`, { headers: getAuthHeaders() })
      ]);

      if (boysRes.status === 401 || custRes.status === 401) {
        window.location.href = '/login';
        return;
      }

      const boysData = await boysRes.json();
      const custData = await custRes.json();

      if (boysData.success) {
        setDeliveryBoys(boysData.data || []);
      } else {
        setDeliveryBoys([]);
      }

      if (custData.success) {
        setCustomers(custData.customers || []);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('error', 'Failed to load data: ' + error.message);
    }
    setLoading(false);
  };

  const getBoyCustomerCount = (boyId) => {
    return customers.filter(c => c.assigned_boy_id === boyId).length;
  };

  // ✅ Add/Update Delivery Boy
  const handleBoySubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const url = editingBoy 
        ? `${API_URL}/delivery-boys/${editingBoy.id}`
        : `${API_URL}/delivery-boys`;
      
      const method = editingBoy ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const data = await response.json();

      if (data.success) {
        showMessage('success', editingBoy 
          ? 'Delivery boy updated!' 
          : `"${formData.name}" added! Login: ${formData.phone} / ${formData.password}`
        );
        setShowBoyModal(false);
        setEditingBoy(null);
        resetForm();
        loadData();
      } else {
        showMessage('error', data.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Error:', error);
      showMessage('error', 'Failed to connect to server');
    }
    setSubmitting(false);
  };

  // ✅ Delete
  const handleDeleteBoy = async (id, name) => {
    if (window.confirm(`Delete "${name}"?`)) {
      try {
        const response = await fetch(`${API_URL}/delivery-boys/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });

        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }

        const data = await response.json();
        if (data.success) {
          showMessage('success', 'Delivery boy deleted!');
          loadData();
        } else {
          showMessage('error', data.error || 'Delete failed');
        }
      } catch (error) {
        showMessage('error', 'Failed to delete');
      }
    }
  };

  // ✅ Toggle status
  const toggleBoyStatus = async (id) => {
    try {
      const response = await fetch(`${API_URL}/delivery-boys/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });

      if (response.status === 401) return;

      const data = await response.json();
      if (data.success) {
        loadData();
        showMessage('success', 'Status updated!');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // ✅ Open Assign Modal
  const openAssignModal = async (boy) => {
    setSelectedBoy(boy);
    setAssignSearch('');
    setSelectedCustomers([]);
    
    try {
      const res = await fetch(`${API_URL}/delivery-boys/${boy.id}/customers`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setSelectedCustomers(data.data.map(c => c.id));
      }
    } catch (error) {
      console.error('Error:', error);
    }
    
    setShowAssignModal(true);
  };

  // ✅ Assign customers
  const handleAssignCustomers = async () => {
    try {
      const response = await fetch(`${API_URL}/delivery-boys/${selectedBoy.id}/assign-customers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ customerIds: selectedCustomers })
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const data = await response.json();
      if (data.success) {
        showMessage('success', `${selectedCustomers.length} customers assigned!`);
        setShowAssignModal(false);
        setSelectedBoy(null);
        loadData();
      } else {
        showMessage('error', data.error || 'Assignment failed');
      }
    } catch (error) {
      showMessage('error', 'Failed to connect to server');
    }
  };

  // ✅ Remove assignment
  const removeCustomerAssignment = async (customerId) => {
    try {
      const newIds = selectedCustomers.filter(id => id !== customerId);
      const response = await fetch(`${API_URL}/delivery-boys/${selectedBoy.id}/assign-customers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ customerIds: newIds })
      });

      if (response.status === 401) return;

      const data = await response.json();
      if (data.success) {
        setSelectedCustomers(newIds);
        showMessage('success', 'Customer unassigned!');
        loadData();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const toggleCustomerSelect = (customerId) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) ? prev.filter(id => id !== customerId) : [...prev, customerId]
    );
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', password: '', email: '', vehicle: '', vehicleNo: '', area: '', address: '', salary: '', shift: 'morning' });
  };

  const openEditBoy = (boy) => {
    setEditingBoy(boy);
    setFormData({
      name: boy.name || '', phone: boy.phone || '', password: '', email: boy.email || '',
      vehicle: boy.vehicle || '', vehicleNo: boy.vehicle_no || boy.vehicleNo || '', 
      area: boy.area || '', address: boy.address || '', 
      salary: boy.salary || '', shift: boy.shift || 'morning'
    });
    setShowBoyModal(true);
  };

  const filteredBoys = deliveryBoys.filter(b =>
    (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.phone || '').includes(searchTerm) ||
    (b.area || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const alreadyAssigned = customers.filter(c => c.assigned_boy_id === selectedBoy?.id);

  // ✅ Filter customers for assignment modal
  const getFilteredCustomers = () => {
    return customers.filter(c => {
      const matchesSearch = (c.name || '').toLowerCase().includes(assignSearch.toLowerCase()) ||
                            (c.phone || '').includes(assignSearch) ||
                            (c.apartment || c.address?.apartment || '').toLowerCase().includes(assignSearch.toLowerCase()) ||
                            (c.area || c.address?.area || '').toLowerCase().includes(assignSearch.toLowerCase());
      const notAssignedToOthers = !c.assigned_boy_id || c.assigned_boy_id === selectedBoy?.id;
      return matchesSearch && notAssignedToOthers;
    });
  };

  return (
    <div className="dbm-container">
      {/* Toast Message */}
      {message && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 3000,
          padding: '14px 20px', borderRadius: '10px', color: 'white',
          background: message.type === 'success' ? '#4caf50' : '#ef4444',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.2)', fontWeight: 500
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
            cursor: 'pointer', padding: '2px 8px', borderRadius: '50%'
          }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a472a, #2d6a4f)',
        color: 'white', padding: '24px', borderRadius: '16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px', flexWrap: 'wrap', gap: '12px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>👨‍💼 Delivery Boy Management</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.8 }}>Manage delivery boys & assign customers</p>
        </div>
        <button onClick={() => { setEditingBoy(null); resetForm(); setShowBoyModal(true); }}
          style={{
            padding: '12px 24px', background: '#4caf50', color: 'white',
            border: 'none', borderRadius: '10px', cursor: 'pointer',
            fontWeight: 600, fontSize: '14px'
          }}>
          + Add Delivery Boy
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: '28px' }}>👨‍💼</span>
          <div><h3 style={{ fontSize: '22px', color: '#1a472a' }}>{deliveryBoys.length}</h3><p style={{ fontSize: '11px', color: '#666' }}>Total Boys</p></div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: '28px' }}>✅</span>
          <div><h3 style={{ fontSize: '22px', color: '#1a472a' }}>{deliveryBoys.filter(b => b.status === 'active').length}</h3><p style={{ fontSize: '11px', color: '#666' }}>Active</p></div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: '28px' }}>👥</span>
          <div><h3 style={{ fontSize: '22px', color: '#1a472a' }}>{deliveryBoys.reduce((sum, b) => sum + (b.customer_count || 0), 0)}</h3><p style={{ fontSize: '11px', color: '#666' }}>Assigned</p></div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
        <input type="text" placeholder="Search delivery boys..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '12px 14px 12px 42px', border: '2px solid #e0e0e0', borderRadius: '10px', fontSize: '14px' }} />
      </div>

      {/* Loading / Empty / Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
          <div style={{ fontSize: '40px' }}>🥛</div>
          <p>Loading...</p>
        </div>
      ) : deliveryBoys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', color: '#666' }}>
          <span style={{ fontSize: '50px' }}>👨‍💼</span>
          <h3>No Delivery Boys Yet</h3>
          <p>Click "+ Add Delivery Boy" to register your first delivery partner</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#1a472a', color: 'white' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px' }}>#</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px' }}>Name</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px' }}>Phone</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px' }}>Vehicle</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px' }}>Area</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px' }}>Shift</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px' }}>Customers</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBoys.map((boy, idx) => (
                <tr key={boy.id} style={{ borderBottom: '1px solid #f0f0f0', opacity: boy.status === 'inactive' ? 0.5 : 1 }}>
                  <td style={{ padding: '12px 14px' }}>{idx + 1}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #4caf50, #1a472a)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                        {boy.name?.charAt(0)}
                      </div>
                      <div>
                        <strong>{boy.name}</strong>
                        <small style={{ display: 'block', color: '#888', fontSize: '11px' }}>{boy.email || 'No email'}</small>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>{boy.phone}</td>
                  <td style={{ padding: '12px 14px' }}>{boy.vehicle || 'N/A'} {boy.vehicle_no && <small>({boy.vehicle_no})</small>}</td>
                  <td style={{ padding: '12px 14px' }}>{boy.area || 'N/A'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{boy.shift || 'morning'}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => openAssignModal(boy)}
                      style={{ background: '#f0fdf4', border: '2px dashed #4caf50', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '13px', color: '#1a472a' }}>
                      👥 {boy.customer_count || 0} customers
                    </button>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => toggleBoyStatus(boy.id)}
                      style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '11px',
                        background: boy.status === 'active' ? '#e8f5e9' : '#ffebee',
                        color: boy.status === 'active' ? '#2e7d32' : '#c62828'
                      }}>
                      {boy.status}
                    </button>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => openEditBoy(boy)}
                        style={{ width: '30px', height: '30px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#e3f2fd', color: '#1976d2', fontSize: '14px' }}>✏️</button>
                      <button onClick={() => handleDeleteBoy(boy.id, boy.name)}
                        style={{ width: '30px', height: '30px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#ffebee', color: '#c62828', fontSize: '14px' }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Boy Modal */}
      {showBoyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}
          onClick={() => { setShowBoyModal(false); setEditingBoy(null); resetForm(); }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '550px', maxHeight: '85vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#1a472a', fontSize: '20px' }}>{editingBoy ? 'Edit Delivery Boy' : 'Add New Delivery Boy'}</h2>
              <button onClick={() => { setShowBoyModal(false); setEditingBoy(null); resetForm(); }}
                style={{ background: '#f0f0f0', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <form onSubmit={handleBoySubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px', color: '#444' }}>Full Name *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required
                    style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} placeholder="e.g., Rajesh Kumar" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px', color: '#444' }}>Phone * (Login)</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g,'').slice(0,10)})} required maxLength={10}
                    style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} placeholder="10 digit number" />
                </div>
              </div>
              
              {!editingBoy && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px', color: '#444' }}>Password *</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required
                        style={{ width: '100%', padding: '10px 40px 10px 10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} placeholder="Min 6 chars" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                    <small style={{ color: '#666', fontSize: '10px' }}>Phone + Password to login</small>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px', color: '#444' }}>Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} placeholder="Optional" />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px', color: '#444' }}>Vehicle</label>
                  <input type="text" value={formData.vehicle} onChange={e => setFormData({...formData, vehicle: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} placeholder="e.g., Bajaj Platina" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px', color: '#444' }}>Vehicle No</label>
                  <input type="text" value={formData.vehicleNo} onChange={e => setFormData({...formData, vehicleNo: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} placeholder="e.g., TS07AB1234" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px', color: '#444' }}>Area</label>
                  <input type="text" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} placeholder="e.g., KPHB, Madhapur" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px', color: '#444' }}>Shift</label>
                  <select value={formData.shift} onChange={e => setFormData({...formData, shift: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }}>
                    <option value="morning">🌅 Morning</option>
                    <option value="evening">🌆 Evening</option>
                    <option value="both">🔄 Both</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px', color: '#444' }}>Address</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} placeholder="Home address" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '12px', color: '#444' }}>Salary (₹/month)</label>
                  <input type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} placeholder="e.g., 12000" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                <button type="button" onClick={() => { setShowBoyModal(false); setEditingBoy(null); resetForm(); }}
                  style={{ padding: '12px 24px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={submitting}
                  style={{ padding: '12px 24px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? '⏳ Saving...' : editingBoy ? '💾 Update' : '✅ Add Delivery Boy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== ASSIGN CUSTOMERS MODAL - APARTMENT GROUPED ========== */}
      {showAssignModal && selectedBoy && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}
          onClick={() => setShowAssignModal(false)}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '900px', maxHeight: '85vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2 style={{ color: '#1a472a', margin: 0 }}>🏢 Assign Customers to {selectedBoy.name}</h2>
                <p style={{ color: '#666', fontSize: '13px', margin: '4px 0 0' }}>
                  📱 {selectedBoy.phone} | 🛵 {selectedBoy.vehicle} | 📍 {selectedBoy.area}
                </p>
              </div>
              <button onClick={() => setShowAssignModal(false)}
                style={{ background: '#f0f0f0', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            {customers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <span style={{ fontSize: '50px' }}>📭</span>
                <h3>No Customers Available</h3>
                <p>Add customers from Customer Management first</p>
              </div>
            ) : (
              <>
                {/* Search */}
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
                  <input type="text" placeholder="Search by customer name, phone, apartment, or area..." value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px 10px 40px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} />
                </div>

                {/* Select All / Clear */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 600, color: '#1a472a' }}>✅ {selectedCustomers.length} customers selected</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => {
                      const allIds = getFilteredCustomers().map(c => c.id);
                      setSelectedCustomers(prev => [...new Set([...prev, ...allIds])]);
                    }} style={{ padding: '6px 14px', background: '#e3f2fd', color: '#1976d2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>Select All</button>
                    <button onClick={() => setSelectedCustomers([])} style={{ padding: '6px 14px', background: '#ffebee', color: '#c62828', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>Clear All</button>
                  </div>
                </div>

                {/* ✅ APARTMENT GROUPED VIEW */}
                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                  {(() => {
                    const filtered = getFilteredCustomers();
                    const grouped = {};
                    
                    filtered.forEach(c => {
                      const apt = c.apartment || c.address?.apartment || 'No Apartment';
                      if (!grouped[apt]) grouped[apt] = [];
                      grouped[apt].push(c);
                    });

                    const sortedApts = Object.keys(grouped).sort();

                    if (sortedApts.length === 0) {
                      return <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No customers found</p>;
                    }

                    return sortedApts.map(apt => {
                      const aptCustomers = grouped[apt];
                      const allSelected = aptCustomers.every(c => selectedCustomers.includes(c.id));
                      const someSelected = aptCustomers.some(c => selectedCustomers.includes(c.id));

                      return (
                        <div key={apt} style={{ marginBottom: '12px', border: `2px solid ${allSelected ? '#4caf50' : someSelected ? '#ff9800' : '#e0e0e0'}`, borderRadius: '12px', overflow: 'hidden', background: allSelected ? '#f0fdf4' : 'white' }}>
                          
                          {/* Apartment Header */}
                          <div onClick={() => {
                            const aptIds = aptCustomers.map(c => c.id);
                            if (allSelected) {
                              setSelectedCustomers(prev => prev.filter(id => !aptIds.includes(id)));
                            } else {
                              setSelectedCustomers(prev => [...new Set([...prev, ...aptIds])]);
                            }
                          }} style={{ padding: '12px 16px', background: allSelected ? '#4caf50' : someSelected ? '#fff3e0' : '#f9fafb', color: allSelected ? 'white' : '#1a472a', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input type="checkbox" checked={allSelected} onChange={() => {}} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#4caf50' }} />
                              <div>
                                <strong style={{ fontSize: '15px' }}>🏢 {apt}</strong>
                                <span style={{ marginLeft: '10px', fontSize: '12px', opacity: 0.8 }}>{aptCustomers.length} customer{aptCustomers.length > 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            <span style={{ fontSize: '18px' }}>{allSelected ? '✅' : someSelected ? '◐' : '☐'}</span>
                          </div>

                          {/* Customers in this apartment */}
                          <div style={{ padding: '8px' }}>
                            {aptCustomers.map(c => (
                              <div key={c.id} onClick={() => toggleCustomerSelect(c.id)} style={{
                                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', margin: '3px 0',
                                borderRadius: '8px', cursor: 'pointer',
                                background: selectedCustomers.includes(c.id) ? '#e8f5e9' : 'white',
                                border: `1px solid ${selectedCustomers.includes(c.id) ? '#4caf50' : '#f0f0f0'}`, transition: 'all 0.15s'
                              }}>
                                <input type="checkbox" checked={selectedCustomers.includes(c.id)} onChange={() => {}} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#4caf50' }} />
                                <div style={{ flex: 1 }}>
                                  <strong style={{ fontSize: '13px' }}>{c.name}</strong>
                                  <div style={{ fontSize: '11px', color: '#888', display: 'flex', gap: '10px' }}>
                                    <span>📱 {c.phone}</span>
                                    <span>🚪 {c.flat_no || c.address?.flatNo || 'N/A'}</span>
                                    {c.area && <span>📍 {c.area}</span>}
                                  </div>
                                </div>
                                {selectedCustomers.includes(c.id) && <span style={{ color: '#4caf50', fontSize: '16px' }}>✓</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Already Assigned */}
                {alreadyAssigned.length > 0 && selectedCustomers.length > 0 && (
                  <div style={{ marginTop: '20px', borderTop: '2px solid #e0e0e0', paddingTop: '16px' }}>
                    <h4 style={{ color: '#1a472a', marginBottom: '10px' }}>✅ Already Assigned to {selectedBoy.name} ({alreadyAssigned.length})</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {alreadyAssigned.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f0fdf4', borderRadius: '20px', border: '1px solid #4caf50', fontSize: '12px' }}>
                          <span>🏢 {c.apartment || c.address?.apartment || 'N/A'}</span>
                          <span>-</span>
                          <strong>{c.name}</strong>
                          <button onClick={() => removeCustomerAssignment(c.id)} style={{ background: '#ffebee', border: 'none', color: '#c62828', width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', fontSize: '12px', marginLeft: '4px' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
                  <span style={{ color: '#666', fontSize: '13px' }}>{selectedCustomers.length} selected</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setShowAssignModal(false)} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
                    <button onClick={handleAssignCustomers} style={{ padding: '10px 24px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                      ✅ Assign {selectedCustomers.length} Customers
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryBoyManagement;