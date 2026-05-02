// src/pages/Delivery/DeliveryDashboard.jsx
import React, { useState, useEffect } from 'react';
import './DeliveryDashboard.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const DeliveryDashboard = () => {
  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showProfile, setShowProfile] = useState(false);
  const [todayStats, setTodayStats] = useState({ deliveries: 0, collected: 0, pending: 0 });
  const [expandedApt, setExpandedApt] = useState(null);
  const [viewMode, setViewMode] = useState('apartments');

  const getUserData = () => {
    try {
      const data = sessionStorage.getItem('userData');
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  };

  const getToken = () => sessionStorage.getItem('authToken');
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const userData = getUserData();

  useEffect(() => {
    if (!userData?.id) { 
      window.location.href = '/login';
      return; 
    }
    loadAllData();
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // ✅ FIXED: Load customers + today's deliveries from DATABASE
  const loadAllData = async () => {
    setLoading(true);
    const boyId = userData?.id;

    console.log('🔄 Loading data for boy ID:', boyId);
    console.log('📅 Checking deliveries for date:', new Date().toISOString().split('T')[0]);

    try {
      // Fetch assigned customers
      const custRes = await fetch(`${API_URL}/delivery-boys/${boyId}/customers`, {
        headers: getAuthHeaders()
      });
      
      if (custRes.status === 401) { 
        sessionStorage.clear(); 
        window.location.href = '/login';
        return; 
      }

      const custData = await custRes.json();
      console.log('📦 Customers loaded:', custData.data?.length);

      // ✅ Fetch TODAY's deliveries for this boy from the DATABASE
      const todayRes = await fetch(`${API_URL}/delivery/today/${boyId}`, {
        headers: getAuthHeaders()
      });
      const todayData = await todayRes.json();
      const todayDeliveries = todayData.success ? todayData.data : [];
      
      console.log('📦 Today deliveries from DB:', todayDeliveries?.length);
      // Log each delivery for debugging
      todayDeliveries.forEach(d => {
        console.log(`  - Customer ID: ${d.customer_id}, Name: ${d.customer_name}, Status: ${d.status}`);
      });

      if (custData.success && custData.data) {
        // ✅ Check each customer against TODAY's deliveries from DATABASE
        const enriched = custData.data.map(c => {
          // Check if this customer has a delivery recorded for TODAY
          const deliveredToday = todayDeliveries.some(d => d.customer_id == c.id);
          const deliveryInfo = todayDeliveries.find(d => d.customer_id == c.id);
          
          if (deliveredToday) {
            console.log(`✅ ${c.name} (ID:${c.id}) - DELIVERED today`);
          } else {
            console.log(`⏳ ${c.name} (ID:${c.id}) - PENDING`);
          }
          
          return {
            ...c,
            delivered: deliveredToday, // ✅ Comes from DATABASE, not local state
            deliveryData: deliveryInfo || null,
            products: c.products || []
          };
        });

        // Sort: pending first, then by apartment
        enriched.sort((a, b) => {
          if (a.delivered === b.delivered) {
            return (a.apartment || '').localeCompare(b.apartment || '');
          }
          return a.delivered ? 1 : -1;
        });

        setCustomers(enriched);
        
        const done = enriched.filter(c => c.delivered);
        const pending = enriched.filter(c => !c.delivered);
        setTodayStats({
          deliveries: done.length,
          collected: done.reduce((s, c) => s + (parseFloat(c.deliveryData?.total_amount) || 0), 0),
          pending: pending.length
        });
        
        console.log(`✅ Final Stats: ${done.length} done, ${pending.length} pending`);
      }
    } catch (error) {
      console.error('❌ Error loading data:', error);
      showMessage('error', 'Failed to load data');
    }
    setLoading(false);
  };

  // ✅ Mark customer as delivered - saves to database
  const markDelivered = async (customerId) => {
    const customer = customers.find(c => c.id == customerId);
    if (!customer) return;

    const products = customer.products || [];
    const totalAmount = products.reduce((s, p) => s + ((p.price || 0) * (p.quantity || p.quantity_per_day || 1)), 0);

    const deliveryPayload = {
      customer_id: parseInt(customerId),
      delivery_boy_id: parseInt(userData?.id),
      delivery_date: new Date().toISOString().split('T')[0],
      products: products.map(p => ({
        product_name: p.product_name,
        pack_size: p.pack_size,
        quantity: parseInt(p.quantity || p.quantity_per_day || 1),
        price: parseFloat(p.price || 0)
      })),
      status: 'delivered',
      total_amount: totalAmount
    };

    console.log('📝 Sending delivery to API:', JSON.stringify(deliveryPayload));

    try {
      const response = await fetch(`${API_URL}/delivery/record`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(deliveryPayload)
      });

      console.log('📡 API Response status:', response.status);
      const data = await response.json();
      console.log('📦 API Response:', data);

      if (data.success) {
        // ✅ Update local state immediately
        setCustomers(prev => {
          const updated = prev.map(c => 
            c.id == customerId 
              ? { ...c, delivered: true, deliveryData: { total_amount: totalAmount } } 
              : c
          );
          const done = updated.filter(c => c.delivered);
          setTodayStats({
            deliveries: done.length,
            collected: done.reduce((s, c) => s + (parseFloat(c.deliveryData?.total_amount) || 0), 0),
            pending: updated.filter(c => !c.delivered).length
          });
          return updated;
        });
        showMessage('success', `✅ Delivered to ${customer.name}`);
        
        // ✅ Verify delivery was saved by checking the DB
        setTimeout(async () => {
          const checkRes = await fetch(`${API_URL}/delivery/today/${userData?.id}`, {
            headers: getAuthHeaders()
          });
          const checkData = await checkRes.json();
          console.log('📊 Verification - Today deliveries count:', checkData.data?.length);
        }, 500);
      } else {
        showMessage('error', data.error || 'Failed to record delivery');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      showMessage('error', 'Failed to connect to server');
    }
  };

  // ✅ Undo delivery (local only)
  const undoDelivery = (customerId) => {
    setCustomers(prev => {
      const updated = prev.map(c => 
        c.id == customerId ? { ...c, delivered: false, deliveryData: null } : c
      );
      const done = updated.filter(c => c.delivered);
      setTodayStats({
        deliveries: done.length,
        collected: done.reduce((s, c) => s + (parseFloat(c.deliveryData?.total_amount) || 0), 0),
        pending: updated.filter(c => !c.delivered).length
      });
      return updated;
    });
    showMessage('success', '↩️ Undone');
  };

  const openGoogleMaps = (customer) => {
    const address = [customer.apartment, customer.flat_no, customer.area, customer.city || 'Hyderabad'].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`, '_blank');
  };

  const callCustomer = (phone) => { if (phone) window.open(`tel:${phone}`, '_self'); };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = '/login';
  };

  // ✅ Group customers by apartment
  const getApartmentGroups = () => {
    const filtered = activeTab === 'pending' 
      ? customers.filter(c => !c.delivered) 
      : customers.filter(c => c.delivered);
    
    const searched = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone || '').includes(searchTerm) ||
      (c.apartment || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.area || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.flat_no || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grouped = {};
    searched.forEach(c => {
      const apt = c.apartment || 'Other';
      if (!grouped[apt]) grouped[apt] = [];
      grouped[apt].push(c);
    });

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  const apartmentGroups = getApartmentGroups();
  const pendingCustomers = customers.filter(c => !c.delivered);
  const completedCustomers = customers.filter(c => c.delivered);
  const progressPercent = customers.length > 0 ? Math.round((completedCustomers.length / customers.length) * 100) : 0;

  if (loading) {
    return (
      <div className="dd-loading-screen">
        <div className="dd-loader-icon">🛵</div>
        <p>Loading your deliveries...</p>
      </div>
    );
  }

  return (
    <div className="dd-app">
      {/* Toast */}
      {message && (
        <div className={`dd-toast ${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Header */}
      <div className="dd-header-card">
        <div className="dd-header-top">
          <div className="dd-user-info" onClick={() => setShowProfile(!showProfile)}>
            <div className="dd-avatar">
              {userData?.name?.charAt(0)?.toUpperCase()}
              <span className="dd-online"></span>
            </div>
            <div>
              <h2>{userData?.name || 'Delivery Boy'}</h2>
              <p>🛵 {userData?.vehicle || 'N/A'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="dd-logout-icon">🚪</button>
        </div>
        
        <div className="dd-header-tags">
          <span>📱 {userData?.phone}</span>
          <span>📍 {userData?.area || 'All Areas'}</span>
          <span>🕐 {userData?.shift || 'Morning'}</span>
        </div>

        {showProfile && (
          <div className="dd-profile-popup">
            <div className="dd-profile-row"><span>📱 Phone</span><span>{userData?.phone}</span></div>
            <div className="dd-profile-row"><span>📧 Email</span><span>{userData?.email || 'N/A'}</span></div>
            <div className="dd-profile-row"><span>🛵 Vehicle</span><span>{userData?.vehicle} ({userData?.vehicleNo})</span></div>
            <div className="dd-profile-row"><span>📍 Area</span><span>{userData?.area || 'N/A'}</span></div>
            <div className="dd-profile-row"><span>🕐 Shift</span><span>{userData?.shift || 'Morning'}</span></div>
            <div className="dd-profile-row"><span>💰 Salary</span><span>₹{userData?.salary || '0'}/mo</span></div>
            <button onClick={() => setShowProfile(false)} className="dd-close-profile">Close</button>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="dd-stats-bar">
        <div className="dd-stat-item">
          <span className="dd-stat-icon">📋</span>
          <span className="dd-stat-value">{customers.length}</span>
          <span className="dd-stat-label">Total</span>
        </div>
        <div className="dd-stat-item pending">
          <span className="dd-stat-icon">⏳</span>
          <span className="dd-stat-value">{todayStats.pending}</span>
          <span className="dd-stat-label">Pending</span>
        </div>
        <div className="dd-stat-item done">
          <span className="dd-stat-icon">✅</span>
          <span className="dd-stat-value">{todayStats.deliveries}</span>
          <span className="dd-stat-label">Done</span>
        </div>
        <div className="dd-stat-item">
          <span className="dd-stat-icon">💰</span>
          <span className="dd-stat-value">₹{todayStats.collected}</span>
          <span className="dd-stat-label">Amount</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="dd-progress-section">
        <div className="dd-progress-text">
          <span>Today's Progress</span>
          <span>{completedCustomers.length}/{customers.length} ({progressPercent}%)</span>
        </div>
        <div className="dd-progress-track">
          <div className="dd-progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {/* Tabs & View Toggle */}
      <div className="dd-tabs-row">
        <button className={`dd-tab-btn ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => { setActiveTab('pending'); setExpandedApt(null); }}>
          ⏳ Pending ({pendingCustomers.length})
        </button>
        <button className={`dd-tab-btn ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => { setActiveTab('completed'); setExpandedApt(null); }}>
          ✅ Done ({completedCustomers.length})
        </button>
        <button className={`dd-tab-btn ${viewMode === 'apartments' ? 'active' : ''}`} onClick={() => setViewMode(viewMode === 'apartments' ? 'list' : 'apartments')} style={{ marginLeft: 'auto', fontSize: '18px', padding: '8px 12px' }}>
          {viewMode === 'apartments' ? '🏢' : '📋'}
        </button>
        <div className="dd-mini-search">
          <span>🔍</span>
          <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* Apartment Grouped View */}
      {viewMode === 'apartments' ? (
        <div className="dd-cards-list">
          {apartmentGroups.length === 0 ? (
            <div className="dd-empty-state">
              <span>{activeTab === 'pending' ? '🎉' : '📭'}</span>
              <h3>{activeTab === 'pending' ? 'All Done!' : 'No deliveries yet'}</h3>
              <p>{customers.length === 0 ? 'No customers assigned. Contact admin.' : 'Great job!'}</p>
            </div>
          ) : (
            apartmentGroups.map(([apartment, aptCustomers]) => {
              const allDelivered = aptCustomers.every(c => c.delivered);
              const someDelivered = aptCustomers.some(c => c.delivered);
              const aptTotal = aptCustomers.reduce((s, c) => {
                const prods = c.products || [];
                return s + prods.reduce((ps, p) => ps + ((p.price || 0) * (p.quantity || p.quantity_per_day || 1)), 0);
              }, 0);
              const isExpanded = expandedApt === apartment;

              return (
                <div key={apartment} style={{
                  background: 'white', borderRadius: '16px', overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                  border: `2px solid ${allDelivered ? '#4caf50' : someDelivered ? '#ff9800' : '#e0e0e0'}`,
                  opacity: allDelivered ? 0.75 : 1
                }}>
                  <div onClick={() => setExpandedApt(isExpanded ? null : apartment)} style={{
                    padding: '14px 16px',
                    background: allDelivered ? '#4caf50' : someDelivered ? '#fff8e1' : '#f0fdf4',
                    color: allDelivered ? 'white' : '#1a472a',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <span style={{ fontSize: '24px' }}>🏢</span>
                      <div>
                        <strong style={{ fontSize: '16px' }}>{apartment}</strong>
                        <div style={{ fontSize: '11px', opacity: 0.8 }}>
                          {aptCustomers.length} flat{aptCustomers.length > 1 ? 's' : ''} • ₹{aptTotal}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                        background: allDelivered ? 'rgba(255,255,255,0.3)' : '#fff3e0',
                        color: allDelivered ? 'white' : '#e65100'
                      }}>
                        {allDelivered ? '✅ All Done' : `${aptCustomers.filter(c => !c.delivered).length} left`}
                      </span>
                      <span style={{ fontSize: '12px' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '8px' }}>
                      {aptCustomers.map(customer => {
                        const products = customer.products || [];
                        const totalAmount = products.reduce((s, p) => s + ((p.price || 0) * (p.quantity || p.quantity_per_day || 1)), 0);
                        
                        return (
                          <div key={customer.id} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', margin: '4px 0', borderRadius: '10px',
                            background: customer.delivered ? '#f9fdf9' : '#fafafa',
                            border: `1px solid ${customer.delivered ? '#c8e6c9' : '#f0f0f0'}`,
                            borderLeft: `4px solid ${customer.delivered ? '#4caf50' : '#ff9800'}`
                          }}>
                            <div style={{
                              minWidth: '44px', height: '44px', borderRadius: '10px',
                              background: customer.delivered ? '#e8f5e9' : '#fff3e0',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, color: customer.delivered ? '#2e7d32' : '#e65100',
                              border: `2px solid ${customer.delivered ? '#4caf50' : '#ff9800'}`
                            }}>
                              <span style={{ fontSize: '14px' }}>🚪</span>
                              <span style={{ fontSize: '11px' }}>{customer.flat_no || 'N/A'}</span>
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '13px' }}>{customer.name}</strong>
                                <span style={{ fontWeight: 700, color: '#1a472a', fontSize: '13px' }}>₹{totalAmount}</span>
                              </div>
                              <div style={{ fontSize: '10px', color: '#888', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {products.map((p, i) => (
                                  <span key={i} style={{ background: '#f0fdf4', padding: '2px 6px', borderRadius: '10px' }}>
                                    {p.product_name} ×{p.quantity || p.quantity_per_day || 1}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                              <button onClick={() => openGoogleMaps(customer)} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: '#e3f2fd', cursor: 'pointer', fontSize: '13px' }}>🗺️</button>
                              <button onClick={() => callCustomer(customer.phone)} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: '#e8f5e9', cursor: 'pointer', fontSize: '13px' }}>📞</button>
                              {!customer.delivered ? (
                                <button onClick={() => markDelivered(customer.id)} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: '#4caf50', color: 'white', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}>✓</button>
                              ) : (
                                <button onClick={() => undoDelivery(customer.id)} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: '#fff3e0', color: '#e65100', cursor: 'pointer', fontSize: '13px' }}>↩</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="dd-cards-list">
          {(() => {
            const displayCustomers = activeTab === 'pending' ? pendingCustomers : completedCustomers;
            const filtered = displayCustomers.filter(c =>
              (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              (c.phone || '').includes(searchTerm) ||
              (c.apartment || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              (c.area || '').toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (filtered.length === 0) {
              return (
                <div className="dd-empty-state">
                  <span>{activeTab === 'pending' ? '🎉' : '📭'}</span>
                  <h3>{activeTab === 'pending' ? 'All Done!' : 'No deliveries'}</h3>
                  <p>{customers.length === 0 ? 'No customers assigned.' : 'Great job!'}</p>
                </div>
              );
            }

            return filtered.map(customer => {
              const products = customer.products || [];
              const totalAmount = products.reduce((s, p) => s + ((p.price || 0) * (p.quantity || p.quantity_per_day || 1)), 0);

              return (
                <div key={customer.id} className={`dd-customer-card ${customer.delivered ? 'delivered' : ''}`}>
                  <div className="dd-card-main">
                    <div className="dd-card-left">
                      <div className="dd-card-avatar">
                        {customer.name?.charAt(0)?.toUpperCase()}
                        {customer.delivered && <span className="dd-check-mark">✓</span>}
                      </div>
                      <div className="dd-card-info">
                        <h4>{customer.name}</h4>
                        <p>📱 {customer.phone} | 🚪 {customer.flat_no || 'N/A'}</p>
                        <p className="dd-card-area">🏢 {customer.apartment || 'N/A'} | 📍 {customer.area || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="dd-card-right">
                      <span className="dd-card-amount">₹{totalAmount}</span>
                      <span className={`dd-card-badge ${customer.delivered ? 'done' : 'pending'}`}>
                        {customer.delivered ? 'Done' : 'Pending'}
                      </span>
                      {!customer.delivered && (
                        <button onClick={() => markDelivered(customer.id)} style={{
                          width: '32px', height: '32px', borderRadius: '50%', border: 'none',
                          background: '#4caf50', color: 'white', cursor: 'pointer', fontSize: '16px'
                        }}>✓</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
};

export default DeliveryDashboard;