// src/pages/Admin/CreditManagement/CreditManagement.jsx
import React, { useState, useEffect, useRef } from 'react';
import './CreditManagement.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

// Helper to round to 2 decimal places
const round2 = (num) => Math.round(parseFloat(num || 0) * 100) / 100;

const CreditManagement = () => {
  const [creditCustomers, setCreditCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerLedger, setCustomerLedger] = useState([]);
  
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

  // Close export menu when clicking outside
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
    setShowNewCustomer(false);
    setNewCustomer({ name: '', phone: '' });
    showMsg('success', 'Customer created! Add entries below.');
  };

  // ==================== EXPORT FUNCTIONS ====================

  // Generate CSV content
  const generateCSV = (data, filename) => {
    let csv = '';
    
    if (selectedCustomer) {
      // Single customer ledger export
      csv = 'Date,Product,Quantity,Amount,Paid,Balance,Status\n';
      let runningBalance = 0;
      const sorted = [...customerLedger].sort((a, b) => 
        new Date(a.created_at || a.date) - new Date(b.created_at || b.date)
      );
      sorted.forEach(entry => {
        const amount = round2(entry.total_amount);
        const paid = round2(entry.paid_amount);
        runningBalance = round2(runningBalance + amount - paid);
        const product = entry.items?.map(item => item.product).join('; ') || '';
        const qty = entry.items?.[0]?.quantity || 1;
        csv += `${new Date(entry.date || entry.created_at).toLocaleDateString('en-IN')},${product},${qty},${amount},${paid},${runningBalance},${entry.status}\n`;
      });
      // Add summary
      csv += `\n,,,Total: ${round2(selectedCustomer.totalCredit)},Total: ${round2(selectedCustomer.totalPaid)},Balance: ${round2(selectedCustomer.totalBalance)},\n`;
    } else {
      // All customers summary export
      csv = 'Customer Name,Phone,Entries,Total Credit,Total Paid,Balance,Status\n';
      creditCustomers.forEach(c => {
        const bal = round2(c.totalBalance);
        const status = bal <= 0 ? 'Clear' : 'Pending';
        csv += `"${c.customerName}",${c.phone},${c.entries.length},${round2(c.totalCredit)},${round2(c.totalPaid)},${bal},${status}\n`;
      });
    }

    // Download CSV
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    
    setShowExportMenu(false);
    showMsg('success', '✅ Downloaded!');
  };

  // Generate PDF-like print (Using browser print as HTML table)
  const generatePDF = () => {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Credit Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1a472a; padding-bottom: 10px; }
          .header h1 { color: #1a472a; margin: 0; font-size: 20px; }
          .header p { color: #666; margin: 5px 0 0; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          th { background: #1a472a; color: white; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
          td { padding: 8px 10px; border-bottom: 1px solid #e0e0e0; }
          tr:nth-child(even) { background: #f9fafb; }
          .amount { text-align: right; font-weight: 600; }
          .balance-positive { color: #e65100; font-weight: 700; }
          .balance-zero { color: #2e7d32; font-weight: 700; }
          .summary { background: #f0fdf4; padding: 12px; border-radius: 8px; margin-top: 20px; }
          .summary h3 { margin: 0 0 10px; color: #1a472a; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .summary-item { text-align: center; }
          .summary-item span { display: block; font-size: 11px; color: #666; }
          .summary-item strong { display: block; font-size: 16px; margin-top: 4px; }
          .badge { padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
          .badge-settled { background: #e8f5e9; color: #2e7d32; }
          .badge-partial { background: #fff3e0; color: #e65100; }
          .badge-pending { background: #ffebee; color: #c62828; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #999; border-top: 1px solid #e0e0e0; padding-top: 10px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🥛 Saritha Dairy - Credit Report</h1>
          <p>Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-IN')}</p>
        </div>
    `;

    if (selectedCustomer) {
      // Single customer detailed report
      html += `
        <h2 style="color: #1a472a;">Customer: ${selectedCustomer.customerName}</h2>
        <p style="color: #666;">📱 ${selectedCustomer.phone}</p>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Amount (₹)</th>
              <th>Paid (₹)</th>
              <th>Balance (₹)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
      `;

      let runningBalance = 0;
      const sorted = [...customerLedger].sort((a, b) => 
        new Date(a.created_at || a.date) - new Date(b.created_at || b.date)
      );
      sorted.forEach(entry => {
        const amount = round2(entry.total_amount);
        const paid = round2(entry.paid_amount);
        runningBalance = round2(runningBalance + amount - paid);
        const statusClass = entry.status === 'settled' ? 'badge-settled' : entry.status === 'partial' ? 'badge-partial' : 'badge-pending';
        const statusText = entry.status === 'settled' ? 'Paid' : entry.status === 'partial' ? 'Part' : 'Due';
        
        html += `
          <tr>
            <td>${new Date(entry.date || entry.created_at).toLocaleDateString('en-IN')}</td>
            <td>${entry.items?.map(item => item.product).join(', ') || ''}</td>
            <td>${entry.items?.[0]?.quantity || 1}</td>
            <td class="amount">₹${amount.toLocaleString()}</td>
            <td class="amount">${paid > 0 ? '₹' + paid.toLocaleString() : '-'}</td>
            <td class="amount ${runningBalance > 0 ? 'balance-positive' : 'balance-zero'}">₹${runningBalance.toLocaleString()}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
        
        <div class="summary">
          <h3>Summary</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <span>Total Credit</span>
              <strong>₹${round2(selectedCustomer.totalCredit).toLocaleString()}</strong>
            </div>
            <div class="summary-item">
              <span>Total Paid</span>
              <strong style="color:#2e7d32">₹${round2(selectedCustomer.totalPaid).toLocaleString()}</strong>
            </div>
            <div class="summary-item">
              <span>Balance</span>
              <strong style="color:${selectedCustomer.totalBalance > 0 ? '#e65100' : '#2e7d32'}">₹${round2(selectedCustomer.totalBalance).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      `;
    } else {
      // All customers summary report
      html += `
        <h2 style="color: #1a472a;">All Customers Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Entries</th>
              <th>Total Credit (₹)</th>
              <th>Total Paid (₹)</th>
              <th>Balance (₹)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
      `;

      creditCustomers.forEach(c => {
        const bal = round2(c.totalBalance);
        const status = bal <= 0 ? 'Clear' : 'Pending';
        const statusClass = bal <= 0 ? 'badge-settled' : 'badge-pending';
        
        html += `
          <tr>
            <td>${c.customerName}</td>
            <td>${c.phone}</td>
            <td>${c.entries.length}</td>
            <td class="amount">₹${round2(c.totalCredit).toLocaleString()}</td>
            <td class="amount">₹${round2(c.totalPaid).toLocaleString()}</td>
            <td class="amount ${bal > 0 ? 'balance-positive' : 'balance-zero'}">₹${bal.toLocaleString()}</td>
            <td><span class="badge ${statusClass}">${status}</span></td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    }

    html += `
        <div class="footer">
          <p>Saritha Dairy - JNTU, Hyderabad | 📞 9398263810</p>
          <p>This is a computer-generated report.</p>
        </div>
      </body>
      </html>
    `;

    // Open in new window and trigger print
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // Auto print after content loads
    setTimeout(() => {
      printWindow.print();
    }, 500);
    
    setShowExportMenu(false);
    showMsg('success', '📄 Opening print dialog...');
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
            {/* Export Menu */}
            <div ref={exportMenuRef} style={{ position: 'relative' }}>
              <button 
                className="cr-btn-outline" 
                onClick={() => setShowExportMenu(!showExportMenu)}
                style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                📥 Export
              </button>
              
              {showExportMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '6px',
                  background: 'white', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                  minWidth: '180px', zIndex: 100, overflow: 'hidden', animation: 'dropdownIn 0.2s ease'
                }}>
                  <button 
                    onClick={() => {
                      const filename = `credit-report-${selectedCustomer.customerName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
                      generateCSV(null, filename);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: '13px', color: '#333', textAlign: 'left',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>📊</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>Excel / CSV</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>Download spreadsheet</div>
                    </div>
                  </button>
                  <button 
                    onClick={generatePDF}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: '13px', color: '#333', textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>📄</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>PDF / Print</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>Print formatted report</div>
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

        {/* Rest of ledger table remains same */}
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
              {customerLedger.length === 0 ? (
                <tr><td colSpan="8" className="cr-empty-row">No entries yet. Click "➕ Add Entry" to start.</td></tr>
              ) : (
                (() => {
                  let runningBalance = 0;
                  const sorted = [...customerLedger].sort((a, b) => 
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

        {/* Add Entry Modal - Same as before */}
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

        {/* Payment Modal - Same as before */}
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
              📥 Export All
            </button>
            
            {showExportMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '6px',
                background: 'white', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                minWidth: '180px', zIndex: 100, overflow: 'hidden', animation: 'dropdownIn 0.2s ease'
              }}>
                <button 
                  onClick={() => {
                    const filename = `all-credit-customers-${new Date().toISOString().split('T')[0]}.csv`;
                    generateCSV(null, filename);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: '13px', color: '#333', textAlign: 'left',
                    borderBottom: '1px solid #f0f0f0'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>📊</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>Excel / CSV</div>
                    <div style={{ fontSize: '10px', color: '#888' }}>Download all customers</div>
                  </div>
                </button>
                <button 
                  onClick={generatePDF}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: '13px', color: '#333', textAlign: 'left'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>📄</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>PDF / Print</div>
                    <div style={{ fontSize: '10px', color: '#888' }}>Print formatted report</div>
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