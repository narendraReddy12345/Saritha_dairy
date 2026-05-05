// src/pages/Delivery/DeliveryDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import './DeliveryDashboard.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const DeliveryDashboard = () => {
  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayStats, setTodayStats] = useState({ deliveries: 0, collected: 0, pending: 0 });
  const [deliveringId, setDeliveringId] = useState(null);
  const [activeNav, setActiveNav] = useState('home');

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
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    const boyId = userData?.id;

    try {
      const custRes = await fetch(`${API_URL}/delivery-boys/${boyId}/customers`, {
        headers: getAuthHeaders()
      });
      
      if (custRes.status === 401) { 
        sessionStorage.clear(); 
        window.location.href = '/login';
        return; 
      }

      const custData = await custRes.json();

      const todayRes = await fetch(`${API_URL}/delivery/today/${boyId}`, {
        headers: getAuthHeaders()
      });
      const todayData = await todayRes.json();
      const todayDeliveries = todayData.success ? todayData.data : [];

      if (custData.success && custData.data) {
        const enriched = custData.data.map(c => {
          const deliveredToday = todayDeliveries.some(d => d.customer_id == c.id);
          const deliveryInfo = todayDeliveries.find(d => d.customer_id == c.id);
          
          return {
            ...c,
            delivered: deliveredToday,
            deliveryData: deliveryInfo || null,
            products: c.products || []
          };
        });

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
      }
    } catch (error) {
      console.error('Error:', error);
      showMessage('error', 'Failed to load data');
    }
    setLoading(false);
  };

  const markDelivered = async (customerId) => {
    const customer = customers.find(c => c.id == customerId);
    if (!customer || deliveringId) return;

    setDeliveringId(customerId);
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

    try {
      const response = await fetch(`${API_URL}/delivery/record`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(deliveryPayload)
      });

      const data = await response.json();

      if (data.success) {
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
        if (navigator.vibrate) navigator.vibrate(50);
      } else {
        showMessage('error', data.error || 'Failed to record delivery');
      }
    } catch (error) {
      showMessage('error', 'Failed to connect to server');
    }
    setDeliveringId(null);
  };

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

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good Morning', icon: '🌅' };
    if (hour < 17) return { text: 'Good Afternoon', icon: '☀️' };
    return { text: 'Good Evening', icon: '🌙' };
  };

  const pendingCustomers = customers.filter(c => !c.delivered);
  const completedCustomers = customers.filter(c => c.delivered);
  const progressPercent = customers.length > 0 ? Math.round((completedCustomers.length / customers.length) * 100) : 0;
  const greeting = getGreeting();

  if (loading) {
    return (
      <div className="dd-mobile-loading">
        <div className="dd-mobile-spinner"></div>
        <p>Loading deliveries...</p>
      </div>
    );
  }

  const displayCustomers = activeTab === 'pending' ? pendingCustomers : completedCustomers;
  const filteredCustomers = displayCustomers.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm) ||
    (c.apartment || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.flat_no || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dd-mobile-app">
      {/* Toast */}
      {message && (
        <div className={`dd-mobile-toast ${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Header */}
      <div className="dd-mobile-header">
        <div className="dd-mobile-header-top">
          <div className="dd-mobile-user">
            <div className="dd-mobile-avatar">
              {userData?.name?.charAt(0)?.toUpperCase() || 'D'}
            </div>
            <div className="dd-mobile-user-info">
              <div className="dd-mobile-greeting">
                <span>{greeting.icon}</span>
                <span>{greeting.text},</span>
              </div>
              <h2>{userData?.name || 'Delivery Boy'} 🐍</h2>
            </div>
          </div>
          <button className="dd-mobile-notification">
            🔔
            <span className="dd-notification-badge">{todayStats.pending}</span>
          </button>
        </div>
      </div>

      {/* Today's Summary Card */}
      <div className="dd-mobile-summary-card">
        <div className="dd-summary-header">
          <h3>📋 Today's Summary</h3>
          <span className="dd-summary-date">
            {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <div className="dd-summary-stats">
          <div className="dd-summary-stat">
            <div className="dd-summary-stat-icon total">📦</div>
            <div className="dd-summary-stat-info">
              <span className="dd-summary-stat-label">Total Deliveries</span>
              <span className="dd-summary-stat-value">{customers.length}</span>
            </div>
          </div>
          <div className="dd-summary-stat">
            <div className="dd-summary-stat-icon done">✅</div>
            <div className="dd-summary-stat-info">
              <span className="dd-summary-stat-label">Completed</span>
              <span className="dd-summary-stat-value">{todayStats.deliveries}</span>
            </div>
          </div>
          <div className="dd-summary-stat">
            <div className="dd-summary-stat-icon pending">⏳</div>
            <div className="dd-summary-stat-info">
              <span className="dd-summary-stat-label">Pending</span>
              <span className="dd-summary-stat-value">{todayStats.pending}</span>
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="dd-summary-progress">
          <div className="dd-summary-progress-bar">
            <div 
              className="dd-summary-progress-fill" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <span className="dd-summary-progress-text">{progressPercent}% done</span>
        </div>

        {/* Start Delivery Button */}
        {todayStats.pending > 0 && (
          <button className="dd-start-delivery-btn" onClick={() => setActiveTab('pending')}>
            🚀 Start Delivery
          </button>
        )}
      </div>

      {/* Quick Links */}
      <div className="dd-quick-links">
        <button className="dd-quick-link">
          <span className="dd-quick-link-icon">📋</span>
          <span>Orders</span>
        </button>
        <button className="dd-quick-link" onClick={() => window.open('https://maps.google.com', '_blank')}>
          <span className="dd-quick-link-icon">🗺️</span>
          <span>Route Map</span>
        </button>
        <button className="dd-quick-link" onClick={handleLogout}>
          <span className="dd-quick-link-icon">🚪</span>
          <span>Logout</span>
        </button>
      </div>

      {/* Search & Tabs */}
      <div className="dd-mobile-search-bar">
        <span>🔍</span>
        <input 
          type="text" 
          placeholder="Search customers..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="dd-mobile-tabs">
        <button 
          className={`dd-mobile-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          ⏳ Pending ({pendingCustomers.length})
        </button>
        <button 
          className={`dd-mobile-tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          ✅ Done ({completedCustomers.length})
        </button>
      </div>

      {/* Customer List */}
      <div className="dd-mobile-customer-list">
        {filteredCustomers.length === 0 ? (
          <div className="dd-mobile-empty">
            <span>{activeTab === 'pending' ? '🎉' : '📭'}</span>
            <p>{activeTab === 'pending' ? 'All deliveries done!' : 'No completed deliveries'}</p>
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const products = customer.products || [];
            const totalAmount = products.reduce((s, p) => s + ((p.price || 0) * (p.quantity || p.quantity_per_day || 1)), 0);
            
            return (
              <div key={customer.id} className={`dd-mobile-customer-card ${customer.delivered ? 'delivered' : ''}`}>
                <div className="dd-mobile-customer-left">
                  <div className="dd-mobile-customer-avatar">
                    {customer.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="dd-mobile-customer-info">
                    <h4>{customer.name}</h4>
                    <p>🚪 {customer.flat_no || 'N/A'} · 🏢 {customer.apartment || 'N/A'}</p>
                    <div className="dd-mobile-customer-products">
                      {products.map((p, i) => (
                        <span key={i} className="dd-mobile-product-tag">
                          {p.product_name} ×{p.quantity || p.quantity_per_day || 1}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="dd-mobile-customer-right">
                  <span className="dd-mobile-customer-amount">₹{totalAmount}</span>
                  {!customer.delivered ? (
                    <button 
                      onClick={() => markDelivered(customer.id)}
                      className={`dd-mobile-deliver-btn ${deliveringId === customer.id ? 'loading' : ''}`}
                      disabled={deliveringId === customer.id}
                    >
                      {deliveringId === customer.id ? '⏳' : '✓'}
                    </button>
                  ) : (
                    <div className="dd-mobile-customer-actions-done">
                      <span className="dd-mobile-done-badge">✅</span>
                      <button onClick={() => undoDelivery(customer.id)} className="dd-mobile-undo-btn">↩️</button>
                    </div>
                  )}
                  <div className="dd-mobile-customer-contact">
                    <a href={`tel:${customer.phone}`} className="dd-mobile-call-btn">📞</a>
                    <button 
                      onClick={() => {
                        const address = [customer.apartment, customer.flat_no, customer.area, 'Hyderabad'].filter(Boolean).join(', ');
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`, '_blank');
                      }}
                      className="dd-mobile-map-btn"
                    >🗺️</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="dd-mobile-bottom-nav">
        <button 
          className={`dd-nav-item ${activeNav === 'home' ? 'active' : ''}`}
          onClick={() => { setActiveNav('home'); setActiveTab('pending'); }}
        >
          <span className="dd-nav-icon">🏠</span>
          <span className="dd-nav-label">Home</span>
        </button>
        <button 
          className={`dd-nav-item ${activeNav === 'orders' ? 'active' : ''}`}
          onClick={() => { setActiveNav('orders'); }}
        >
          <span className="dd-nav-icon">📋</span>
          <span className="dd-nav-label">Orders</span>
        </button>
        <button 
          className={`dd-nav-item ${activeNav === 'profile' ? 'active' : ''}`}
          onClick={() => { setActiveNav('profile'); }}
        >
          <span className="dd-nav-icon">👤</span>
          <span className="dd-nav-label">Profile</span>
        </button>
      </div>

      {/* Profile View */}
      {activeNav === 'profile' && (
        <div className="dd-mobile-profile-overlay" onClick={() => setActiveNav('home')}>
          <div className="dd-mobile-profile-card" onClick={e => e.stopPropagation()}>
            <div className="dd-mobile-profile-header">
              <div className="dd-mobile-profile-avatar">
                {userData?.name?.charAt(0)?.toUpperCase() || 'D'}
              </div>
              <h3>{userData?.name || 'Delivery Boy'}</h3>
              <p>🛵 {userData?.vehicle || 'N/A'}</p>
            </div>
            <div className="dd-mobile-profile-details">
              <div className="dd-mobile-profile-row">
                <span>📱 Phone</span>
                <span>{userData?.phone || 'N/A'}</span>
              </div>
              <div className="dd-mobile-profile-row">
                <span>📍 Area</span>
                <span>{userData?.area || 'All Areas'}</span>
              </div>
              <div className="dd-mobile-profile-row">
                <span>🕐 Shift</span>
                <span>{userData?.shift || 'Morning'}</span>
              </div>
              <div className="dd-mobile-profile-row">
                <span>💰 Salary</span>
                <span>₹{userData?.salary || '0'}/mo</span>
              </div>
              <div className="dd-mobile-profile-row">
                <span>📅 Today</span>
                <span>{todayStats.deliveries}/{customers.length} done</span>
              </div>
              <div className="dd-mobile-profile-row">
                <span>💵 Collected</span>
                <span>₹{todayStats.collected}</span>
              </div>
            </div>
            <button className="dd-mobile-logout-btn" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </div>
      )}

      {/* Bottom padding for scroll */}
      <div style={{ height: '100px' }}></div>
    </div>
  );
};

export default DeliveryDashboard;