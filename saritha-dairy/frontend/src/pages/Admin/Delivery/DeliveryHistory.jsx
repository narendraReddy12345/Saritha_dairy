// src/pages/Admin/Delivery/DeliveryHistory.jsx
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx'; // ✅ Install: npm install xlsx

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

  const getToken = () => sessionStorage.getItem('authToken');

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

  const getFilteredDeliveries = () => {
    let filtered = [...deliveries];

    const today = new Date().toISOString().split('T')[0];
    
    if (dateRange === 'today') {
      filtered = filtered.filter(d => d.delivery_date?.startsWith(today));
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      filtered = filtered.filter(d => d.delivery_date?.startsWith(yesterdayStr));
    } else if (dateRange === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(d => new Date(d.delivery_date) >= weekAgo);
    } else if (dateRange === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(d => new Date(d.delivery_date) >= monthAgo);
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

  // ✅ Export to Excel function
  const exportToExcel = () => {
    if (filteredDeliveries.length === 0) {
      showMessage('error', 'No data to export');
      return;
    }

    // Prepare data for Excel
    const excelData = filteredDeliveries.map((d, index) => ({
      'S.No': index + 1,
      'Date': d.delivery_date?.split('T')[0] || 'N/A',
      'Time': d.created_at ? new Date(d.created_at).toLocaleTimeString() : '',
      'Customer Name': d.customer_name || 'N/A',
      'Phone': d.customer_phone || 'N/A',
      'Apartment': d.apartment || 'N/A',
      'Flat No': d.flat_no || 'N/A',
      'Area': d.area || 'N/A',
      'City': d.city || 'N/A',
      'Landmark': d.landmark || '',
      'Product': d.product_name || 'N/A',
      'Pack Size': d.pack_size || 'N/A',
      'Quantity': d.quantity || 1,
      'Price (₹)': parseFloat(d.price || 0).toFixed(2),
      'Total Amount (₹)': parseFloat(d.total_amount || 0).toFixed(2),
      'Delivery Boy': d.delivery_boy_name || 'N/A',
      'Boy Phone': d.delivery_boy_phone || 'N/A',
      'Status': d.status === 'delivered' ? 'Delivered' : d.status === 'pending' ? 'Pending' : 'Missed'
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const colWidths = [
      { wch: 5 },  // S.No
      { wch: 12 }, // Date
      { wch: 10 }, // Time
      { wch: 25 }, // Customer Name
      { wch: 15 }, // Phone
      { wch: 25 }, // Apartment
      { wch: 8 },  // Flat No
      { wch: 20 }, // Area
      { wch: 15 }, // City
      { wch: 20 }, // Landmark
      { wch: 15 }, // Product
      { wch: 10 }, // Pack Size
      { wch: 8 },  // Quantity
      { wch: 10 }, // Price
      { wch: 15 }, // Total Amount
      { wch: 20 }, // Delivery Boy
      { wch: 15 }, // Boy Phone
      { wch: 12 }, // Status
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Delivery History');

    // Generate filename with current date and filters
    const dateStr = new Date().toISOString().split('T')[0];
    let fileName = `Delivery_History_${dateStr}`;
    
    if (dateRange !== 'all') fileName += `_${dateRange}`;
    if (filterBoy !== 'all') {
      const boy = deliveryBoys.find(b => b.id == filterBoy);
      if (boy) fileName += `_${boy.name.replace(/\s/g, '_')}`;
    }
    if (filterStatus !== 'all') fileName += `_${filterStatus}`;
    
    fileName += '.xlsx';

    // Download
    XLSX.writeFile(workbook, fileName);
    showMessage('success', `📥 Downloaded: ${fileName}`);
  };

  // ✅ Export to CSV function (no library needed)
  const exportToCSV = () => {
    if (filteredDeliveries.length === 0) {
      showMessage('error', 'No data to export');
      return;
    }

    const headers = [
      'S.No', 'Date', 'Time', 'Customer Name', 'Phone', 'Apartment', 
      'Flat No', 'Area', 'City', 'Landmark', 'Product', 'Pack Size', 
      'Quantity', 'Price', 'Total Amount', 'Delivery Boy', 'Boy Phone', 'Status'
    ];

    const rows = filteredDeliveries.map((d, index) => [
      index + 1,
      d.delivery_date?.split('T')[0] || '',
      d.created_at ? new Date(d.created_at).toLocaleTimeString() : '',
      d.customer_name || '',
      d.customer_phone || '',
      d.apartment || '',
      d.flat_no || '',
      d.area || '',
      d.city || '',
      d.landmark || '',
      d.product_name || '',
      d.pack_size || '',
      d.quantity || 1,
      parseFloat(d.price || 0).toFixed(2),
      parseFloat(d.total_amount || 0).toFixed(2),
      d.delivery_boy_name || '',
      d.delivery_boy_phone || '',
      d.status === 'delivered' ? 'Delivered' : d.status === 'pending' ? 'Pending' : 'Missed'
    ]);

    // Escape commas in data
    const escapeCSV = (val) => {
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Add BOM for Excel UTF-8 support
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `Delivery_History_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    showMessage('success', '📥 CSV downloaded!');
  };

  // Stats
  const totalAmount = filteredDeliveries.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayDeliveries = deliveries.filter(d => d.delivery_date?.startsWith(todayStr));
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
        {/* ✅ Export Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportToCSV} style={{
            background: 'rgba(255,255,255,0.2)', color: 'white',
            border: '1px solid rgba(255,255,255,0.3)', padding: '10px 16px',
            borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px'
          }}>
            📄 CSV
          </button>
          <button onClick={exportToExcel} style={{
            background: 'rgba(255,255,255,0.2)', color: 'white',
            border: '1px solid rgba(255,255,255,0.3)', padding: '10px 16px',
            borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px'
          }}>
            📥 Excel
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
        gap: '10px', 
        marginBottom: '20px' 
      }}>
        <StatCard icon="📦" value={filteredDeliveries.length} label="Total" />
        <StatCard icon="✅" value={todayDone.length} label="Done Today" color="#2e7d32" bg="#e8f5e9" />
        <StatCard icon="⏳" value={todayPending.length} label="Pending" color="#e65100" bg="#fff3e0" />
        <StatCard icon="💰" value={`₹${totalAmount.toLocaleString()}`} label="Amount" />
        <StatCard icon="👥" value={uniqueCustomers} label="Customers" />
      </div>

      {/* Filters Bar */}
      <div style={{
        background: 'white', padding: '16px', borderRadius: '12px',
        marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { key: 'all', label: 'All Time' },
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' }
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setDateRange(item.key)}
              style={{
                padding: '8px 14px', border: '1px solid #ddd', borderRadius: '6px',
                cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                background: dateRange === item.key ? '#1a472a' : 'white',
                color: dateRange === item.key ? 'white' : '#666'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', background: 'white', minWidth: '130px' }}>
          <option value="all">All Status</option>
          <option value="delivered">✅ Delivered</option>
          <option value="pending">⏳ Pending</option>
          <option value="missed">❌ Missed</option>
        </select>

        <select value={filterBoy} onChange={e => setFilterBoy(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', background: 'white', minWidth: '150px' }}>
          <option value="all">All Delivery Boys</option>
          {deliveryBoys.map(boy => (
            <option key={boy.id} value={boy.id}>{boy.name}</option>
          ))}
        </select>

        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
          <input type="text" placeholder="Search customer, area, delivery boy..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '9px 10px 9px 32px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px' }} />
        </div>

        <button onClick={loadData} style={{
          padding: '8px 14px', background: '#4caf50', color: 'white',
          border: 'none', borderRadius: '6px', cursor: 'pointer',
          fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap'
        }}>🔄 Refresh</button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>⏳</div>
          <p>Loading deliveries...</p>
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', background: 'white', borderRadius: '16px', color: '#666' }}>
          <div style={{ fontSize: '50px', marginBottom: '10px' }}>📭</div>
          <h3>No deliveries found</h3>
          <p>Try changing the filters or click "All Time"</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#1a472a', color: 'white' }}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Apartment</th>
                <th style={thStyle}>Flat</th>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Delivery Boy</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeliveries.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fafdfa' : 'white' }}>
                  <td style={tdStyle}>
                    <strong>{d.delivery_date?.split('T')[0] || 'N/A'}</strong>
                    <br /><small style={{ color: '#999', fontSize: '10px' }}>
                      {d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#1a472a' }}>
                    ₹{parseFloat(d.total_amount).toLocaleString()}
                  </td>
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
                      background: d.status === 'delivered' ? '#e8f5e9' : d.status === 'pending' ? '#fff3e0' : '#ffebee',
                      color: d.status === 'delivered' ? '#2e7d32' : d.status === 'pending' ? '#e65100' : '#c62828'
                    }}>
                      {d.status === 'delivered' ? '✅ Done' : d.status === 'pending' ? '⏳ Pending' : '❌ Missed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ✅ Download Buttons at Bottom */}
      {filteredDeliveries.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
          <button onClick={exportToCSV} style={{
            padding: '12px 24px', background: '#2196f3', color: 'white',
            border: 'none', borderRadius: '10px', cursor: 'pointer',
            fontWeight: 600, fontSize: '14px'
          }}>
            📄 Download CSV
          </button>
          <button onClick={exportToExcel} style={{
            padding: '12px 24px', background: '#4caf50', color: 'white',
            border: 'none', borderRadius: '10px', cursor: 'pointer',
            fontWeight: 600, fontSize: '14px'
          }}>
            📥 Download Excel
          </button>
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