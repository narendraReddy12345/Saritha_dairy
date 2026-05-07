// src/pages/Admin/Delivery/DeliveryHistory.jsx
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const DeliveryHistory = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryBoys, setDeliveryBoys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBoy, setFilterBoy] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [message, setMessage] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const getToken = () => sessionStorage.getItem('authToken');

  // ✅ Helper function to convert UTC date to IST date
  const convertToISTDate = (utcDateStr) => {
    if (!utcDateStr) return 'N/A';
    const date = new Date(utcDateStr);
    // Add 5 hours 30 minutes for IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  };

  // ✅ Helper to format datetime in IST
  const formatISTDateTime = (utcDateStr) => {
    if (!utcDateStr) return 'N/A';
    const date = new Date(utcDateStr);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    return istDate.toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      
      const [delRes, boyRes] = await Promise.all([
        fetch(`${API_URL}/delivery/all`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/delivery-boys`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const delData = await delRes.json();
      const boyData = await boyRes.json();

      if (delData.success) setDeliveries(delData.data || []);
      if (boyData.success) setDeliveryBoys(boyData.data || []);
    } catch (error) {
      console.error('Error:', error);
      showMessage('error', 'Failed to load data');
    }
    setLoading(false);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async (id, customerName) => {
    if (!window.confirm(`⚠️ Delete delivery record for "${customerName}"?\n\nThis will remove the delivery from history.`)) {
      return;
    }
    
    setDeletingId(id);
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/delivery/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (result.success) {
        showMessage('success', '🗑️ Delivery record deleted!');
        setDeliveries(prev => prev.filter(d => d.id !== id));
      } else {
        showMessage('error', result.error || 'Failed to delete');
      }
    } catch (error) {
      showMessage('error', 'Failed to connect to server');
    }
    setDeletingId(null);
  };

  const handleDeleteAll = async () => {
    const count = filteredDeliveries.length;
    if (count === 0) {
      showMessage('error', 'No records to delete');
      return;
    }
    
    if (!window.confirm(`⚠️ Delete ALL ${count} filtered delivery records?\n\nThis action CANNOT be undone!`)) {
      return;
    }
    
    const confirmText = prompt(`Type "DELETE" to confirm deleting ${count} records.`);
    if (confirmText !== 'DELETE') {
      showMessage('error', 'Deletion cancelled');
      return;
    }
    
    setDeletingId('all');
    try {
      const token = getToken();
      const ids = filteredDeliveries.map(d => d.id);
      
      const response = await fetch(`${API_URL}/delivery/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showMessage('success', `🗑️ ${result.deleted || ids.length} records deleted!`);
        loadData();
      } else {
        showMessage('error', result.error || 'Failed to delete');
      }
    } catch (error) {
      showMessage('error', 'Failed to connect');
    }
    setDeletingId(null);
  };

  // ✅ Get current IST date for filtering
  const getISTToday = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  };

  const getISTDateFromUTC = (utcDateStr) => {
    if (!utcDateStr) return '';
    const date = new Date(utcDateStr);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
  };

  const getFilteredDeliveries = () => {
    let filtered = [...deliveries];
    const istToday = getISTToday();
    
    if (dateRange === 'today') {
      filtered = filtered.filter(d => getISTDateFromUTC(d.delivery_date) === istToday);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istYesterday = new Date(yesterday.getTime() + istOffset).toISOString().split('T')[0];
      filtered = filtered.filter(d => getISTDateFromUTC(d.delivery_date) === istYesterday);
    } else if (dateRange === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istWeekAgo = new Date(weekAgo.getTime() + istOffset);
      filtered = filtered.filter(d => {
        const istDate = getISTDateFromUTC(d.delivery_date);
        return new Date(istDate) >= istWeekAgo;
      });
    } else if (dateRange === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istMonthAgo = new Date(monthAgo.getTime() + istOffset);
      filtered = filtered.filter(d => {
        const istDate = getISTDateFromUTC(d.delivery_date);
        return new Date(istDate) >= istMonthAgo;
      });
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(d => d.status === filterStatus);
    }

    if (filterBoy !== 'all') {
      filtered = filtered.filter(d => d.delivery_boy_id == filterBoy);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        (d.customer_name || '').toLowerCase().includes(term) ||
        (d.customer_phone || '').includes(term) ||
        (d.delivery_boy_name || '').toLowerCase().includes(term) ||
        (d.apartment || '').toLowerCase().includes(term) ||
        (d.area || '').toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const filteredDeliveries = getFilteredDeliveries();

  // Export functions
  const exportToCSV = () => {
    const headers = ['Date', 'Customer', 'Phone', 'Apartment', 'Flat', 'Product', 'Quantity', 'Amount', 'Delivery Boy', 'Status'];
    const rows = filteredDeliveries.map(d => [
      formatISTDateTime(d.delivery_date),
      d.customer_name || 'N/A',
      d.customer_phone || 'N/A',
      d.apartment || 'N/A',
      d.flat_no || 'N/A',
      d.product_name || 'N/A',
      d.quantity || 1,
      d.total_amount || 0,
      d.delivery_boy_name || 'N/A',
      d.status || 'pending'
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delivery_history_${getISTToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('success', '✅ CSV downloaded');
  };

  const exportToExcel = () => {
    const wsData = filteredDeliveries.map(d => ({
      'Date': formatISTDateTime(d.delivery_date),
      'Customer': d.customer_name || 'N/A',
      'Phone': d.customer_phone || 'N/A',
      'Apartment': d.apartment || 'N/A',
      'Flat': d.flat_no || 'N/A',
      'Product': d.product_name || 'N/A',
      'Quantity': d.quantity || 1,
      'Amount': d.total_amount || 0,
      'Delivery Boy': d.delivery_boy_name || 'N/A',
      'Status': d.status || 'pending'
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery History');
    XLSX.writeFile(wb, `delivery_history_${getISTToday()}.xlsx`);
    showMessage('success', '✅ Excel file downloaded');
  };

  // Stats
  const totalAmount = filteredDeliveries.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0);
  const istToday = getISTToday();
  const todayDeliveries = deliveries.filter(d => getISTDateFromUTC(d.delivery_date) === istToday);
  const todayDone = todayDeliveries.filter(d => d.status === 'delivered');
  const todayPending = todayDeliveries.filter(d => d.status === 'pending');
  const uniqueCustomers = [...new Set(filteredDeliveries.map(d => d.customer_id))].length;

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Toast */}
      {message && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          padding: '12px 20px', borderRadius: '10px', color: 'white',
          background: message.type === 'success' ? '#4caf50' : '#ef4444',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)', fontWeight: 500
        }}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a472a, #2d6a4f)',
        color: 'white', padding: '24px', borderRadius: '16px',
        marginBottom: '20px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '12px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px' }}>🚚 Delivery History</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '13px' }}>
            {filteredDeliveries.length} deliveries • {todayDone.length} done today • {todayPending.length} pending
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportToCSV} style={{
            background: 'rgba(255,255,255,0.2)', color: 'white',
            border: '1px solid rgba(255,255,255,0.3)', padding: '10px 16px',
            borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px'
          }}>📄 CSV</button>
          <button onClick={exportToExcel} style={{
            background: 'rgba(255,255,255,0.2)', color: 'white',
            border: '1px solid rgba(255,255,255,0.3)', padding: '10px 16px',
            borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px'
          }}>📥 Excel</button>
          {filteredDeliveries.length > 0 && (
            <button onClick={handleDeleteAll} disabled={deletingId === 'all'} style={{
              background: 'rgba(239, 68, 68, 0.3)', color: 'white',
              border: '1px solid rgba(239, 68, 68, 0.5)', padding: '10px 16px',
              borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px'
            }}>
              {deletingId === 'all' ? '⏳' : '🗑️'} Delete All
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <StatCard icon="📦" value={filteredDeliveries.length} label="Total" />
        <StatCard icon="✅" value={todayDone.length} label="Done Today" color="#2e7d32" bg="#e8f5e9" />
        <StatCard icon="⏳" value={todayPending.length} label="Pending" color="#e65100" bg="#fff3e0" />
        <StatCard icon="💰" value={`₹${totalAmount.toLocaleString()}`} label="Amount" />
        <StatCard icon="👥" value={uniqueCustomers} label="Customers" />
      </div>

      {/* Filters */}
      <div style={{
        background: 'white', padding: '16px', borderRadius: '12px',
        marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['all', 'today', 'yesterday', 'week', 'month'].map(key => (
            <button key={key} onClick={() => setDateRange(key)}
              style={{
                padding: '8px 14px', border: '1px solid #ddd', borderRadius: '6px',
                cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                background: dateRange === key ? '#1a472a' : 'white',
                color: dateRange === key ? 'white' : '#666'
              }}>{key === 'all' ? 'All Time' : key.charAt(0).toUpperCase() + key.slice(1)}</button>
          ))}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', background: 'white' }}>
          <option value="all">All Status</option>
          <option value="delivered">✅ Delivered</option>
          <option value="pending">⏳ Pending</option>
        </select>
        <select value={filterBoy} onChange={e => setFilterBoy(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', background: 'white' }}>
          <option value="all">All Boys</option>
          {deliveryBoys.map(boy => <option key={boy.id} value={boy.id}>{boy.name}</option>)}
        </select>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
          <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '9px 10px 9px 32px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px' }} />
        </div>
        <button onClick={loadData} style={{
          padding: '8px 14px', background: '#4caf50', color: 'white',
          border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px'
        }}>🔄 Refresh</button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>⏳</div><p>Loading...</p>
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', background: 'white', borderRadius: '16px', color: '#666' }}>
          <div style={{ fontSize: '50px', marginBottom: '10px' }}>📭</div>
          <h3>No deliveries found</h3>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px' }}>
            <thead>
              <tr style={{ background: '#1a472a', color: 'white' }}>
                <th style={thStyle}>Date (IST)</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Apartment</th>
                <th style={thStyle}>Flat</th>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Delivery Boy</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                <th style={{ ...thStyle, textAlign: 'center', width: '60px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeliveries.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fafdfa' : 'white' }}>
                  {/* ✅ Display IST date and time */}
                  <td style={tdStyle}>
                    <strong>{getISTDateFromUTC(d.delivery_date)}</strong>
                    <br /><small style={{ color: '#999', fontSize: '10px' }}>
                      {d.created_at ? formatISTDateTime(d.created_at).split(',')[1] : ''}
                    </small>
                  </td>
                  <td style={tdStyle}>
                    <strong>{d.customer_name || 'N/A'}</strong>
                    <br /><small style={{ color: '#888' }}>{d.customer_phone}</small>
                  </td>
                  <td style={tdStyle}>{d.apartment || 'N/A'}</td>
                  <td style={tdStyle}>
                    <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 600 }}>
                      {d.flat_no || 'N/A'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ background: '#f0fdf4', color: '#1a472a', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 500 }}>
                      {d.product_name} {d.pack_size} ×{d.quantity}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#1a472a' }}>₹{parseFloat(d.total_amount).toLocaleString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#4caf50', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                        {d.delivery_boy_name?.charAt(0) || '?'}
                      </span>
                      {d.delivery_boy_name || 'N/A'}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                      background: d.status === 'delivered' ? '#e8f5e9' : '#fff3e0',
                      color: d.status === 'delivered' ? '#2e7d32' : '#e65100'
                    }}>
                      {d.status === 'delivered' ? '✅ Done' : '⏳ Pending'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(d.id, d.customer_name)}
                      disabled={deletingId === d.id}
                      style={{
                        background: deletingId === d.id ? '#ccc' : '#fee2e2',
                        color: deletingId === d.id ? '#999' : '#ef4444',
                        border: 'none', padding: '6px 10px', borderRadius: '8px',
                        cursor: deletingId === d.id ? 'not-allowed' : 'pointer',
                        fontSize: '14px', transition: 'all 0.2s'
                      }}
                      title="Delete delivery record"
                    >
                      {deletingId === d.id ? '⏳' : '🗑️'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom Buttons */}
      {filteredDeliveries.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
          <button onClick={exportToCSV} style={{
            padding: '12px 24px', background: '#2196f3', color: 'white',
            border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px'
          }}>📄 Download CSV</button>
          <button onClick={exportToExcel} style={{
            padding: '12px 24px', background: '#4caf50', color: 'white',
            border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px'
          }}>📥 Download Excel</button>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, value, label, color = '#1a472a', bg = 'white' }) => (
  <div style={{
    background: bg, padding: '14px', borderRadius: '12px',
    display: 'flex', alignItems: 'center', gap: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
  }}>
    <span style={{ fontSize: '24px' }}>{icon}</span>
    <div>
      <h3 style={{ fontSize: '18px', color: color, margin: 0 }}>{value}</h3>
      <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0' }}>{label}</p>
    </div>
  </div>
);

const thStyle = {
  padding: '12px 14px', textAlign: 'left', fontSize: '12px',
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px'
};

const tdStyle = {
  padding: '10px 14px', fontSize: '13px', color: '#444'
};

export default DeliveryHistory;