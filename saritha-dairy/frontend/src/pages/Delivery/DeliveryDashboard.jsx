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
  const [showProfile, setShowProfile] = useState(false);
  const [todayStats, setTodayStats] = useState({ deliveries: 0, collected: 0, pending: 0 });
  const [expandedApt, setExpandedApt] = useState(null);
  const [viewMode, setViewMode] = useState('apartments');
  const [deliveringId, setDeliveringId] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(null);
  const searchRef = useRef(null);

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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowQuickActions(null);
        setShowProfile(false);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
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
      console.error('❌ Error loading data:', error);
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
        
        // Haptic feedback-like animation
        if (navigator.vibrate) navigator.vibrate(50);
      } else {
        showMessage('error', data.error || 'Failed to record delivery');
      }
    } catch (error) {
      console.error('❌ Error:', error);
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
    setShowQuickActions(null);
  };

  const openGoogleMaps = (customer) => {
    const address = [customer.apartment, customer.flat_no, customer.area, customer.city || 'Hyderabad'].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`, '_blank');
    setShowQuickActions(null);
  };

  const callCustomer = (phone) => { 
    if (phone) window.open(`tel:${phone}`, '_self');
    setShowQuickActions(null);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };

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

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good Morning', icon: '🌅' };
    if (hour < 17) return { text: 'Good Afternoon', icon: '☀️' };
    return { text: 'Good Evening', icon: '🌙' };
  };

  const apartmentGroups = getApartmentGroups();
  const pendingCustomers = customers.filter(c => !c.delivered);
  const completedCustomers = customers.filter(c => c.delivered);
  const progressPercent = customers.length > 0 ? Math.round((completedCustomers.length / customers.length) * 100) : 0;
  const greeting = getGreeting();

  if (loading) {
    return (
      <div className="dd-loading-screen">
        <div className="dd-loader">
          <div className="dd-loader-icon">🛵</div>
          <div className="dd-loader-spinner"></div>
        </div>
        <p className="dd-loader-text">Loading your deliveries...</p>
      </div>
    );
  }

  return (
    <div className="dd-app">
      {/* Toast Notification */}
      {message && (
        <div className={`dd-toast ${message.type}`}>
          <span className="dd-toast-icon">{message.type === 'success' ? '✅' : '❌'}</span>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="dd-toast-close">×</button>
        </div>
      )}

      {/* Quick Action Modal */}
      {showQuickActions && (
        <div className="dd-quick-actions-overlay" onClick={() => setShowQuickActions(null)}>
          <div className="dd-quick-actions-modal" onClick={e => e.stopPropagation()}>
            <div className="dd-quick-actions-header">
              <div className="dd-quick-avatar">{showQuickActions.name?.charAt(0)}</div>
              <div>
                <h3>{showQuickActions.name}</h3>
                <p>{showQuickActions.flat_no ? `🚪 ${showQuickActions.flat_no}` : ''} {showQuickActions.apartment ? `🏢 ${showQuickActions.apartment}` : ''}</p>
              </div>
            </div>
            <div className="dd-quick-actions-grid">
              <button onClick={() => openGoogleMaps(showQuickActions)} className="dd-quick-action-btn">
                <span className="dd-quick-action-icon">🗺️</span>
                <span>Navigate</span>
              </button>
              <button onClick={() => callCustomer(showQuickActions.phone)} className="dd-quick-action-btn">
                <span className="dd-quick-action-icon">📞</span>
                <span>Call</span>
              </button>
              {!showQuickActions.delivered && (
                <button onClick={() => { markDelivered(showQuickActions.id); setShowQuickActions(null); }} className="dd-quick-action-btn primary">
                  <span className="dd-quick-action-icon">✅</span>
                  <span>Mark Done</span>
                </button>
              )}
              {showQuickActions.delivered && (
                <button onClick={() => undoDelivery(showQuickActions.id)} className="dd-quick-action-btn warning">
                  <span className="dd-quick-action-icon">↩️</span>
                  <span>Undo</span>
                </button>
              )}
            </div>
            <button onClick={() => setShowQuickActions(null)} className="dd-quick-actions-close">Close</button>
          </div>
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
              <div className="dd-greeting">
                <span>{greeting.icon}</span>
                <span>{greeting.text},</span>
              </div>
              <h2>{userData?.name || 'Delivery Boy'}</h2>
              <p>🛵 {userData?.vehicle || 'N/A'} • {userData?.shift || 'Morning'} Shift</p>
            </div>
          </div>
          <div className="dd-header-actions">
            <button onClick={() => searchRef.current?.focus()} className="dd-icon-btn" title="Search (Ctrl+K)">
              🔍
            </button>
            <button onClick={handleLogout} className="dd-icon-btn logout" title="Logout">
              🚪
            </button>
          </div>
        </div>
        
        {showProfile && (
          <div className="dd-profile-popup">
            <div className="dd-profile-grid">
              <div className="dd-profile-row"><span>📱</span><span>{userData?.phone}</span></div>
              <div className="dd-profile-row"><span>📧</span><span>{userData?.email || 'N/A'}</span></div>
              <div className="dd-profile-row"><span>🛵</span><span>{userData?.vehicle} ({userData?.vehicleNo})</span></div>
              <div className="dd-profile-row"><span>📍</span><span>{userData?.area || 'All Areas'}</span></div>
              <div className="dd-profile-row"><span>💰</span><span>₹{userData?.salary || '0'}/mo</span></div>
            </div>
            <button onClick={() => setShowProfile(false)} className="dd-close-profile">Close</button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="dd-stats-grid">
        <div className="dd-stat-card total">
          <div className="dd-stat-card-icon">📋</div>
          <div className="dd-stat-card-content">
            <span className="dd-stat-card-value">{customers.length}</span>
            <span className="dd-stat-card-label">Total</span>
          </div>
        </div>
        <div className="dd-stat-card pending">
          <div className="dd-stat-card-icon">⏳</div>
          <div className="dd-stat-card-content">
            <span className="dd-stat-card-value">{todayStats.pending}</span>
            <span className="dd-stat-card-label">Pending</span>
          </div>
        </div>
        <div className="dd-stat-card done">
          <div className="dd-stat-card-icon">✅</div>
          <div className="dd-stat-card-content">
            <span className="dd-stat-card-value">{todayStats.deliveries}</span>
            <span className="dd-stat-card-label">Done</span>
          </div>
        </div>
        <div className="dd-stat-card amount">
          <div className="dd-stat-card-icon">💰</div>
          <div className="dd-stat-card-content">
            <span className="dd-stat-card-value">₹{todayStats.collected}</span>
            <span className="dd-stat-card-label">Collected</span>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="dd-progress-section">
        <div className="dd-progress-header">
          <span>📊 Today's Progress</span>
          <span className="dd-progress-percent">{progressPercent}%</span>
        </div>
        <div className="dd-progress-track">
          <div className={`dd-progress-fill ${progressPercent === 100 ? 'complete' : ''}`} style={{ width: `${progressPercent}%` }}>
            {progressPercent > 15 && <span className="dd-progress-text-inner">{completedCustomers.length}/{customers.length}</span>}
          </div>
        </div>
        {progressPercent === 100 && (
          <div className="dd-complete-badge">🎉 All deliveries completed!</div>
        )}
      </div>

      {/* Search & Controls */}
      <div className="dd-controls-bar">
        <div className="dd-search-wrapper">
          <span className="dd-search-icon">🔍</span>
          <input 
            ref={searchRef}
            type="text" 
            placeholder="Search customers, apartments..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="dd-search-input"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="dd-search-clear">×</button>
          )}
          <span className="dd-search-shortcut">Ctrl+K</span>
        </div>
        <div className="dd-controls-right">
          <button 
            className={`dd-view-toggle ${viewMode === 'apartments' ? 'active' : ''}`}
            onClick={() => setViewMode('apartments')}
            title="Grouped View"
          >
            🏢
          </button>
          <button 
            className={`dd-view-toggle ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            📋
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="dd-tabs-row">
        <button 
          className={`dd-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => { setActiveTab('pending'); setExpandedApt(null); }}
        >
          <span>⏳ Pending</span>
          <span className="dd-tab-count">{pendingCustomers.length}</span>
        </button>
        <button 
          className={`dd-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => { setActiveTab('completed'); setExpandedApt(null); }}
        >
          <span>✅ Done</span>
          <span className="dd-tab-count">{completedCustomers.length}</span>
        </button>
      </div>

      {/* Customer List */}
      <div className="dd-customers-container">
        {viewMode === 'apartments' ? (
          // APARTMENT GROUPED VIEW
          apartmentGroups.length === 0 ? (
            <div className="dd-empty-state">
              <div className="dd-empty-icon">{activeTab === 'pending' ? '🎉' : '📭'}</div>
              <h3>{activeTab === 'pending' ? 'All Caught Up!' : 'No Deliveries Yet'}</h3>
              <p>{activeTab === 'pending' ? 'Great job! All deliveries completed.' : 'Start delivering to see completed items.'}</p>
            </div>
          ) : (
            apartmentGroups.map(([apartment, aptCustomers]) => {
              const allDelivered = aptCustomers.every(c => c.delivered);
              const pendingCount = aptCustomers.filter(c => !c.delivered).length;
              const aptTotal = aptCustomers.reduce((s, c) => {
                const prods = c.products || [];
                return s + prods.reduce((ps, p) => ps + ((p.price || 0) * (p.quantity || p.quantity_per_day || 1)), 0);
              }, 0);
              const isExpanded = expandedApt === apartment;

              return (
                <div key={apartment} className={`dd-apt-card ${allDelivered ? 'all-done' : ''} ${isExpanded ? 'expanded' : ''}`}>
                  <div 
                    className="dd-apt-header"
                    onClick={() => setExpandedApt(isExpanded ? null : apartment)}
                  >
                    <div className="dd-apt-info">
                      <span className="dd-apt-icon">🏢</span>
                      <div>
                        <strong>{apartment}</strong>
                        <span className="dd-apt-meta">{aptCustomers.length} flats • ₹{aptTotal}</span>
                      </div>
                    </div>
                    <div className="dd-apt-status">
                      {!allDelivered && pendingCount > 0 && (
                        <span className="dd-apt-badge pending">{pendingCount} left</span>
                      )}
                      {allDelivered && (
                        <span className="dd-apt-badge done">All Done ✅</span>
                      )}
                      <span className={`dd-apt-arrow ${isExpanded ? 'up' : ''}`}>▼</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="dd-apt-customers">
                      {aptCustomers.map(customer => {
                        const products = customer.products || [];
                        const totalAmount = products.reduce((s, p) => s + ((p.price || 0) * (p.quantity || p.quantity_per_day || 1)), 0);
                        
                        return (
                          <div 
                            key={customer.id} 
                            className={`dd-customer-row ${customer.delivered ? 'delivered' : ''} ${deliveringId === customer.id ? 'delivering' : ''}`}
                            onClick={() => setShowQuickActions(customer)}
                          >
                            <div className="dd-customer-avatar">
                              <span>{customer.name?.charAt(0)?.toUpperCase()}</span>
                              {customer.delivered && <span className="dd-check-badge">✓</span>}
                            </div>
                            
                            <div className="dd-customer-info">
                              <div className="dd-customer-name-row">
                                <strong>{customer.name}</strong>
                                <span className="dd-customer-amount">₹{totalAmount}</span>
                              </div>
                              <div className="dd-customer-meta">
                                <span>🚪 {customer.flat_no || 'N/A'}</span>
                                <span>📱 {customer.phone}</span>
                              </div>
                              {products.length > 0 && (
                                <div className="dd-customer-products">
                                  {products.map((p, i) => (
                                    <span key={i} className="dd-product-tag">
                                      {p.product_name} ×{p.quantity || p.quantity_per_day || 1}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="dd-customer-actions">
                              {!customer.delivered ? (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); markDelivered(customer.id); }}
                                  className={`dd-deliver-btn ${deliveringId === customer.id ? 'loading' : ''}`}
                                  disabled={deliveringId === customer.id}
                                >
                                  {deliveringId === customer.id ? '⏳' : '✓'}
                                </button>
                              ) : (
                                <span className="dd-done-badge">✅ Done</span>
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
          )
        ) : (
          // LIST VIEW
          (activeTab === 'pending' ? pendingCustomers : completedCustomers).filter(c =>
            (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.phone || '').includes(searchTerm) ||
            (c.apartment || '').toLowerCase().includes(searchTerm.toLowerCase())
          ).length === 0 ? (
            <div className="dd-empty-state">
              <div className="dd-empty-icon">{activeTab === 'pending' ? '🎉' : '📭'}</div>
              <h3>{activeTab === 'pending' ? 'All Caught Up!' : 'No Deliveries'}</h3>
            </div>
          ) : (
            (activeTab === 'pending' ? pendingCustomers : completedCustomers)
              .filter(c =>
                (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.phone || '').includes(searchTerm) ||
                (c.apartment || '').toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map(customer => {
                const products = customer.products || [];
                const totalAmount = products.reduce((s, p) => s + ((p.price || 0) * (p.quantity || p.quantity_per_day || 1)), 0);

                return (
                  <div 
                    key={customer.id} 
                    className={`dd-customer-row list-view ${customer.delivered ? 'delivered' : ''}`}
                    onClick={() => setShowQuickActions(customer)}
                  >
                    <div className="dd-customer-avatar">
                      <span>{customer.name?.charAt(0)?.toUpperCase()}</span>
                      {customer.delivered && <span className="dd-check-badge">✓</span>}
                    </div>
                    
                    <div className="dd-customer-info">
                      <div className="dd-customer-name-row">
                        <strong>{customer.name}</strong>
                        <span className="dd-customer-amount">₹{totalAmount}</span>
                      </div>
                      <div className="dd-customer-meta">
                        <span>🏢 {customer.apartment}</span>
                        <span>🚪 {customer.flat_no || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="dd-customer-actions">
                      {!customer.delivered ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); markDelivered(customer.id); }}
                          className="dd-deliver-btn"
                        >
                          ✓
                        </button>
                      ) : (
                        <span className="dd-done-badge">✅</span>
                      )}
                    </div>
                  </div>
                );
              })
          )
        )}
      </div>

      {/* Bottom Padding for scroll */}
      <div style={{ height: '80px' }}></div>
    </div>
  );
};

export default DeliveryDashboard;