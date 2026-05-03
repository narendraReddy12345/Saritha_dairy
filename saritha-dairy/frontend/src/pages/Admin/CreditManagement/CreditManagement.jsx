// src/pages/Admin/CreditManagement/CreditManagement.jsx
import React, { useState, useEffect, useRef } from 'react';
import './CreditManagement.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const round2 = (num) => Math.round(parseFloat(num || 0) * 100) / 100;

const CreditManagement = () => {
  const [creditCustomers, setCreditCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all'); // 'week', 'month', 'all'
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerLedger, setCustomerLedger] = useState([]);
  const [filteredLedger, setFilteredLedger] = useState([]);
  
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entry, setEntry] = useState({
    productName: '', packSize: '', price: '', quantity: 1
  });

  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    loadData();
    fetchProducts();
  }, []);

  // Filter ledger when historyFilter or customerLedger changes
  useEffect(() => {
    filterLedgerByDate();
  }, [historyFilter, customerLedger, selectedCustomer]);

  const filterLedgerByDate = () => {
    if (!selectedCustomer) return;
    
    const now = new Date();
    let filtered = [...customerLedger];
    
    if (historyFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date || entry.created_at);
        return entryDate >= weekAgo;
      });
    } else if (historyFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date || entry.created_at);
        return entryDate >= monthAgo;
      });
    }
    
    filtered.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    setFilteredLedger(filtered);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getToken = () => sessionStorage.getItem('authToken');
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const loadData = async () => {
    try {
      const res = await fetch(`${API_URL}/credit`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        const grouped = groupByCustomer(data.data || []);
        setCreditCustomers(grouped);
      }
    } catch (error) { console.error('Error:', error); }
    setLoading(false);
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.data) {
        const productsWithPacks = data.data.map(product => {
          let packs = [];
          try {
            packs = typeof product.packs === 'string' ? JSON.parse(product.packs) : (product.packs || []);
          } catch (e) { packs = []; }
          return { ...product, packs };
        });
        setProducts(productsWithPacks);
      }
    } catch (error) { console.error('Error:', error); }
  };

  const groupByCustomer = (entries) => {
    const grouped = {};
    
    entries.forEach(entry => {
      const key = entry.phone;
      if (!grouped[key]) {
        grouped[key] = {
          customerName: entry.customer_name,
          phone: entry.phone,
          entries: [],
          totalCredit: 0,
          totalPaid: 0,
          totalBalance: 0
        };
      }
      grouped[key].entries.push(entry);
    });
    
    Object.values(grouped).forEach(c => {
      c.totalCredit = round2(c.entries.reduce((sum, e) => sum + parseFloat(e.total_amount || 0), 0));
      c.totalPaid = round2(c.entries.reduce((sum, e) => sum + parseFloat(e.paid_amount || 0), 0));
      c.totalBalance = round2(c.totalCredit - c.totalPaid);
      if (Math.abs(c.totalBalance) < 0.01) c.totalBalance = 0;
      c.entries.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    });
    
    return Object.values(grouped);
  };

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 2500);
  };

  const openLedger = (customer) => {
    setSelectedCustomer(customer);
    setCustomerLedger(customer.entries);
    setFilteredLedger(customer.entries);
    setHistoryFilter('all');
  };

  const handleProductSelect = (productName, packSize, price) => {
    setEntry({ ...entry, productName, packSize, price: price || '' });
  };

  const saveEntry = async () => {
    if (!entry.productName || !entry.price) {
      showMsg('error', 'Please select a product');
      return;
    }

    const totalAmount = round2(parseFloat(entry.price) * parseInt(entry.quantity || 1));
    const productDisplay = entry.packSize 
      ? `${entry.productName} (${entry.packSize})` 
      : entry.productName;

    const payload = {
      customerName: selectedCustomer.customerName,
      phone: selectedCustomer.phone,
      date: new Date().toISOString().split('T')[0],
      items: [{
        product: productDisplay,
        quantity: parseInt(entry.quantity || 1),
        price: round2(entry.price),
        total: totalAmount
      }],
      totalAmount: totalAmount,
      paidAmount: 0,
      notes: ''
    };

    try {
      const res = await fetch(`${API_URL}/credit`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', '✅ Entry added!');
        setEntry({ productName: '', packSize: '', price: '', quantity: 1 });
        setShowAddEntry(false);
        refreshLedger(selectedCustomer.phone);
      } else { showMsg('error', data.error || 'Failed'); }
    } catch (error) { showMsg('error', 'Server error'); }
  };

  const refreshLedger = async (phone) => {
    try {
      const res = await fetch(`${API_URL}/credit`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        const grouped = groupByCustomer(data.data || []);
        setCreditCustomers(grouped);
        const customer = grouped.find(c => c.phone === phone);
        if (customer) {
          setSelectedCustomer(customer);
          setCustomerLedger(customer.entries);
          setFilteredLedger(customer.entries);
          filterLedgerByDate();
        }
      }
    } catch (error) { console.error('Error:', error); }
  };

  const recordPayment = async () => {
    const amount = round2(paymentAmount);
    
    if (amount <= 0 || amount > round2(selectedCustomer.totalBalance)) {
      showMsg('error', `Invalid amount. Max: ₹${round2(selectedCustomer.totalBalance).toLocaleString()}`);
      return;
    }

    let remainingToPay = amount;
    const pendingEntries = customerLedger
      .filter(e => round2(e.remaining_amount) > 0)
      .sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date));

    if (pendingEntries.length === 0) {
      showMsg('error', 'No pending entries to pay');
      return;
    }

    try {
      for (const entry of pendingEntries) {
        if (remainingToPay < 0.01) break;
        
        const entryRemaining = round2(entry.remaining_amount);
        const payForThis = round2(Math.min(remainingToPay, entryRemaining));
        
        if (payForThis < 0.01) continue;
        
        await fetch(`${API_URL}/credit/${entry.id}/settlement`, {
          method: 'POST', headers: getHeaders(), 
          body: JSON.stringify({ amount: payForThis, note: 'Payment' })
        });
        
        remainingToPay = round2(remainingToPay - payForThis);
      }

      showMsg('success', `✅ ₹${amount.toLocaleString()} recorded!`);
      setShowPayment(false);
      setPaymentAmount('');
      refreshLedger(selectedCustomer.phone);
    } catch (error) { showMsg('error', 'Payment failed'); }
  };

  const deleteEntry = async (id, name) => {
    if (window.confirm(`Delete entry for "${name}"?`)) {
      await fetch(`${API_URL}/credit/${id}`, { method: 'DELETE', headers: getHeaders() });
      showMsg('success', 'Deleted');
      refreshLedger(selectedCustomer.phone);
    }
  };

  const addNewCustomer = () => {
    if (!newCustomer.name || !newCustomer.phone) {
      showMsg('error', 'Please enter name and phone');
      return;
    }
    const emptyCustomer = {
      customerName: newCustomer.name, phone: newCustomer.phone,
      entries: [], totalCredit: 0, totalPaid: 0, totalBalance: 0
    };
    setSelectedCustomer(emptyCustomer);
    setCustomerLedger([]);
    setFilteredLedger([]);
    setShowNewCustomer(false);
    setNewCustomer({ name: '', phone: '' });
    showMsg('success', 'Customer created! Add entries below.');
  };

  // ==================== GENERATE IMAGE ====================

  const generateReceiptImage = (customer) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const width = 500;
      const padding = 30;
      let y = 0;
      
      const entries = customer.entries || customerLedger || [];
      const isAllCustomers = !customer.customerName;
      
      let height = 350;
      if (isAllCustomers) {
        const pendingList = creditCustomers.filter(c => c.totalBalance > 0);
        height = 300 + (pendingList.length * 50) + 80;
      } else {
        height = 350 + (Math.min(entries.length, 8) * 40) + 80;
      }
      
      canvas.width = width;
      canvas.height = Math.max(height, 400);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(0, 0, width, 60);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SARITHA DAIRY', width / 2, 38);
      
      y = 85;
      ctx.fillStyle = '#666666';
      ctx.font = '13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, width / 2, y);
      
      y += 12;
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      
      if (isAllCustomers) {
        const totalPendingAmount = round2(creditCustomers.reduce((s, c) => s + c.totalBalance, 0));
        const pendingCustomers = creditCustomers.filter(c => c.totalBalance > 0);
        
        y += 25;
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PENDING CREDITS', width / 2, y);
        
        y += 8;
        ctx.textAlign = 'center';
        ctx.font = '28px Arial';
        ctx.fillStyle = '#e65100';
        ctx.fillText(`₹${totalPendingAmount.toLocaleString()}`, width / 2, y);
        
        y += 18;
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText(`${pendingCustomers.length} customer(s) have pending balance`, width / 2, y);
        
        if (pendingCustomers.length > 0) {
          y += 25;
          ctx.fillStyle = '#333';
          ctx.font = 'bold 13px Arial';
          ctx.textAlign = 'left';
          ctx.fillText('Customer List:', padding, y);
          
          y += 18;
          pendingCustomers.slice(0, 8).forEach((c, i) => {
            if (i % 2 === 0) {
              ctx.fillStyle = '#f9fafb';
              ctx.fillRect(padding - 5, y - 12, width - (padding * 2) + 10, 38);
            }
            
            ctx.fillStyle = '#333';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${i + 1}. ${c.customerName}`, padding, y);
            
            ctx.fillStyle = '#e65100';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`₹${round2(c.totalBalance).toLocaleString()}`, width - padding, y);
            
            y += 18;
            ctx.fillStyle = '#888';
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`   📱 ${c.phone}`, padding, y);
            
            y += 22;
          });
        }
        
      } else {
        y += 20;
        ctx.fillStyle = '#1a472a';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(customer.customerName, width / 2, y);
        
        y += 22;
        ctx.fillStyle = '#666';
        ctx.font = '13px Arial';
        ctx.fillText(`📱 ${customer.phone}`, width / 2, y);
        
        y += 25;
        const boxX = padding;
        const boxW = width - (padding * 2);
        
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(boxX, y, boxW, 90);
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, y, boxW, 90);
        
        y += 22;
        ctx.fillStyle = '#555';
        ctx.font = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Total Credit', boxX + 15, y);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`₹${round2(customer.totalCredit).toLocaleString()}`, boxX + boxW - 15, y);
        
        y += 24;
        ctx.fillStyle = '#555';
        ctx.font = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Total Paid', boxX + 15, y);
        ctx.fillStyle = '#2e7d32';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`₹${round2(customer.totalPaid).toLocaleString()}`, boxX + boxW - 15, y);
        
        y += 24;
        ctx.strokeStyle = '#ddd';
        ctx.beginPath();
        ctx.moveTo(boxX + 15, y - 2);
        ctx.lineTo(boxX + boxW - 15, y - 2);
        ctx.stroke();
        
        const balance = round2(customer.totalBalance);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('BALANCE DUE', boxX + 15, y + 8);
        ctx.fillStyle = balance > 0 ? '#e65100' : '#2e7d32';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`₹${balance.toLocaleString()}`, boxX + boxW - 15, y + 8);
      }
      
      y = canvas.height - 55;
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      
      y += 22;
      ctx.fillStyle = '#888';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Saritha Dairy - JNTU, Hyderabad', width / 2, y);
      
      y += 16;
      ctx.fillText('📞 9398263810 | Pure by Nature, Trusted by Families', width / 2, y);
      
      resolve(canvas.toDataURL('image/png'));
    });
  };

  // ==================== WHATSAPP ====================

  const sendWhatsAppWithImage = async (customer) => {
    let phoneNumber = customer.phone || '9398263810';
    phoneNumber = phoneNumber.replace(/\D/g, '');
    
    try {
      const imageDataUrl = await generateReceiptImage(customer);
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'statement.png', { type: 'image/png' });
      
      let caption = `🧾 *SARITHA DAIRY*\n\n`;
      if (customer.customerName) {
        caption += `Statement - ${customer.customerName}\n`;
        caption += `💰 Credit: ₹${round2(customer.totalCredit).toLocaleString()}\n`;
        caption += `⚠️ Balance: ₹${round2(customer.totalBalance).toLocaleString()}`;
      }
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Statement', text: caption, files: [file] });
        showMsg('success', '✅ Sent!');
      } else {
        const downloadLink = document.createElement('a');
        downloadLink.href = imageDataUrl;
        downloadLink.download = 'statement.png';
        downloadLink.click();
        setTimeout(() => window.open(`https://wa.me/91${phoneNumber}?text=${encodeURIComponent(caption)}`, '_blank'), 300);
        showMsg('success', '📱 Opening WhatsApp...');
      }
    } catch (error) {
      window.open(`https://wa.me/91${phoneNumber}?text=${encodeURIComponent('Statement from Saritha Dairy')}`, '_blank');
      showMsg('success', '📱 Opening WhatsApp...');
    }
    setShowExportMenu(false);
  };

  const downloadReport = async () => {
    const customer = selectedCustomer || {};
    const imageDataUrl = await generateReceiptImage(customer);
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = 'statement.png';
    link.click();
    setShowExportMenu(false);
    showMsg('success', '📄 Downloaded!');
  };

  // Get filtered totals
  const getFilteredTotals = () => {
    const entries = historyFilter === 'all' ? customerLedger : filteredLedger;
    const totalCredit = round2(entries.reduce((s, e) => s + parseFloat(e.total_amount || 0), 0));
    const totalPaid = round2(entries.reduce((s, e) => s + parseFloat(e.paid_amount || 0), 0));
    return { 
      totalCredit, 
      totalPaid, 
      balance: round2(totalCredit - totalPaid),
      count: entries.length 
    };
  };

  const totalPending = round2(creditCustomers.reduce((s, c) => s + c.totalBalance, 0));
  const pendingCount = creditCustomers.filter(c => c.totalBalance > 0).length;

  const getProductIcon = (name) => {
    if (!name) return '📦';
    const n = name.toLowerCase();
    if (n.includes('milk')) return '🥛';
    if (n.includes('curd')) return '🥄';
    if (n.includes('paneer')) return '🧀';
    if (n.includes('ghee')) return '🫕';
    if (n.includes('butter')) return '🧈';
    if (n.includes('tea')) return '☕';
    return '📦';
  };

  const filteredCustomers = creditCustomers.filter(c =>
    c.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  // ========== LEDGER VIEW ==========
  if (selectedCustomer) {
    const displayBalance = round2(selectedCustomer.totalBalance);
    const filteredTotals = getFilteredTotals();
    
    return (
      <div className="cr-container">
        {message && (
          <div className={`cr-toast ${message.type}`}>
            {message.text}
            <button onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        <div className="cr-ledger-header">
          <button className="cr-back-btn" onClick={() => setSelectedCustomer(null)}>← Back</button>
          <div className="cr-ledger-info">
            <div className="cr-ledger-avatar">{selectedCustomer.customerName?.charAt(0)?.toUpperCase()}</div>
            <div>
              <h2>{selectedCustomer.customerName}</h2>
              <p>📱 {selectedCustomer.phone}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div ref={exportMenuRef} style={{ position: 'relative' }}>
              <button 
                className="cr-btn-outline" 
                onClick={() => setShowExportMenu(!showExportMenu)}
                style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                📤 Share
              </button>
              
              {showExportMenu && (
                <div className="cr-export-dropdown">
                  <button onClick={() => sendWhatsAppWithImage(selectedCustomer)} className="cr-export-item">
                    <span className="cr-export-icon">💬</span>
                    <div>
                      <div className="cr-export-title">Send Statement</div>
                      <div className="cr-export-subtitle">To {selectedCustomer.phone}</div>
                    </div>
                  </button>
                  <button onClick={downloadReport} className="cr-export-item">
                    <span className="cr-export-icon">📥</span>
                    <div>
                      <div className="cr-export-title">Download</div>
                      <div className="cr-export-subtitle">Save as PNG</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
            
            <div className="cr-ledger-balance">
              <span>{displayBalance > 0 ? 'Balance Due' : 'Status'}</span>
              <strong style={{color: displayBalance > 0 ? '#e65100' : '#2e7d32'}}>
                {displayBalance > 0 ? `₹${displayBalance.toLocaleString()}` : '✅ Clear'}
              </strong>
            </div>
          </div>
        </div>

        {/* History Filter Tabs */}
        <div className="cr-history-filter">
          <button 
            className={`cr-filter-btn ${historyFilter === 'week' ? 'active' : ''}`}
            onClick={() => setHistoryFilter('week')}
          >
            📅 This Week
          </button>
          <button 
            className={`cr-filter-btn ${historyFilter === 'month' ? 'active' : ''}`}
            onClick={() => setHistoryFilter('month')}
          >
            📆 This Month
          </button>
          <button 
            className={`cr-filter-btn ${historyFilter === 'all' ? 'active' : ''}`}
            onClick={() => setHistoryFilter('all')}
          >
            📋 All Time
          </button>
        </div>

        {/* Filtered Summary */}
        {historyFilter !== 'all' && (
          <div className="cr-filter-summary">
            <span>
              {historyFilter === 'week' ? '📅 This Week:' : '📆 This Month:'} 
              <strong> {filteredTotals.count} entries</strong> • 
              💰 <strong>₹{filteredTotals.totalCredit.toLocaleString()}</strong> credit • 
              ✅ <strong>₹{filteredTotals.totalPaid.toLocaleString()}</strong> paid
            </span>
          </div>
        )}

        <div className="cr-ledger-summary">
          <div className="cr-summary-item">
            <span>Total Credit</span>
            <strong>₹{round2(selectedCustomer.totalCredit).toLocaleString()}</strong>
          </div>
          <div className="cr-summary-item">
            <span>Total Paid</span>
            <strong style={{color:'#2e7d32'}}>₹{round2(selectedCustomer.totalPaid).toLocaleString()}</strong>
          </div>
          <div className="cr-summary-item">
            <span>Balance</span>
            <strong style={{color: displayBalance > 0 ? '#e65100' : '#2e7d32'}}>
              ₹{displayBalance.toLocaleString()}
            </strong>
          </div>
        </div>

        <div className="cr-ledger-actions">
          <button className="cr-btn-add" onClick={() => setShowAddEntry(true)}>➕ Add Entry</button>
          {displayBalance > 0 && (
            <button className="cr-btn-pay-lg" onClick={() => { 
              setPaymentAmount(displayBalance.toString());
              setShowPayment(true); 
            }}>💰 Record Payment</button>
          )}
        </div>

        {/* Ledger Table */}
        <div className="cr-ledger-table-wrap">
          <table className="cr-ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr><td colSpan="8" className="cr-empty-row">
                  {historyFilter !== 'all' 
                    ? `No entries found for this ${historyFilter === 'week' ? 'week' : 'month'}`
                    : 'No entries yet. Click "➕ Add Entry" to start.'}
                </td></tr>
              ) : (
                (() => {
                  let runningBalance = 0;
                  const sorted = [...filteredLedger].sort((a, b) => 
                    new Date(a.created_at || a.date) - new Date(b.created_at || b.date)
                  );
                  return sorted.map(entry => {
                    const amount = round2(entry.total_amount);
                    const paid = round2(entry.paid_amount);
                    runningBalance = round2(runningBalance + amount - paid);
                    
                    return (
                      <tr key={entry.id} className={entry.status === 'settled' ? 'settled-row' : ''}>
                        <td>{new Date(entry.date || entry.created_at).toLocaleDateString('en-IN')}</td>
                        <td>{entry.items?.map((item, i) => (
                          <div key={i} className="cr-entry-product">{getProductIcon(item.product)} {item.product}</div>
                        ))}</td>
                        <td>{entry.items?.[0]?.quantity || 1}</td>
                        <td className="cr-amount">₹{amount.toLocaleString()}</td>
                        <td className="cr-paid" style={{color: paid > 0 ? '#2e7d32' : '#888'}}>
                          {paid > 0 ? `₹${paid.toLocaleString()}` : '-'}
                        </td>
                        <td className="cr-balance" style={{color: runningBalance > 0 ? '#e65100' : '#2e7d32', fontWeight: 700}}>
                          ₹{runningBalance.toLocaleString()}
                        </td>
                        <td>
                          <span className={`cr-status-dot ${entry.status}`}>
                            {entry.status === 'settled' ? 'Paid' : entry.status === 'partial' ? 'Part' : 'Due'}
                          </span>
                        </td>
                        <td>
                          <button className="cr-btn-del-sm" onClick={() => deleteEntry(entry.id, selectedCustomer.customerName)}>🗑️</button>
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>

        {/* Add Entry Modal */}
        {showAddEntry && (
          <div className="cr-modal" onClick={() => setShowAddEntry(false)}>
            <div className="cr-modal-box" onClick={e => e.stopPropagation()}>
              <div className="cr-modal-head">
                <h2>➕ Add Entry for {selectedCustomer.customerName}</h2>
                <button className="cr-close" onClick={() => setShowAddEntry(false)}>✕</button>
              </div>
              <div className="cr-modal-body">
                <div className="cr-product-list">
                  {products.map(product => (
                    <div key={product.id} className="cr-product-group">
                      <div className="cr-product-header">
                        <span className="cr-product-icon">{getProductIcon(product.name)}</span>
                        <span className="cr-product-title">{product.name}</span>
                      </div>
                      <div className="cr-pack-list">
                        {product.packs?.length > 0 ? (
                          product.packs.map((pack, idx) => (
                            <button key={idx} className={`cr-pack-btn ${entry.productName === product.name && entry.packSize === `${pack.size}${pack.unit}` ? 'selected' : ''}`}
                              onClick={() => handleProductSelect(product.name, `${pack.size}${pack.unit}`, pack.price)}>
                              {pack.size}{pack.unit} - ₹{pack.price}
                            </button>
                          ))
                        ) : (
                          <button className={`cr-pack-btn ${entry.productName === product.name ? 'selected' : ''}`}
                            onClick={() => handleProductSelect(product.name, '', '')}>{product.name}</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {entry.productName && (
                  <>
                    <div className="cr-selected-info">Selected: <strong>{entry.productName}</strong> {entry.packSize && `(${entry.packSize})`}</div>
                    <div className="cr-row">
                      <div className="cr-field"><label>Price (₹)</label><input type="number" value={entry.price} onChange={e => setEntry({...entry, price: e.target.value})} /></div>
                      <div className="cr-field"><label>Quantity</label><input type="number" value={entry.quantity} onChange={e => setEntry({...entry, quantity: e.target.value})} min="1" /></div>
                    </div>
                    <div className="cr-entry-total">Total: <strong>₹{round2(parseFloat(entry.price||0) * parseInt(entry.quantity||1)).toLocaleString()}</strong></div>
                    <button className="cr-btn-save" onClick={saveEntry}>💾 Save Entry</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPayment && (
          <div className="cr-modal" onClick={() => setShowPayment(false)}>
            <div className="cr-modal-box cr-modal-sm" onClick={e => e.stopPropagation()}>
              <div className="cr-modal-head"><h2>💰 Record Payment</h2><button className="cr-close" onClick={() => setShowPayment(false)}>✕</button></div>
              <div className="cr-modal-body">
                <p style={{marginBottom:'12px'}}>Balance: <strong style={{color:'#e65100'}}>₹{displayBalance.toLocaleString()}</strong></p>
                <div className="cr-field"><label>Amount (₹)</label><input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="cr-input-lg" autoFocus /></div>
                <div className="cr-pay-btns">
                  <button className="cr-btn-cancel" onClick={() => setShowPayment(false)}>Cancel</button>
                  <button className="cr-btn-save" onClick={recordPayment}>✅ Confirm</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== MAIN CUSTOMER LIST ==========
  return (
    <div className="cr-container">
      {message && (
        <div className={`cr-toast ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="cr-header">
        <div>
          <h1>📒 Credit Book</h1>
          <p>{creditCustomers.length} customers • ₹{totalPending.toLocaleString()} pending</p>
        </div>
        <div style={{display:'flex', gap:'8px'}}>
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button 
              className="cr-btn-outline" 
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              📤 Share
            </button>
            
            {showExportMenu && (
              <div className="cr-export-dropdown">
                <button onClick={() => sendWhatsAppWithImage({})} className="cr-export-item">
                  <span className="cr-export-icon">💬</span>
                  <div>
                    <div className="cr-export-title">Send Summary</div>
                    <div className="cr-export-subtitle">Pending credits</div>
                  </div>
                </button>
                <button onClick={downloadReport} className="cr-export-item">
                  <span className="cr-export-icon">📥</span>
                  <div>
                    <div className="cr-export-title">Download</div>
                    <div className="cr-export-subtitle">Save as PNG</div>
                  </div>
                </button>
              </div>
            )}
          </div>
          <button className="cr-btn-outline" onClick={() => setShowNewCustomer(true)}>+ New Customer</button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="cr-banner">⚠️ {pendingCount} customer{pendingCount > 1 ? 's' : ''} with pending: <strong>₹{totalPending.toLocaleString()}</strong></div>
      )}

      <div className="cr-search-wrap">
        <span>🔍</span>
        <input type="text" placeholder="Search customer name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="cr-search-input" />
      </div>

      {loading ? (
        <div className="cr-center">Loading...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="cr-center"><span style={{fontSize:'50px'}}>📒</span><h3>No customers</h3><p>Click "New Customer" to add one</p></div>
      ) : (
        <div className="cr-grid">
          {filteredCustomers.map(customer => {
            const bal = round2(customer.totalBalance);
            return (
              <div key={customer.phone} className="cr-card cr-card-clickable" onClick={() => openLedger(customer)}>
                <div className="cr-card-top">
                  <div className="cr-card-avatar">{customer.customerName?.charAt(0)?.toUpperCase()}</div>
                  <div className="cr-card-info">
                    <h3>{customer.customerName}</h3>
                    <p>📱 {customer.phone}</p>
                    <p className="cr-card-entries">{customer.entries.length} entries</p>
                  </div>
                  <div className="cr-card-balance-box">
                    <span>{bal > 0 ? 'Due' : 'Status'}</span>
                    <strong style={{color: bal > 0 ? '#e65100' : '#2e7d32'}}>
                      {bal > 0 ? `₹${bal.toLocaleString()}` : '✅ Clear'}
                    </strong>
                  </div>
                </div>
                <div className="cr-bar-wrap">
                  <div className="cr-bar">
                    <div className="cr-bar-fill" style={{width: `${customer.totalCredit > 0 ? Math.round((customer.totalPaid / customer.totalCredit) * 100) : 0}%`}}></div>
                  </div>
                </div>
                <div className="cr-card-click-hint">Click to view ledger →</div>
              </div>
            );
          })}
        </div>
      )}

      {showNewCustomer && (
        <div className="cr-modal" onClick={() => setShowNewCustomer(false)}>
          <div className="cr-modal-box cr-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="cr-modal-head"><h2>👤 New Customer</h2><button className="cr-close" onClick={() => setShowNewCustomer(false)}>✕</button></div>
            <div className="cr-modal-body">
              <div className="cr-field"><label>Customer Name *</label><input type="text" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="Enter name" autoFocus /></div>
              <div className="cr-field"><label>Phone Number *</label><input type="tel" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="10 digit" maxLength={10} /></div>
              <button className="cr-btn-save" onClick={addNewCustomer}>Create Customer & Open Ledger</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditManagement;