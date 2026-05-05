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
  const [todayStats, setTodayStats] = useState({ deliveries: 0, collected: 0, pending: 0 });
  const [deliveringId, setDeliveringId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [expandedApt, setExpandedApt] = useState(null);
  const [extraOrdersCount, setExtraOrdersCount] = useState(0);
  const [showOrdersBanner, setShowOrdersBanner] = useState(true);

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
      
      const todayRes = await fetch(`${API_URL}/delivery/today/${boyId}`, { headers: getAuthHeaders() });
      const todayData = await todayRes.json();
      const todayDeliveries = todayData.success ? todayData.data : [];

      let preferencesMap = {};
      try {
        const prefsRes = await fetch(`${API_URL}/customer-preferences/all/list`, {
          headers: getAuthHeaders()
        });
        const prefsData = await prefsRes.json();
        if (prefsData.success && prefsData.data) {
          prefsData.data.forEach(p => {
            preferencesMap[p.customer_id] = {
              wantMilk: p.want_milk,
              quantity: p.quantity || 2,
              packSize: p.pack_size || '500ml',
              skipDays: Array.isArray(p.skip_days) ? p.skip_days : 
                (typeof p.skip_days === 'string' ? JSON.parse(p.skip_days) : []),
              extraOrders: Array.isArray(p.extra_orders) ? p.extra_orders :
                (typeof p.extra_orders === 'string' ? JSON.parse(p.extra_orders) : [])
            };
          });
        }
      } catch (e) { console.log('Preferences not available'); }

      let extraOrdersMap = {};
      let totalExtraOrders = 0;
      try {
        const ordersRes = await fetch(`${API_URL}/customer-preferences/extra-orders/all`, {
          headers: getAuthHeaders()
        });
        const ordersData = await ordersRes.json();
        if (ordersData.success && ordersData.data) {
          ordersData.data.forEach(o => {
            extraOrdersMap[o.customerId] = o.orders;
            totalExtraOrders += o.orders.length;
          });
          setExtraOrdersCount(totalExtraOrders);
        }
      } catch (e) { console.log('Extra orders not available'); }

      if (custData.success && custData.data) {
        const enriched = custData.data.map(c => {
          const deliveredToday = todayDeliveries.some(d => d.customer_id == c.id);
          const deliveryInfo = todayDeliveries.find(d => d.customer_id == c.id);
          return { 
            ...c, 
            delivered: deliveredToday, 
            deliveryData: deliveryInfo || null, 
            products: c.products || [],
            preferences: preferencesMap[c.id] || { wantMilk: true, quantity: 2, packSize: '500ml', skipDays: [] },
            extraOrders: extraOrdersMap[c.id] || []
          };
        });

        enriched.sort((a, b) => {
          if (a.delivered === b.delivered) return (a.apartment || '').localeCompare(b.apartment || '');
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
      showMessage('error', 'Failed to load data');
    }
    setLoading(false);
  };

  const markDelivered = async (customerId) => {
    const customer = customers.find(c => c.id == customerId);
    if (!customer || deliveringId) return;

    if (isPaused(customer)) {
      showMessage('error', `⚠️ ${customer.name} has PAUSED milk delivery! Do NOT deliver.`);
      return;
    }
    if (isSkipDay(customer)) {
      showMessage('error', `⚠️ Today is SKIP DAY for ${customer.name}! Do NOT deliver.`);
      return;
    }

    setDeliveringId(customerId);
    const products = customer.products || [];
    const totalAmount = products.reduce((s, p) => s + ((p.price || 0) * (p.quantity || p.quantity_per_day || 1)), 0);

    try {
      const response = await fetch(`${API_URL}/delivery/record`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          customer_id: parseInt(customerId),
          delivery_boy_id: parseInt(userData?.id),
          delivery_date: new Date().toISOString().split('T')[0],
          products: products.map(p => ({
            product_name: p.product_name, pack_size: p.pack_size,
            quantity: parseInt(p.quantity || p.quantity_per_day || 1), price: parseFloat(p.price || 0)
          })),
          status: 'delivered', total_amount: totalAmount
        })
      });

      const data = await response.json();
      if (data.success) {
        // ✅ Mark extra orders as delivered by clearing them from database
        if (customer.extraOrders && customer.extraOrders.length > 0) {
          try {
            await fetch(`${API_URL}/customer-preferences/${customerId}`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                wantMilk: customer.preferences?.wantMilk ?? true,
                quantity: customer.preferences?.quantity ?? 2,
                packSize: customer.preferences?.packSize ?? '500ml',
                skipDays: customer.preferences?.skipDays || [],
                extraOrders: [] // ✅ Clear orders = delivered
              })
            });
            console.log('✅ Extra orders cleared for customer:', customer.name);
          } catch (e) {
            console.log('Failed to clear extra orders:', e);
          }
        }

        setCustomers(prev => {
          const updated = prev.map(c => c.id == customerId 
            ? { ...c, delivered: true, deliveryData: { total_amount: totalAmount }, extraOrders: [] } 
            : c);
          const done = updated.filter(c => c.delivered);
          setTodayStats({ 
            deliveries: done.length, 
            collected: done.reduce((s, c) => s + (parseFloat(c.deliveryData?.total_amount) || 0), 0), 
            pending: updated.filter(c => !c.delivered).length 
          });
          // Update extra orders count
          const remainingOrders = updated.reduce((s, c) => s + (c.extraOrders?.length || 0), 0);
          setExtraOrdersCount(remainingOrders);
          return updated;
        });
        showMessage('success', `✅ Delivered to ${customer.name}`);
      } else {
        showMessage('error', data.error || 'Failed');
      }
    } catch (error) {
      showMessage('error', 'Connection failed');
    }
    setDeliveringId(null);
  };

  const undoDelivery = (customerId) => {
    setCustomers(prev => {
      const updated = prev.map(c => c.id == customerId ? { ...c, delivered: false, deliveryData: null } : c);
      const done = updated.filter(c => c.delivered);
      setTodayStats({ deliveries: done.length, collected: done.reduce((s, c) => s + (parseFloat(c.deliveryData?.total_amount) || 0), 0), pending: updated.filter(c => !c.delivered).length });
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
    if (hour < 12) return { text: 'Good Morning', icon: '🌅', timeOfDay: 'morning' };
    if (hour < 17) return { text: 'Good Afternoon', icon: '☀️', timeOfDay: 'afternoon' };
    return { text: 'Good Evening', icon: '🌙', timeOfDay: 'evening' };
  };

  const getApartmentIcon = (name) => {
    const icons = { 'A': '🏢', 'B': '🏬', 'C': '🏗️', 'D': '🏘️', '1': '🏠', '2': '🏡', '3': '🏘️', '4': '🏚️' };
    return icons[name?.charAt(0)?.toUpperCase()] || '🏢';
  };

  const getApartmentGradient = (group) => {
    if (group.pendingCount === 0) return 'linear-gradient(135deg, #e8f5e9, #c8e6c9)';
    if (group.completedCount > 0) return 'linear-gradient(135deg, #fff8e1, #ffecb3)';
    return 'linear-gradient(135deg, #f5f5f5, #eeeeee)';
  };

  const isPaused = (customer) => customer.preferences && customer.preferences.wantMilk === false;

  const getMilkQuantity = (customer) => {
    if (!customer.preferences) return '';
    if (!customer.preferences.wantMilk) return '⏸️ Paused';
    return `${customer.preferences.quantity || 2} × ${customer.preferences.packSize || '500ml'}`;
  };

  const isSkipDay = (customer) => {
    if (!customer.preferences?.skipDays?.length) return false;
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    return customer.preferences.skipDays.includes(today);
  };

  const pendingCustomers = customers.filter(c => !c.delivered);
  const completedCustomers = customers.filter(c => c.delivered);
  const progressPercent = customers.length > 0 ? Math.round((completedCustomers.length / customers.length) * 100) : 0;
  const greeting = getGreeting();

  const displayCustomers = activeTab === 'pending' ? pendingCustomers : completedCustomers;
  const filteredCustomers = displayCustomers.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm) ||
    (c.apartment || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.flat_no || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const apartmentGroups = (() => {
    const grouped = {};
    filteredCustomers.forEach(c => {
      const apt = c.apartment || 'Other';
      if (!grouped[apt]) grouped[apt] = { name: apt, customers: [], totalAmount: 0, completedCount: 0, pendingCount: 0, flats: [] };
      const products = c.products || [];
      const customerTotal = products.reduce((s, p) => s + ((p.price || 0) * (p.quantity || p.quantity_per_day || 1)), 0);
      grouped[apt].customers.push(c);
      grouped[apt].totalAmount += customerTotal;
      grouped[apt].flats.push(c.flat_no || 'N/A');
      if (c.delivered) grouped[apt].completedCount++;
      else grouped[apt].pendingCount++;
    });
    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
  })();

  if (loading) {
    return (
      <div className="dd-pro-loading">
        <div className="dd-pro-loading-animation">
          <div className="dd-pro-scooter">🛵</div>
          <div className="dd-pro-road"></div>
        </div>
        <p>Loading your route...</p>
      </div>
    );
  }

  return (
    <div className={`dd-pro-app ${greeting.timeOfDay}`}>
      {/* Toast */}
      {message && (
        <div className={`dd-pro-toast ${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* ✅ MORNING BANNER */}
      {showOrdersBanner && extraOrdersCount > 0 && (
        <div className="dd-pro-morning-banner">
          <div className="dd-pro-banner-content">
            <span className="dd-pro-banner-icon">🌅</span>
            <div className="dd-pro-banner-text">
              <strong>Good Morning! {extraOrdersCount} extra product orders today</strong>
              <p>Customers ordered additional items. Check below for details.</p>
            </div>
            <button onClick={() => setShowOrdersBanner(false)} className="dd-pro-banner-close">×</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="dd-pro-header">
        <div className="dd-pro-header-left">
          <div className="dd-pro-avatar-wrapper" onClick={() => setShowProfile(!showProfile)}>
            <div className="dd-pro-avatar">{userData?.name?.charAt(0)?.toUpperCase() || 'D'}</div>
            <div className="dd-pro-avatar-ring" style={{ background: `conic-gradient(#4caf50 ${progressPercent * 3.6}deg, #e0e0e0 ${progressPercent * 3.6}deg)` }}></div>
          </div>
          <div>
            <p className="dd-pro-greeting">{greeting.icon} {greeting.text}</p>
            <h2>{userData?.name || 'Delivery Partner'}</h2>
          </div>
        </div>
        <div className="dd-pro-header-right">
          <button className="dd-pro-notif-btn">
            🔔
            {(todayStats.pending + extraOrdersCount) > 0 && 
              <span className="dd-pro-notif-badge">{todayStats.pending + extraOrdersCount}</span>}
          </button>
        </div>
      </div>

      {/* Profile Popup */}
      {showProfile && (
        <div className="dd-pro-profile-card">
          <div className="dd-pro-profile-top">
            <div className="dd-pro-profile-avatar">{userData?.name?.charAt(0)?.toUpperCase()}</div>
            <h3>{userData?.name}</h3>
            <p>🛵 {userData?.vehicle} • {userData?.shift} Shift</p>
          </div>
          <div className="dd-pro-profile-stats-row">
            <div className="dd-pro-profile-stat"><span>📱</span><span>{userData?.phone}</span></div>
            <div className="dd-pro-profile-stat"><span>📍</span><span>{userData?.area || 'All'}</span></div>
            <div className="dd-pro-profile-stat"><span>💰</span><span>₹{userData?.salary}/mo</span></div>
          </div>
          <button onClick={handleLogout} className="dd-pro-logout-btn">🚪 Logout</button>
        </div>
      )}

      {/* Stats Card */}
      <div className="dd-pro-main-card">
        <div className="dd-pro-main-card-header">
          <div><h3>Today's Route</h3><p>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p></div>
          <div className="dd-pro-progress-circle">
            <svg viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="25" fill="none" stroke="#e0e0e0" strokeWidth="6" />
              <circle cx="30" cy="30" r="25" fill="none" stroke="#4caf50" strokeWidth="6" strokeDasharray={`${progressPercent * 1.57} 157`} strokeLinecap="round" transform="rotate(-90 30 30)" />
            </svg>
            <span className="dd-pro-progress-text">{progressPercent}%</span>
          </div>
        </div>
        <div className="dd-pro-stats-row">
          <div className="dd-pro-stat-item"><div className="dd-pro-stat-icon" style={{background:'#f0fdf4'}}>📦</div><span className="dd-pro-stat-value">{customers.length}</span><span className="dd-pro-stat-label">Total</span></div>
          <div className="dd-pro-stat-item"><div className="dd-pro-stat-icon" style={{background:'#fff3e0'}}>⏳</div><span className="dd-pro-stat-value">{todayStats.pending}</span><span className="dd-pro-stat-label">Pending</span></div>
          <div className="dd-pro-stat-item"><div className="dd-pro-stat-icon" style={{background:'#e8f5e9'}}>✅</div><span className="dd-pro-stat-value">{todayStats.deliveries}</span><span className="dd-pro-stat-label">Done</span></div>
          <div className="dd-pro-stat-item"><div className="dd-pro-stat-icon" style={{background:'#e3f2fd'}}>💰</div><span className="dd-pro-stat-value">₹{todayStats.collected}</span><span className="dd-pro-stat-label">Cash</span></div>
        </div>
        <div className="dd-pro-bar-wrapper">
          <div className="dd-pro-bar">
            <div className="dd-pro-bar-fill" style={{ width: `${progressPercent}%` }}>{progressPercent > 0 && <span className="dd-pro-bar-emoji">🛵</span>}</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dd-pro-quick-actions">
        <button className="dd-pro-quick-btn" onClick={() => setActiveTab('pending')}><span>🚀</span> Start Delivery</button>
        <button className="dd-pro-quick-btn" onClick={() => window.open('https://maps.google.com', '_blank')}><span>🗺️</span> View Route</button>
      </div>

      {/* Search */}
      <div className="dd-pro-search">
        <span>🔍</span>
        <input type="text" placeholder="Search customers, apartments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <button onClick={() => setSearchTerm('')}>×</button>}
      </div>

      {/* Tabs */}
      <div className="dd-pro-tabs">
        <button className={`dd-pro-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>⏳ Pending ({pendingCustomers.length})</button>
        <button className={`dd-pro-tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>✅ Done ({completedCustomers.length})</button>
      </div>

      {/* Customer List */}
      <div className="dd-pro-customer-list">
        {apartmentGroups.length === 0 ? (
          <div className="dd-pro-empty">
            <div className="dd-pro-empty-animation"><span>{activeTab === 'pending' ? '🎉' : '📭'}</span><div className="dd-pro-empty-ripple"></div></div>
            <h3>{activeTab === 'pending' ? 'All Caught Up!' : 'No Deliveries'}</h3>
            <p>{activeTab === 'pending' ? 'Great job! ☕' : 'Start your deliveries'}</p>
          </div>
        ) : (
          apartmentGroups.map((group, groupIndex) => {
            const isExpanded = expandedApt === group.name;
            const completionPercent = group.customers.length > 0 ? Math.round((group.completedCount / group.customers.length) * 100) : 0;
            const allDone = group.pendingCount === 0;

            return (
              <div key={group.name} className={`dd-pro-apt-building ${isExpanded ? 'expanded' : ''} ${allDone ? 'completed' : ''}`} style={{ animationDelay: `${groupIndex * 0.05}s` }}>
                <div className="dd-pro-building-header" onClick={() => setExpandedApt(isExpanded ? null : group.name)} style={{ background: getApartmentGradient(group) }}>
                  <div className="dd-pro-building-icon-wrapper">
                    <span className="dd-pro-building-icon">{getApartmentIcon(group.name)}</span>
                    {!allDone && group.pendingCount > 0 && <span className="dd-pro-building-pulse"></span>}
                  </div>
                  <div className="dd-pro-building-info">
                    <div className="dd-pro-building-name-row"><h3>{group.name}</h3><span className={`dd-pro-building-status ${allDone ? 'done' : 'active'}`}>{allDone ? '✅' : '🟢'}</span></div>
                    <div className="dd-pro-building-stats-row">
                      <span className="dd-pro-building-stat">📦 {group.customers.length}</span>
                      <span className="dd-pro-building-stat">⏳ {group.pendingCount}</span>
                      <span className="dd-pro-building-stat">💰 ₹{group.totalAmount}</span>
                    </div>
                  </div>
                  <div className="dd-pro-building-right">
                    <div className="dd-pro-mini-progress">
                      <svg viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="18" fill="none" stroke="#e0e0e0" strokeWidth="3" />
                        <circle cx="22" cy="22" r="18" fill="none" stroke={allDone ? '#4caf50' : '#ff9800'} strokeWidth="3" strokeDasharray={`${completionPercent * 1.13} 113`} strokeLinecap="round" transform="rotate(-90 22 22)" />
                      </svg>
                      <span className="dd-pro-mini-percent">{completionPercent}%</span>
                    </div>
                    <span className={`dd-pro-expand-icon ${isExpanded ? 'rotated' : ''}`}>▼</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="dd-pro-simple-list-container">
                    {group.customers.map((customer, index) => {
                      const products = customer.products || [];
                      const productDisplay = products.map(p => `${p.pack_size || ''} ${p.product_name}`).join(', ') || 'No items';
                      const milkQty = getMilkQuantity(customer);
                      const paused = isPaused(customer);
                      const skipDay = isSkipDay(customer);
                      const shouldBlockDelivery = paused || skipDay;
                      
                      return (
                        <div key={customer.id} className={`dd-pro-list-row ${customer.delivered ? 'done' : ''} ${paused ? 'paused' : ''} ${skipDay ? 'skip' : ''}`}>
                          <div className="dd-pro-list-left">
                            <div className="dd-pro-list-avatar" style={{ background: paused ? '#ef4444' : skipDay ? '#f59e0b' : customer.delivered ? '#4caf50' : '#667eea' }}>
                              {customer.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="dd-pro-list-info">
                              <h4>
                                {customer.name}
                                {paused && <span className="dd-pro-pause-badge">⏸️ Paused</span>}
                                {skipDay && !paused && <span className="dd-pro-skip-badge">🚫 Skip Today</span>}
                              </h4>
                              <p>🚪 {customer.flat_no || 'N/A'}, {customer.apartment}</p>
                              {milkQty && <p className="dd-pro-milk-pref">🥛 {milkQty}</p>}
                              
                              {/* ✅ EXTRA ORDERS */}
                              {customer.extraOrders && customer.extraOrders.length > 0 && (
                                <div className="dd-pro-extra-orders">
                                  <span className="dd-pro-extra-label">📦 Orders:</span>
                                  {customer.extraOrders.map((order, i) => (
                                    <span key={i} className="dd-pro-extra-tag">
                                      {order.productName} ({order.packSize}) ×{order.quantity}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="dd-pro-list-center">
                            {shouldBlockDelivery ? (
                              <span className="dd-pro-list-warning">{paused ? '⏸️ Milk Paused' : '🚫 Skip Day'}</span>
                            ) : (
                              <span className="dd-pro-list-product">{productDisplay}</span>
                            )}
                          </div>

                          <div className="dd-pro-list-right">
                            <div className="dd-pro-list-status-row">
                              {paused ? <span className="dd-pro-list-status paused">⏸️ Paused</span> :
                               skipDay ? <span className="dd-pro-list-status skip">🚫 Skip</span> :
                               customer.delivered ? <span className="dd-pro-list-status done">✅ Done</span> :
                               <span className="dd-pro-list-status pending">⏳ Pending</span>}
                            </div>
                            <div className="dd-pro-list-action-row">
                              <a href={`tel:${customer.phone}`} className="dd-pro-list-icon-btn" title="Call">📞</a>
                              <button onClick={() => { const addr = [customer.apartment, customer.flat_no, customer.area, 'Hyderabad'].filter(Boolean).join(', '); window.open(`https://maps.google.com/?q=${encodeURIComponent(addr)}`, '_blank'); }} className="dd-pro-list-icon-btn" title="Directions">🗺️</button>
                              {shouldBlockDelivery && !customer.delivered ? (
                                <button onClick={() => { if (paused) showMessage('error', `⚠️ ${customer.name} has PAUSED milk!`); else showMessage('error', `⚠️ Skip day for ${customer.name}!`); }} className="dd-pro-list-blocked-btn" title="DO NOT DELIVER">🚫</button>
                              ) : !customer.delivered ? (
                                <button onClick={() => markDelivered(customer.id)} className="dd-pro-list-deliver-btn" disabled={deliveringId === customer.id}>{deliveringId === customer.id ? '⏳' : '✓'}</button>
                              ) : (
                                <button onClick={() => undoDelivery(customer.id)} className="dd-pro-list-undo-btn" title="Undo">↩</button>
                              )}
                            </div>
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
      <div style={{ height: '100px' }}></div>
    </div>
  );
};

export default DeliveryDashboard;