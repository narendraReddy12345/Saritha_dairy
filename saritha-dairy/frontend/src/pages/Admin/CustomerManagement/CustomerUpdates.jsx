// src/pages/Admin/CustomerManagement/CustomerUpdates.jsx
import React, { useState, useEffect } from 'react';
import './CustomerUpdates.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const CustomerUpdates = () => {
  const [allUpdates, setAllUpdates] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [dateFilter, setDateFilter] = useState('all');
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [activeTab, setActiveTab] = useState('updates');
  const [expandedRow, setExpandedRow] = useState(null);

  const [skipData, setSkipData] = useState({
    customer_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    reason: '',
    skip_type: 'single'
  });

  const getToken = () => sessionStorage.getItem('authToken');
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const customersRes = await fetch(`${API_URL}/admin/customers`, {
        headers: getAuthHeaders()
      });
      
      const customersData = await customersRes.json();
      
      if (customersData.success) {
        const customersList = customersData.customers || [];
        const updatesMap = new Map();
        
        const enrichedCustomers = await Promise.all(
          customersList.map(async (customer) => {
            try {
              const [prefRes, deliveriesRes] = await Promise.all([
                fetch(`${API_URL}/customer-preferences/${customer.id}`, { headers: getAuthHeaders() }),
                fetch(`${API_URL}/delivery/customer/${customer.id}`, { headers: getAuthHeaders() })
              ]);
              
              const prefData = await prefRes.json();
              const deliveriesData = await deliveriesRes.json();
              
              let preferences = {};
              let extraOrders = [];
              let skipDays = [];
              
              if (prefData.success && prefData.data) {
                preferences = {
                  wantMilk: prefData.data.wantMilk ?? prefData.data.want_milk ?? true,
                  quantity: prefData.data.quantity ?? 2,
                  packSize: prefData.data.packSize ?? prefData.data.pack_size ?? '500ml',
                };
                
                let skipDaysData = prefData.data.skipDays || prefData.data.skip_days || [];
                if (typeof skipDaysData === 'string') {
                  try { skipDaysData = JSON.parse(skipDaysData); } catch (e) { skipDaysData = []; }
                }
                skipDays = Array.isArray(skipDaysData) ? skipDaysData : [];
                
                let extraOrdersData = prefData.data.extraOrders || prefData.data.extra_orders || [];
                if (typeof extraOrdersData === 'string') {
                  try { extraOrdersData = JSON.parse(extraOrdersData); } catch (e) { extraOrdersData = []; }
                }
                extraOrders = Array.isArray(extraOrdersData) ? extraOrdersData : [];
              }
              
              const deliveries = deliveriesData.success ? (deliveriesData.deliveries || deliveriesData.data || []) : [];
              const today = new Date().toISOString().split('T')[0];
              const activeSkips = skipDays.filter(d => d >= today);
              
              if (skipDays.length > 0) {
                const updateKey = `skip-${customer.id}`;
                updatesMap.set(updateKey, {
                  id: updateKey,
                  customerId: customer.id,
                  customerName: customer.name,
                  customerPhone: customer.phone,
                  customerEmail: customer.email,
                  customerApartment: customer.apartment || customer.address?.apartment,
                  customerFlatNo: customer.flat_no || customer.address?.flatNo,
                  customerArea: customer.area || customer.address?.area,
                  customerCity: customer.city || customer.address?.city,
                  customerPincode: customer.pincode || customer.address?.pincode,
                  assignedBoyName: customer.assigned_boy_name,
                  createdAt: customer.created_at,
                  type: 'skip',
                  title: 'Milk Delivery Skipped',
                  skipCount: skipDays.length,
                  skipDates: skipDays,
                  activeSkipDates: activeSkips,
                  latestDate: skipDays[skipDays.length - 1],
                  status: activeSkips.length > 0 ? 'active' : 'completed',
                  icon: '🚫'
                });
              }
              
              extraOrders.forEach(order => {
                const updateKey = `order-${customer.id}-${order.id || Date.now()}-${order.date}`;
                updatesMap.set(updateKey, {
                  id: updateKey,
                  customerId: customer.id,
                  customerName: customer.name,
                  customerPhone: customer.phone,
                  customerEmail: customer.email,
                  customerApartment: customer.apartment || customer.address?.apartment,
                  customerFlatNo: customer.flat_no || customer.address?.flatNo,
                  customerArea: customer.area || customer.address?.area,
                  customerCity: customer.city || customer.address?.city,
                  customerPincode: customer.pincode || customer.address?.pincode,
                  assignedBoyName: customer.assigned_boy_name,
                  createdAt: customer.created_at,
                  type: 'extra',
                  productName: order.productName,
                  packSize: order.packSize,
                  quantity: order.quantity,
                  amount: order.price * order.quantity,
                  date: order.date,
                  status: order.delivered ? 'delivered' : 'pending',
                  icon: '🛒',
                  orderDetails: order
                });
              });
              
              return {
                ...customer,
                preferences,
                skipDays,
                extraOrders,
                deliveries,
                stats: {
                  totalDeliveries: deliveries.length,
                  pendingExtraOrders: extraOrders.filter(o => !o.delivered && o.date >= today).length,
                  totalExtraOrders: extraOrders.length,
                  activeSkips: activeSkips.length,
                  totalAmount: deliveries.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0)
                }
              };
            } catch (err) {
              console.error(`Error fetching data for customer ${customer.id}:`, err);
              return { ...customer, preferences: {}, skipDays: [], extraOrders: [], deliveries: [], stats: {} };
            }
          })
        );
        
        const updatesList = Array.from(updatesMap.values());
        updatesList.sort((a, b) => new Date(b.latestDate || b.date) - new Date(a.latestDate || a.date));
        
        setAllUpdates(updatesList);
        setCustomers(enrichedCustomers);
      }
    } catch (error) {
      console.error('Error:', error);
      showMessage('error', 'Failed to load data');
    }
    setLoading(false);
  };

  const handleManualSkip = async (e) => {
    e.preventDefault();
    if (submitting) return;
    
    setSubmitting(true);
    try {
      const customerId = skipData.customer_id;
      const startDate = skipData.start_date;
      const endDate = skipData.skip_type === 'multiple' ? skipData.end_date : skipData.start_date;
      
      const prefRes = await fetch(`${API_URL}/customer-preferences/${customerId}`, {
        headers: getAuthHeaders()
      });
      const prefData = await prefRes.json();
      
      let existingSkipDays = [];
      let existingExtraOrders = [];
      let existingWantMilk = true;
      let existingQuantity = 2;
      let existingPackSize = '500ml';
      
      if (prefData.success && prefData.data) {
        existingSkipDays = prefData.data.skipDays || prefData.data.skip_days || [];
        if (typeof existingSkipDays === 'string') {
          try { existingSkipDays = JSON.parse(existingSkipDays); } catch (e) { existingSkipDays = []; }
        }
        existingSkipDays = Array.isArray(existingSkipDays) ? existingSkipDays : [];
        
        existingExtraOrders = prefData.data.extraOrders || prefData.data.extra_orders || [];
        if (typeof existingExtraOrders === 'string') {
          try { existingExtraOrders = JSON.parse(existingExtraOrders); } catch (e) { existingExtraOrders = []; }
        }
        existingExtraOrders = Array.isArray(existingExtraOrders) ? existingExtraOrders : [];
        
        existingWantMilk = prefData.data.wantMilk ?? prefData.data.want_milk ?? true;
        existingQuantity = prefData.data.quantity ?? 2;
        existingPackSize = prefData.data.packSize ?? prefData.data.pack_size ?? '500ml';
      }
      
      const datesToAdd = [];
      let currentDate = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      while (currentDate <= endDateObj) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (!existingSkipDays.includes(dateStr)) {
          datesToAdd.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      if (datesToAdd.length === 0) {
        showMessage('error', 'No new skip dates to add');
        setSubmitting(false);
        return;
      }
      
      const updatedSkipDays = [...existingSkipDays, ...datesToAdd];
      
      const response = await fetch(`${API_URL}/customer-preferences/${customerId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          wantMilk: existingWantMilk,
          quantity: existingQuantity,
          packSize: existingPackSize,
          skipDays: updatedSkipDays,
          extraOrders: existingExtraOrders
        })
      });
      
      const data = await response.json();
      if (data.success) {
        showMessage('success', `${datesToAdd.length} skip date(s) added successfully!`);
        setShowSkipModal(false);
        resetSkipForm();
        loadData();
      } else {
        showMessage('error', data.error || data.message || 'Failed to add skip');
      }
    } catch (error) {
      console.error('Error adding skip:', error);
      showMessage('error', 'Failed to add skip. Please try again.');
    }
    setSubmitting(false);
  };

  const handleCancelSkip = async (customerId, skipDate) => {
    if (!window.confirm(`Cancel skip for ${skipDate}?`)) return;
    
    try {
      const prefRes = await fetch(`${API_URL}/customer-preferences/${customerId}`, {
        headers: getAuthHeaders()
      });
      const prefData = await prefRes.json();
      
      let existingSkipDays = [];
      let existingExtraOrders = [];
      let existingWantMilk = true;
      let existingQuantity = 2;
      let existingPackSize = '500ml';
      
      if (prefData.success && prefData.data) {
        existingSkipDays = prefData.data.skipDays || prefData.data.skip_days || [];
        if (typeof existingSkipDays === 'string') {
          try { existingSkipDays = JSON.parse(existingSkipDays); } catch (e) { existingSkipDays = []; }
        }
        existingSkipDays = Array.isArray(existingSkipDays) ? existingSkipDays : [];
        
        existingExtraOrders = prefData.data.extraOrders || prefData.data.extra_orders || [];
        if (typeof existingExtraOrders === 'string') {
          try { existingExtraOrders = JSON.parse(existingExtraOrders); } catch (e) { existingExtraOrders = []; }
        }
        existingExtraOrders = Array.isArray(existingExtraOrders) ? existingExtraOrders : [];
        
        existingWantMilk = prefData.data.wantMilk ?? prefData.data.want_milk ?? true;
        existingQuantity = prefData.data.quantity ?? 2;
        existingPackSize = prefData.data.packSize ?? prefData.data.pack_size ?? '500ml';
      }
      
      const updatedSkipDays = existingSkipDays.filter(d => d !== skipDate);
      
      const response = await fetch(`${API_URL}/customer-preferences/${customerId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          wantMilk: existingWantMilk,
          quantity: existingQuantity,
          packSize: existingPackSize,
          skipDays: updatedSkipDays,
          extraOrders: existingExtraOrders
        })
      });
      
      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Skip cancelled successfully');
        loadData();
      } else {
        showMessage('error', data.error || 'Failed to cancel skip');
      }
    } catch (error) {
      console.error('Error cancelling skip:', error);
      showMessage('error', 'Failed to connect to server');
    }
  };

  const resetSkipForm = () => {
    setSkipData({
      customer_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      reason: '',
      skip_type: 'single'
    });
    setSelectedCustomer(null);
  };

  const viewCustomerDetails = (customer) => {
    setSelectedCustomerDetails(customer);
    setShowCustomerModal(true);
  };

  const getFilteredUpdates = () => {
    let filtered = [...allUpdates];
    const today = new Date().toISOString().split('T')[0];
    
    if (filterType !== 'all') {
      filtered = filtered.filter(update => update.type === filterType);
    }
    
    if (dateFilter === 'today') {
      filtered = filtered.filter(update => (update.latestDate || update.date) === today);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(update => new Date(update.latestDate || update.date) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(update => new Date(update.latestDate || update.date) >= monthAgo);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(update => 
        update.customerName?.toLowerCase().includes(term) ||
        update.customerPhone?.includes(term) ||
        update.customerApartment?.toLowerCase().includes(term)
      );
    }
    
    filtered.sort((a, b) => {
      const dateA = new Date(a.latestDate || a.date);
      const dateB = new Date(b.latestDate || b.date);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    
    return filtered;
  };

  const filteredUpdates = getFilteredUpdates();

  const stats = {
    totalUpdates: allUpdates.length,
    todayUpdates: allUpdates.filter(u => (u.latestDate || u.date) === new Date().toISOString().split('T')[0]).length,
    skipUpdates: allUpdates.filter(u => u.type === 'skip' && u.status === 'active').length,
    extraUpdates: allUpdates.filter(u => u.type === 'extra' && u.status === 'pending').length
  };

  const getStatusBadge = (update) => {
    if (update.type === 'skip') {
      if (update.status === 'active') {
        return <span className="cu-status-badge active">🟡 {update.activeSkipDates?.length || update.skipCount} Active</span>;
      }
      return <span className="cu-status-badge completed">✅ Completed</span>;
    } else {
      if (update.status === 'pending') {
        return <span className="cu-status-badge pending">⏳ Pending</span>;
      }
      return <span className="cu-status-badge delivered">✅ Delivered</span>;
    }
  };

  const CustomerDetailsModal = ({ customer, onClose }) => {
    if (!customer) return null;
    
    const today = new Date().toISOString().split('T')[0];
    const activeSkips = (customer.skipDays || []).filter(d => d >= today);
    
    // Get address fields - handle both nested and flat structures
    const apartment = customer.address?.apartment || customer.apartment || 'N/A';
    const flatNo = customer.address?.flatNo || customer.address?.flat_no || customer.flat_no || 'N/A';
    const area = customer.address?.area || customer.area || 'N/A';
    const city = customer.address?.city || customer.city || 'N/A';
    const pincode = customer.address?.pincode || customer.pincode || 'N/A';
    
    return (
      <div className="cu-modal-overlay" onClick={onClose}>
        <div className="cu-modal-container cu-large-modal" onClick={e => e.stopPropagation()}>
          <div className="cu-modal-header">
            <h2>📋 {customer.name}</h2>
            <button className="cu-modal-close" onClick={onClose}>×</button>
          </div>
          
          <div className="cu-details-tabs">
            <button className={`cu-tab ${activeTab === 'extra' ? 'active' : ''}`} onClick={() => setActiveTab('extra')}>
              🛒 Extra Orders ({customer.extraOrders?.length || 0})
            </button>
            <button className={`cu-tab ${activeTab === 'skips' ? 'active' : ''}`} onClick={() => setActiveTab('skips')}>
              🚫 Skips ({customer.skipDays?.length || 0})
            </button>
            <button className={`cu-tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
              👤 Info
            </button>
          </div>
          
          <div className="cu-details-content">
            {activeTab === 'extra' && (
              <div className="cu-extra-table">
                <table className="cu-mini-table">
                  <thead>
                    <tr><th>Date</th><th>Product</th><th>Quantity</th><th>Amount</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {customer.extraOrders?.map((order, idx) => (
                      <tr key={idx}>
                        <td>{new Date(order.date).toLocaleDateString()}</td>
                        <td>{order.productName}</td>
                        <td>{order.packSize} × {order.quantity}</td>
                        <td>₹{order.price * order.quantity}</td>
                        <td>{order.delivered ? '✅ Delivered' : '⏳ Pending'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {activeTab === 'skips' && (
              <div className="cu-skips-table">
                <table className="cu-mini-table">
                  <thead>
                    <tr><th>Date</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {customer.skipDays?.sort().map((date, idx) => {
                      const isActive = date >= today;
                      return (
                        <tr key={idx}>
                          <td>{new Date(date).toLocaleDateString()}</td>
                          <td>{isActive ? '🟡 Active' : '⚪ Past'}</td>
                          <td>{isActive && <button onClick={() => handleCancelSkip(customer.id, date)} className="cu-cancel-skip-btn">Cancel</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <button className="cu-add-skip" onClick={() => {
                  onClose();
                  setSkipData({...skipData, customer_id: customer.id});
                  setSelectedCustomer(customer);
                  setShowSkipModal(true);
                }}>+ Add Skip</button>
              </div>
            )}
            
            {activeTab === 'info' && (
              <div className="cu-info-content">
                <div className="cu-info-row">
                  <span>📞 Phone:</span>
                  <strong>{customer.phone}</strong>
                </div>
                <div className="cu-info-row">
                  <span>📧 Email:</span>
                  <strong>{customer.email || 'N/A'}</strong>
                </div>
                <div className="cu-info-row">
                  <span>🏢 Apartment:</span>
                  <strong>{apartment}</strong>
                </div>
                <div className="cu-info-row">
                  <span>🚪 Flat No:</span>
                  <strong>{flatNo}</strong>
                </div>
                <div className="cu-info-row">
                  <span>📍 Area:</span>
                  <strong>{area}</strong>
                </div>
                <div className="cu-info-row">
                  <span>🏙️ City:</span>
                  <strong>{city}</strong>
                </div>
                <div className="cu-info-row">
                  <span>📮 Pincode:</span>
                  <strong>{pincode}</strong>
                </div>
                <div className="cu-info-row">
                  <span>🛵 Delivery Boy:</span>
                  <strong>{customer.assigned_boy_name || 'Not assigned'}</strong>
                </div>
                <div className="cu-info-row">
                  <span>🥛 Milk Status:</span>
                  <strong>{customer.preferences?.wantMilk !== false ? '🟢 Active' : '🔴 Paused'}</strong>
                </div>
                <div className="cu-info-row">
                  <span>📦 Milk Quantity:</span>
                  <strong>{customer.preferences?.quantity || 2} × {customer.preferences?.packSize || '500ml'}</strong>
                </div>
                <div className="cu-info-row">
                  <span>💰 Total Spent:</span>
                  <strong className="cu-amount">₹{(customer.stats?.totalAmount || 0).toLocaleString()}</strong>
                </div>
                <div className="cu-info-row">
                  <span>📅 Registered:</span>
                  <strong>{customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A'}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="cu-container">
        <div className="cu-loading-screen">
          <div className="cu-loading-animation">
            <div className="cu-loading-ring"></div>
            <div className="cu-loading-milk">🥛</div>
          </div>
          <p>Loading customer updates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cu-container">
      {message && (
        <div className={`cu-toast ${message.type}`}>
          <div className="cu-toast-icon">{message.type === 'success' ? '🎉' : '⚠️'}</div>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="cu-hero">
        <div className="cu-hero-content">
          <div className="cu-hero-badge">
            <span className="cu-hero-badge-icon">📊</span>
            <span>Activity Dashboard</span>
          </div>
          <h1 className="cu-hero-title">Customer<span className="cu-hero-highlight"> Updates</span></h1>
          <p className="cu-hero-subtitle">Track all skip requests and extra orders in one place</p>
        </div>
        <div className="cu-hero-stats">
          <div className="cu-hero-stat"><div className="cu-hero-stat-value">{stats.totalUpdates}</div><div className="cu-hero-stat-label">Total Updates</div></div>
          <div className="cu-hero-stat"><div className="cu-hero-stat-value">{stats.todayUpdates}</div><div className="cu-hero-stat-label">Today</div></div>
          <div className="cu-hero-stat"><div className="cu-hero-stat-value">{stats.skipUpdates}</div><div className="cu-hero-stat-label">Active Skips</div></div>
          <div className="cu-hero-stat"><div className="cu-hero-stat-value">{stats.extraUpdates}</div><div className="cu-hero-stat-label">Pending Orders</div></div>
        </div>
      </div>

      <div className="cu-filter-bar">
        <div className="cu-search-box">
          <span className="cu-search-icon">🔍</span>
          <input type="text" placeholder="Search by customer name, phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {searchTerm && <button className="cu-clear-search" onClick={() => setSearchTerm('')}>✕</button>}
        </div>
        
        <div className="cu-filter-chips">
          <button className={`cu-chip ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>All</button>
          <button className={`cu-chip ${filterType === 'skip' ? 'active' : ''}`} onClick={() => setFilterType('skip')}>🚫 Skips</button>
          <button className={`cu-chip ${filterType === 'extra' ? 'active' : ''}`} onClick={() => setFilterType('extra')}>🛒 Extra Orders</button>
        </div>

        <div className="cu-date-filter">
          <select className="cu-date-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>

        <button className="cu-add-skip-btn" onClick={() => setShowSkipModal(true)}>
          <span>➕</span> Add Manual Skip
        </button>
      </div>

      <div className="cu-table-container">
        <table className="cu-main-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Details</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredUpdates.length === 0 ? (
              <tr><td colSpan="6" className="cu-empty-row">No updates found</td></tr>
            ) : (
              filteredUpdates.map((update, index) => (
                <React.Fragment key={update.id}>
                  <tr className={`cu-table-row ${update.type}`}>
                    <td className="cu-date-cell">
                      <span className="cu-date-day">{new Date(update.latestDate || update.date).toLocaleDateString('en-US', { day: '2-digit' })}</span>
                      <span className="cu-date-month">{new Date(update.latestDate || update.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                    </td>
                    <td className="cu-customer-cell">
                      <div className="cu-customer-info">
                        <div className="cu-customer-avatar-sm">{update.customerName.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="cu-customer-name">{update.customerName}</div>
                          <div className="cu-customer-phone">📞 {update.customerPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`cu-type-badge ${update.type}`}>{update.type === 'skip' ? '🚫 Skip' : '🛒 Extra Order'}</span></td>
                    <td className="cu-details-cell">
                      {update.type === 'skip' ? (
                        <>
                          <div className="cu-details-title">{update.skipCount} Skip Date(s)</div>
                          <div className="cu-dates-preview">
                            {update.skipDates?.slice(0, 3).map(d => new Date(d).toLocaleDateString()).join(', ')}
                            {update.skipDates?.length > 3 && ` +${update.skipDates.length - 3} more`}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="cu-details-title">{update.productName}</div>
                          <div className="cu-details-sub">{update.packSize} × {update.quantity} - ₹{update.amount}</div>
                        </>
                      )}
                    </td>
                    <td>{getStatusBadge(update)}</td>
                    <td>
                      <div className="cu-action-buttons">
                        <button className="cu-view-btn" onClick={() => {
                          const customer = customers.find(c => c.id === update.customerId);
                          if (customer) viewCustomerDetails(customer);
                        }} title="View Details">👁️</button>
                        {update.type === 'skip' && update.status === 'active' && (
                          <button className="cu-cancel-btn" onClick={() => handleCancelSkip(update.customerId, update.activeSkipDates?.[0] || update.skipDates?.[0])} title="Cancel Skip">🚫</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedRow === update.id && (
                    <tr className="cu-expanded-row">
                      <td colSpan="6">
                        <div className="cu-expanded-content">
                          <h4>📋 Full Details</h4>
                          {update.type === 'skip' ? (
                            <div className="cu-skip-dates-list">
                              <strong>All Skip Dates:</strong>
                              <div className="cu-dates-grid">
                                {update.skipDates?.map(date => (
                                  <span key={date} className="cu-date-tag">{new Date(date).toLocaleDateString()}</span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="cu-order-details">
                              <p><strong>Product:</strong> {update.productName}</p>
                              <p><strong>Pack Size:</strong> {update.packSize}</p>
                              <p><strong>Quantity:</strong> {update.quantity}</p>
                              <p><strong>Amount:</strong> ₹{update.amount}</p>
                              <p><strong>Order Date:</strong> {new Date(update.date).toLocaleDateString()}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showSkipModal && (
        <div className="cu-modal-overlay" onClick={() => !submitting && setShowSkipModal(false)}>
          <div className="cu-modal-container" onClick={e => e.stopPropagation()}>
            <div className="cu-modal-header">
              <div className="cu-modal-icon">🚫</div>
              <h2>{selectedCustomer ? `Add Skip for ${selectedCustomer.name}` : 'Add Manual Skip'}</h2>
              <button className="cu-modal-close" onClick={() => setShowSkipModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleManualSkip} className="cu-form">
              {!selectedCustomer && (
                <div className="cu-form-group">
                  <label>Select Customer</label>
                  <select value={skipData.customer_id} onChange={e => setSkipData({...skipData, customer_id: e.target.value})} required>
                    <option value="">Choose a customer...</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>{customer.name} - {customer.phone}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="cu-form-row">
                <div className="cu-form-group">
                  <label>Skip Type</label>
                  <div className="cu-skip-type-toggle">
                    <button type="button" className={`cu-toggle-btn ${skipData.skip_type === 'single' ? 'active' : ''}`} onClick={() => setSkipData({...skipData, skip_type: 'single', end_date: ''})}>Single Day</button>
                    <button type="button" className={`cu-toggle-btn ${skipData.skip_type === 'multiple' ? 'active' : ''}`} onClick={() => setSkipData({...skipData, skip_type: 'multiple'})}>Multiple Days</button>
                  </div>
                </div>
              </div>

              <div className="cu-form-row">
                <div className="cu-form-group">
                  <label>Start Date</label>
                  <input type="date" value={skipData.start_date} onChange={e => setSkipData({...skipData, start_date: e.target.value})} required />
                </div>
                {skipData.skip_type === 'multiple' && (
                  <div className="cu-form-group">
                    <label>End Date</label>
                    <input type="date" value={skipData.end_date} onChange={e => setSkipData({...skipData, end_date: e.target.value})} required min={skipData.start_date} />
                  </div>
                )}
              </div>

              <div className="cu-form-group">
                <label>Reason (Optional)</label>
                <textarea value={skipData.reason} onChange={e => setSkipData({...skipData, reason: e.target.value})} rows="3" placeholder="Why is this customer skipping milk?" />
              </div>

              <div className="cu-form-footer">
                <button type="button" className="cu-btn-secondary" onClick={() => setShowSkipModal(false)}>Cancel</button>
                <button type="submit" className="cu-btn-primary" disabled={submitting}>{submitting ? 'Adding...' : 'Add Skip'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCustomerModal && selectedCustomerDetails && (
        <CustomerDetailsModal customer={selectedCustomerDetails} onClose={() => setShowCustomerModal(false)} />
      )}
    </div>
  );
};

export default CustomerUpdates;