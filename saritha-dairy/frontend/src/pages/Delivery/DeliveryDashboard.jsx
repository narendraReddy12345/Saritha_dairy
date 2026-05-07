// src/pages/Delivery/DeliveryDashboard.jsx

import React, { useEffect, useState } from 'react';
import './DeliveryDashboard.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const DeliveryDashboard = () => {

  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [expandedApartments, setExpandedApartments] = useState({});
  const [deliveringId, setDeliveringId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [todayStats, setTodayStats] = useState({
    deliveries: 0,
    pending: 0,
    collected: 0
  });

  const getUserData = () => {
    try {
      return JSON.parse(sessionStorage.getItem('userData'));
    } catch {
      return null;
    }
  };

  const userData = getUserData();
  const getToken = () => sessionStorage.getItem('authToken');

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`
  });

  // ✅ Format product display with pack size
  const formatProductDisplay = (product) => {
    const packSize = product.pack_size || '';
    const productName = product.product_name || '';
    const quantity = product.quantity || 1;
    
    // Format like "Milk 500ml ×1"
    if (packSize) {
      return `${productName} ${packSize} ×${quantity}`;
    }
    return `${productName} ×${quantity}`;
  };

  // Calculate customer total amount
  const getCustomerTotal = customer => {
    return (customer.products || []).reduce(
      (sum, p) =>
        sum +
        ((p.price || 0) * (p.quantity || 1)),
      0
    );
  };

  useEffect(() => {
    if (!userData?.id) {
      window.location.href = '/login';
      return;
    }
    loadCustomers();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/delivery-boys/${userData.id}/customers`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      if (data.success) {
        const customersData = data.data || [];
        setCustomers(customersData);
        
        // Calculate stats from data
        const deliveredCustomers = customersData.filter(c => c.delivered);
        const deliveredCount = deliveredCustomers.length;
        const pendingCount = customersData.filter(c => !c.delivered).length;
        const collectedAmount = deliveredCustomers.reduce((sum, customer) => {
          return sum + getCustomerTotal(customer);
        }, 0);
        
        setTodayStats({
          deliveries: deliveredCount,
          pending: pendingCount,
          collected: collectedAmount
        });
      }
    } catch (err) {
      showMessage('error', 'Failed to load customers');
    }
    setLoading(false);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 2500);
  };

  // MARK DELIVERED - SAVE TO DATABASE
  const markDelivered = async (customerId) => {
    if (deliveringId) return;
    setDeliveringId(customerId);

    try {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) {
        showMessage('error', 'Customer not found');
        setDeliveringId(null);
        return;
      }

      const customerAmount = getCustomerTotal(customer);
      
      const products = (customer.products || []).map(product => ({
        product_name: product.product_name,
        pack_size: product.pack_size || '',
        quantity: product.quantity || 1,
        price: product.price || 0,
        total: (product.price || 0) * (product.quantity || 1)
      }));

      const response = await fetch(`${API_URL}/delivery/record`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          customer_id: customerId,
          delivery_boy_id: userData.id,
          products: products,
          status: 'delivered',
          total_amount: customerAmount
        })
      });

      const result = await response.json();

      if (result.success) {
        setCustomers(prev =>
          prev.map(c =>
            c.id === customerId
              ? { ...c, delivered: true }
              : c
          )
        );

        setTodayStats(prev => ({
          deliveries: prev.deliveries + 1,
          pending: prev.pending - 1,
          collected: prev.collected + customerAmount
        }));

        showMessage('success', '✅ Delivery Completed & Saved!');
      } else {
        showMessage('error', result.error || 'Failed to save delivery');
      }
    } catch (error) {
      console.error('Error marking delivered:', error);
      showMessage('error', 'Network error. Please try again.');
    } finally {
      setDeliveringId(null);
    }
  };

  // UNDO DELIVERY
  const undoDelivery = async (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    const customerAmount = getCustomerTotal(customer);

    try {
      const deliveriesRes = await fetch(`${API_URL}/delivery/today/${userData.id}`, {
        headers: getAuthHeaders()
      });
      const deliveriesData = await deliveriesRes.json();
      
      if (deliveriesData.success) {
        const deliveryRecord = deliveriesData.data.find(d => d.customer_id === customerId);
        if (deliveryRecord) {
          await fetch(`${API_URL}/delivery/${deliveryRecord.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
        }
      }

      setCustomers(prev =>
        prev.map(c =>
          c.id === customerId
            ? { ...c, delivered: false }
            : c
        )
      );

      setTodayStats(prev => ({
        deliveries: prev.deliveries - 1,
        pending: prev.pending + 1,
        collected: prev.collected - customerAmount
      }));

      showMessage('success', '↩ Delivery Undone');
    } catch (error) {
      console.error('Error undoing delivery:', error);
      showMessage('error', 'Failed to undo delivery');
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = '/login';
  };

  const toggleApartment = (key) => {
    setExpandedApartments(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return '🌅 Good Morning';
    if (hour < 17) return '☀️ Good Afternoon';
    return '🌙 Good Evening';
  };

  const openMap = (customer) => {
    const address = `${customer.apartment || ''}, ${customer.colony || ''}, ${customer.area || ''}, Hyderabad`.trim();
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(mapsUrl, '_blank');
  };

  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.flat_no || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCustomers = filteredCustomers.filter(c => !c.delivered);
  const completedCustomers = filteredCustomers.filter(c => c.delivered);

  const groupCustomers = list => {
    const groups = {};
    list.forEach(customer => {
      const apartment = customer.apartment || customer.colony || customer.area || 'Other Area';
      if (!groups[apartment]) {
        groups[apartment] = {
          name: apartment,
          customers: [],
          totalAmount: 0
        };
      }
      groups[apartment].customers.push(customer);
      groups[apartment].totalAmount += getCustomerTotal(customer);
    });
    return Object.values(groups);
  };

  const pendingGroups = groupCustomers(pendingCustomers);
  const completedGroups = groupCustomers(completedCustomers);
  const allDeliveriesCompleted = todayStats.pending === 0 && customers.length > 0;

  if (loading) {
    return (
      <div className="dd-loading">
        <div className="dd-loading-bike">🛵</div>
        <h2>Loading Dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="dd-app">
      <div className="dd-bg-circle one"></div>
      <div className="dd-bg-circle two"></div>

      {message && (
        <div className={`dd-toast ${message.type}`}>
          {message.text}
        </div>
      )}

      <header className="dd-header">
        <div className="dd-user">
          <div className="dd-avatar">
            {userData?.name?.charAt(0)}
          </div>
          <div>
            <small>{getGreeting()}</small>
            <h2>{userData?.name || 'Delivery Partner'}</h2>
          </div>
        </div>
        <button className="dd-logout-btn" onClick={handleLogout} title="Logout">
          🚪 Logout
        </button>
      </header>

      {activeTab !== 'home' && (
        <div className="dd-search-box">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search by name or flat number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {allDeliveriesCompleted && activeTab === 'delivery' && (
        <div className="dd-completion-message">
          <div className="completion-icon">🎉</div>
          <div className="completion-content">
            <h3>Congratulations! 🎊</h3>
            <p>All deliveries have been completed for today!</p>
            <div className="completion-stats">
              <span>✅ {todayStats.deliveries} Deliveries</span>
              <span>💰 ₹{todayStats.collected} Collected</span>
            </div>
            <button className="completion-btn" onClick={() => setActiveTab('history')}>
              View History →
            </button>
          </div>
        </div>
      )}

      {/* HOME TAB */}
      {activeTab === 'home' && (
        <>
          <div className="dd-banner">
            <div>
              <h1>🚚 Delivery Dashboard</h1>
              <p>Manage deliveries smartly</p>
            </div>
            <div className="dd-banner-icon">🛵</div>
          </div>
          <div className="dd-stats-grid">
            <div className="dd-stat-card purple">
              <span>📦</span>
              <h2>{customers.length}</h2>
              <p>Total Orders</p>
            </div>
            <div className="dd-stat-card orange">
              <span>⏳</span>
              <h2>{todayStats.pending}</h2>
              <p>Pending</p>
            </div>
            <div className="dd-stat-card green">
              <span>✅</span>
              <h2>{todayStats.deliveries}</h2>
              <p>Completed</p>
            </div>
            <div className="dd-stat-card blue">
              <span>💰</span>
              <h2>₹{todayStats.collected}</h2>
              <p>Collected</p>
            </div>
          </div>
        </>
      )}

      {/* DELIVERY TAB - WITH FULL PRODUCT INFO */}
      {activeTab === 'delivery' && (
        <div className="dd-delivery-container">
          {pendingGroups.length === 0 && !allDeliveriesCompleted ? (
            <div className="dd-empty-state">
              <div className="dd-empty-icon">📦</div>
              <h3>No Pending Deliveries</h3>
              <p>All deliveries are completed for today!</p>
            </div>
          ) : (
            pendingGroups.map((group, idx) => (
              <div className="dd-group" key={idx}>
                <div className="dd-group-title" onClick={() => toggleApartment(group.name)}>
                  <div className="group-info">
                    <span className="group-icon">🏢</span>
                    <span className="group-name">{group.name}</span>
                    <span className="group-count">{group.customers.length} orders</span>
                  </div>
                  <span className="group-arrow">{expandedApartments[group.name] ? '▲' : '▼'}</span>
                </div>

                {expandedApartments[group.name] && (
                  <div className="dd-cards">
                    {group.customers.map(customer => (
                      <div key={customer.id} className="dd-card">
                        <div className="card-header">
                          <div className="customer-info">
                            <div className="customer-avatar">
                              {customer.name?.charAt(0)}
                            </div>
                            <div>
                              <div className="customer-name">{customer.name}</div>
                              <div className="customer-flat">🏠 Flat {customer.flat_no || 'N/A'}</div>
                            </div>
                          </div>
                          <div className="customer-amount">₹{getCustomerTotal(customer)}</div>
                        </div>

                        {/* ✅ Products with FULL INFO - Milk 500ml ×1 */}
                        <div className="card-products">
                          {(customer.products || []).map((product, i) => (
                            <span key={i} className="product-tag">
                              🥛 {formatProductDisplay(product)}
                            </span>
                          ))}
                        </div>

                        <div className="card-actions">
                          <button className="action-map" onClick={() => openMap(customer)}>
                            🗺️ Map
                          </button>
                          <a href={`tel:${customer.phone}`} className="action-call">
                            📞 Call
                          </a>
                          <button
                            className="action-deliver"
                            onClick={() => markDelivered(customer.id)}
                            disabled={deliveringId === customer.id}
                          >
                            {deliveringId === customer.id ? '⏳' : '✓ Deliver'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* HISTORY TAB - WITH FULL PRODUCT INFO */}
      {activeTab === 'history' && (
        <div className="dd-history-container">
          {completedGroups.length === 0 ? (
            <div className="dd-empty-history">
              <div className="dd-empty-icon">📜</div>
              <h3>No History Yet</h3>
              <p>Completed deliveries will appear here</p>
            </div>
          ) : (
            completedGroups.map((group, idx) => (
              <div className="dd-group" key={idx}>
                <div className="dd-group-title completed" onClick={() => toggleApartment(group.name)}>
                  <div className="group-info">
                    <span className="group-icon">✅</span>
                    <span className="group-name">{group.name}</span>
                    <span className="group-count">{group.customers.length} delivered</span>
                  </div>
                  <span className="group-arrow">{expandedApartments[group.name] ? '▲' : '▼'}</span>
                </div>

                {expandedApartments[group.name] && (
                  <div className="dd-cards-simple">
                    {group.customers.map(customer => (
                      <div key={customer.id} className="dd-history-card-simple">
                        <div className="history-card-content">
                          <div className="history-user-info">
                            <div className="history-user-avatar">
                              {customer.name?.charAt(0)}
                            </div>
                            <div className="history-user-details">
                              <div className="history-user-name">{customer.name}</div>
                              <div className="history-user-flat">
                                <span>🏠</span> Flat {customer.flat_no || 'N/A'}
                              </div>
                              {/* ✅ Products in history with FULL INFO */}
                              <div className="history-products">
                                {(customer.products || []).map((product, i) => (
                                  <span key={i} className="history-product-tag">
                                    🥛 {formatProductDisplay(product)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="history-card-status">
                            <span className="status-badge">✅ Delivered</span>
                            
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav className="dd-navbar">
        <button className={`dd-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          🏠 <span>Home</span>
        </button>
        <button className={`dd-nav-item ${activeTab === 'delivery' ? 'active' : ''}`} onClick={() => setActiveTab('delivery')}>
          🚚 <span>Delivery</span>
        </button>
        <button className={`dd-nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          📜 <span>History</span>
        </button>
      </nav>
    </div>
  );
};

export default DeliveryDashboard;