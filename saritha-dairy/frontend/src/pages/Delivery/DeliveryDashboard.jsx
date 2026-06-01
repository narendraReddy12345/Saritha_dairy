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
  const [customerPreferences, setCustomerPreferences] = useState({});
  const [extraOrdersAlert, setExtraOrdersAlert] = useState(false);
  const [extraOrdersList, setExtraOrdersList] = useState([]);
  const [showExtraOrdersList, setShowExtraOrdersList] = useState(false);
  const [todayStats, setTodayStats] = useState({
    deliveries: 0,
    pending: 0,
    collected: 0,
    extraOrders: 0
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

  const today = new Date().toISOString().split('T')[0];

  const getSkipDays = (preferences) => {
    if (!preferences) return [];
    if (preferences.skip_days && Array.isArray(preferences.skip_days)) return preferences.skip_days;
    if (preferences.skip_days && typeof preferences.skip_days === 'string') {
      try {
        const parsed = JSON.parse(preferences.skip_days);
        return Array.isArray(parsed) ? parsed : [];
      } catch(e) {
        return [];
      }
    }
    return [];
  };

  const getMilkProduct = (preferences) => {
    if (!preferences) {
      return {
        product_name: 'Milk',
        pack_size: '500ml',
        quantity: 2,
        price: 30,
        total: 60,
        type: 'milk'
      };
    }
    
    if (preferences.want_milk === false) return null;
    
    const skipDays = getSkipDays(preferences);
    if (skipDays.includes(today)) return null;
    
    const packSize = preferences.pack_size || '500ml';
    const quantity = preferences.quantity || 2;
    let pricePerUnit = packSize === '1L' ? 60 : packSize === '2L' ? 110 : 30;
    
    return {
      product_name: 'Milk',
      pack_size: packSize,
      quantity: quantity,
      price: pricePerUnit,
      total: pricePerUnit * quantity,
      type: 'milk'
    };
  };

  const getCustomerExtraOrders = (customerId) => {
    const prefs = customerPreferences[customerId];
    if (!prefs || !prefs.extra_orders) return [];
    
    let extraOrders = prefs.extra_orders;
    if (typeof extraOrders === 'string') {
      try { extraOrders = JSON.parse(extraOrders); } catch(e) { extraOrders = []; }
    }
    if (!Array.isArray(extraOrders)) return [];
    
    return extraOrders.filter(order => order.date === today && !order.delivered);
  };

  const getCustomerTotal = (customer) => {
    let total = 0;
    const milkProduct = getMilkProduct(customerPreferences[customer.id]);
    if (milkProduct) total += milkProduct.total;
    const extraOrders = getCustomerExtraOrders(customer.id);
    extraOrders.forEach(order => total += (order.price || 0) * (order.quantity || 1));
    return total;
  };

  const getCustomerProductsForDisplay = (customer) => {
    const products = [];
    const prefs = customerPreferences[customer.id];
    const milkProduct = getMilkProduct(prefs);
    if (milkProduct) {
      products.push({ display_name: `🥛 Milk ${milkProduct.pack_size} ×${milkProduct.quantity}` });
    }
    const extraOrders = getCustomerExtraOrders(customer.id);
    extraOrders.forEach(order => {
      products.push({ display_name: `🛒 ${order.productName} ${order.packSize} ×${order.quantity}`, type: 'extra' });
    });
    if (products.length === 0) {
      products.push({ display_name: '📭 No products today', empty: true });
    }
    return products;
  };

  const getProductsToSave = (customer) => {
    const productsToSave = [];
    const prefs = customerPreferences[customer.id];
    const milkProduct = getMilkProduct(prefs);
    if (milkProduct) productsToSave.push(milkProduct);
    const extraOrders = getCustomerExtraOrders(customer.id);
    extraOrders.forEach(order => {
      productsToSave.push({
        product_name: order.productName,
        pack_size: order.packSize,
        quantity: order.quantity,
        price: order.price,
        total: (order.price || 0) * (order.quantity || 1),
        type: 'extra',
        extra_order_id: order.id
      });
    });
    return productsToSave;
  };

  const hasDeliverableProducts = (customer) => {
    const prefs = customerPreferences[customer.id];
    let hasMilk = false;
    if (prefs && prefs.want_milk === false) {
      hasMilk = false;
    } else {
      const skipDays = getSkipDays(prefs);
      if (!skipDays.includes(today)) hasMilk = true;
    }
    const hasExtra = getCustomerExtraOrders(customer.id).length > 0;
    if (!prefs) return true;
    return hasMilk || hasExtra;
  };

  useEffect(() => {
    if (!userData?.id) {
      window.location.href = '/login';
      return;
    }
    loadCustomers();
    loadDeliveryBoyPreferences();
    loadDeliveryBoyExtraOrders();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadDeliveryBoyPreferences = async () => {
    try {
      const res = await fetch(`${API_URL}/customer-preferences/delivery-boy/${userData.id}/assigned`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        const prefsMap = {};
        data.data.forEach(pref => {
          prefsMap[pref.customer_id] = { ...pref, skip_days: getSkipDays(pref) };
        });
        setCustomerPreferences(prefsMap);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const loadDeliveryBoyExtraOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/customer-preferences/delivery-boy/${userData.id}/extra-orders`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setExtraOrdersList(data.data);
        setExtraOrdersAlert(true);
        setTimeout(() => setExtraOrdersAlert(false), 10000);
      } else {
        setExtraOrdersList([]);
      }
    } catch (error) {
      console.error('Error loading extra orders:', error);
    }
  };

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/delivery-boys/${userData.id}/customers`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        const customersData = data.data || [];
        setCustomers(customersData);
        let deliveredCount = 0, pendingCount = 0, collectedAmount = 0, extraOrderCount = 0;
        customersData.forEach(customer => {
          if (customer.delivered) {
            deliveredCount++;
            collectedAmount += getCustomerTotal(customer);
          } else {
            pendingCount++;
          }
          extraOrderCount += getCustomerExtraOrders(customer.id).length;
        });
        setTodayStats({ deliveries: deliveredCount, pending: pendingCount, collected: collectedAmount, extraOrders: extraOrderCount });
      }
    } catch (err) {
      console.error('Error loading customers:', err);
      showMessage('error', 'Failed to load customers');
    }
    setLoading(false);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 2500);
  };

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
      const productsToSave = getProductsToSave(customer);
      const customerAmount = getCustomerTotal(customer);
      if (productsToSave.length === 0) {
        showMessage('error', 'No products to deliver today');
        setDeliveringId(null);
        return;
      }
      const response = await fetch(`${API_URL}/delivery/record`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          customer_id: customerId,
          delivery_boy_id: userData.id,
          products: productsToSave,
          status: 'delivered',
          total_amount: customerAmount,
          delivery_date: today
        })
      });
      const result = await response.json();
      if (result.success) {
        setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, delivered: true } : c));
        setTodayStats(prev => ({
          deliveries: prev.deliveries + 1,
          pending: prev.pending - 1,
          collected: prev.collected + customerAmount,
          extraOrders: prev.extraOrders
        }));
        showMessage('success', `✅ Delivered ₹${customerAmount} to ${customer.name}`);
        await loadDeliveryBoyExtraOrders();
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

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = '/login';
  };

  const toggleApartment = (key) => {
    setExpandedApartments(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return '🌅 Good Morning';
    if (hour < 17) return '☀️ Good Afternoon';
    return '🌙 Good Evening';
  };

  const openMap = (customer) => {
    const address = `${customer.apartment || ''}, ${customer.colony || ''}, ${customer.area || ''}, Hyderabad`.trim();
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
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
      if (!groups[apartment]) groups[apartment] = { name: apartment, customers: [], totalAmount: 0 };
      groups[apartment].customers.push(customer);
      groups[apartment].totalAmount += getCustomerTotal(customer);
    });
    return Object.values(groups);
  };

  const pendingGroups = groupCustomers(pendingCustomers);
  const completedGroups = groupCustomers(completedCustomers);
  const allDeliveriesCompleted = todayStats.pending === 0 && customers.length > 0;
  const totalExtraOrders = extraOrdersList.reduce((sum, item) => sum + item.orders.length, 0);

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

      {message && <div className={`dd-toast ${message.type}`}>{message.text}</div>}

      <header className="dd-header">
        <div className="dd-user">
          <div className="dd-avatar">{userData?.name?.charAt(0)}</div>
          <div>
            <small>{getGreeting()}</small>
            <h2>{userData?.name || 'Delivery Partner'}</h2>
          </div>
        </div>
        <button className="dd-logout-btn" onClick={handleLogout} title="Logout">Logout</button>
      </header>

      {activeTab !== 'home' && (
        <div className="dd-search-box">
          <span>🔍</span>
          <input type="text" placeholder="Search by name or flat number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
              {todayStats.extraOrders > 0 && <span>🛒 {todayStats.extraOrders} Extra Items</span>}
            </div>
            <button className="completion-btn" onClick={() => setActiveTab('history')}>View History →</button>
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
            <div className="dd-stat-card purple"><span>📦</span><h2>{customers.length}</h2><p>Total Orders</p></div>
            <div className="dd-stat-card orange"><span>⏳</span><h2>{todayStats.pending}</h2><p>Pending</p></div>
            <div className="dd-stat-card green"><span>✅</span><h2>{todayStats.deliveries}</h2><p>Completed</p></div>
            <div className="dd-stat-card blue"><span>💰</span><h2>₹{todayStats.collected}</h2><p>Collected</p></div>
          </div>

          {/* Simple Extra Orders Button */}
          {totalExtraOrders > 0 && (
            <div className="dd-extra-btn" onClick={() => setShowExtraOrdersList(!showExtraOrdersList)}>
              <div className="dd-extra-btn-left">
                <span>🛒</span>
                <div>
                  <h4>Extra Orders</h4>
                  <p>{totalExtraOrders} item{totalExtraOrders > 1 ? 's' : ''} pending</p>
                </div>
              </div>
              <span className="dd-extra-btn-arrow">{showExtraOrdersList ? '▲' : '▼'}</span>
            </div>
          )}

          {/* Extra Orders List - Simple and Clean */}
          {showExtraOrdersList && totalExtraOrders > 0 && (
            <div className="dd-extra-list-simple">
              {extraOrdersList.map((item, idx) => (
                <div key={idx} className="dd-extra-item-simple">
                  <div className="dd-extra-item-header">
                    <div className="dd-customer-name-simple">
                      <strong>{item.customerName}</strong>
                      <span>Flat {item.flatNo}</span>
                    </div>
                    <button 
                      className="dd-deliver-simple-btn"
                      onClick={() => {
                        setActiveTab('delivery');
                        setTimeout(() => {
                          const el = document.getElementById(`customer-${item.customerId}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }}
                    >
                      Deliver
                    </button>
                  </div>
                  <div className="dd-extra-items-simple">
                    {item.orders.map((order, orderIdx) => (
                      <div key={orderIdx} className="dd-order-item-simple">
                        <span className="dd-order-name">{order.productName}</span>
                        <span className="dd-order-size">{order.packSize}</span>
                        <span className="dd-order-qty">×{order.quantity}</span>
                        <span className="dd-order-price">₹{(order.price || 0) * (order.quantity || 1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          
        </>
      )}

      {/* DELIVERY TAB */}
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
                    {group.customers.map(customer => {
                      const hasExtraOrders = getCustomerExtraOrders(customer.id).length > 0;
                      const products = getCustomerProductsForDisplay(customer);
                      const deliverable = hasDeliverableProducts(customer);
                      
                      return (
                        <div key={customer.id} id={`customer-${customer.id}`} className={`dd-card ${hasExtraOrders ? 'has-extra' : ''}`}>
                          <div className="card-header">
                            <div className="customer-info">
                              <div className="customer-avatar">{customer.name?.charAt(0)}</div>
                              <div>
                                <div className="customer-name">{customer.name}{hasExtraOrders && <span className="extra-badge">🛒 Extra</span>}</div>
                                <div className="product1-tag">🏠 Flat {customer.flat_no || 'N/A'}</div>
                              </div>
                            </div>
                          </div>

                          <div className="card-products">
                            {products.map((product, i) => (
                              <span key={i} className={`product-tag ${product.type === 'extra' ? 'extra-product' : 'milk-product'} ${product.empty ? 'empty' : ''}`}>
                                {product.display_name}
                              </span>
                            ))}
                          </div>

                          <div className="card-actions">
                            <button className="action-map" onClick={() => openMap(customer)}>🗺️ Map</button>
                            <a href={`tel:${customer.phone}`} className="action-call">📞 Call</a>
                            <button 
                              className={`action-deliver ${!deliverable ? 'disabled' : ''}`} 
                              onClick={() => markDelivered(customer.id)} 
                              disabled={deliveringId === customer.id || !deliverable}
                            >
                              {deliveringId === customer.id ? '⏳' : '✓ Deliver'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* HISTORY TAB */}
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
                    {group.customers.map(customer => {
                      const products = getCustomerProductsForDisplay(customer);
                      return (
                        <div key={customer.id} className="dd-history-card-simple">
                          <div className="history-card-content">
                            <div className="history-user-info">
                              <div className="history-user-avatar">{customer.name?.charAt(0)}</div>
                              <div className="history-user-details">
                                <div className="history-user-name">{customer.name}</div>
                                <div className="history-user-flat"><span>🏠</span> Flat {customer.flat_no || 'N/A'}</div>
                                <div className="history-products">
                                  {products.map((product, i) => <span key={i} className="history-product-tag">{product.display_name}</span>)}
                                </div>
                              </div>
                            </div>
                            <div className="history-card-status">
                              <span className="status-badge">✅ Delivered</span>
                              <strong className="history-amount">₹{getCustomerTotal(customer)}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav className="dd-navbar">
        <button className={`dd-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>🏠 <span>Home</span></button>
        <button className={`dd-nav-item ${activeTab === 'delivery' ? 'active' : ''}`} onClick={() => setActiveTab('delivery')}>🚚 <span>Delivery</span>{todayStats.extraOrders > 0 && <span className="nav-badge">{todayStats.extraOrders}</span>}</button>
        <button className={`dd-nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📜 <span>History</span></button>
      </nav>
    </div>
  );
};

export default DeliveryDashboard;