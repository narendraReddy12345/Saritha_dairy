// src/pages/Admin/inventory/AddFarmPurchase.jsx
import React, { useState, useEffect } from 'react';
import './AddPurchase.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const AddPurchase = () => {
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('add');
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [uniqueProducts, setUniqueProducts] = useState([]); // New state for unique products
  const [message, setMessage] = useState(null);
  
  // New state for filtering
  const [dateFilter, setDateFilter] = useState('all'); // all, today, yesterday, week, month, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);

  const [formData, setFormData] = useState({
    productName: '',
    quantity: '',
    unit: 'Litre',
    pricePerUnit: '',
    supplier: '',
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    fetchProducts();
    fetchPurchases();
  }, []);

  // Get auth token
  const getToken = () => sessionStorage.getItem('authToken');

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/products`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();
      if (result.success) {
        setProducts(result.data);
        
        // Create unique products by name (remove duplicates)
        const productMap = new Map();
        result.data.forEach(product => {
          if (!productMap.has(product.name)) {
            productMap.set(product.name, product);
          }
        });
        setUniqueProducts(Array.from(productMap.values()));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchPurchases = async () => {
    try {
      const response = await fetch(`${API_URL}/farm-purchases`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();
      if (result.success) setPurchases(result.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Date filter functions
  const isToday = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const isYesterday = (dateStr) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return dateStr === yesterday.toISOString().split('T')[0];
  };

  const isLast7Days = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    return date >= sevenDaysAgo && date <= today;
  };

  const isLast30Days = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return date >= thirtyDaysAgo && date <= today;
  };

  const isInCustomRange = (dateStr) => {
    if (!customStartDate || !customEndDate) return true;
    const date = new Date(dateStr);
    const start = new Date(customStartDate);
    const end = new Date(customEndDate);
    end.setHours(23, 59, 59);
    return date >= start && date <= end;
  };

  // Filter purchases based on selected filter
  const getFilteredPurchases = () => {
    let filtered = [...purchases];

    switch(dateFilter) {
      case 'today':
        filtered = filtered.filter(p => isToday(p.purchase_date?.split('T')[0]));
        break;
      case 'yesterday':
        filtered = filtered.filter(p => isYesterday(p.purchase_date?.split('T')[0]));
        break;
      case 'week':
        filtered = filtered.filter(p => isLast7Days(p.purchase_date?.split('T')[0]));
        break;
      case 'month':
        filtered = filtered.filter(p => isLast30Days(p.purchase_date?.split('T')[0]));
        break;
      case 'custom':
        filtered = filtered.filter(p => isInCustomRange(p.purchase_date?.split('T')[0]));
        break;
      default:
        break;
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(purchase =>
        purchase.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        purchase.farm_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        purchase.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));
  };

  // Handle filter change
  const handleDateFilterChange = (value) => {
    setDateFilter(value);
    setShowCustomDate(value === 'custom');
    if (value !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  // Download as CSV
  const downloadCSV = () => {
    const filteredPurchases = getFilteredPurchases();
    
    if (filteredPurchases.length === 0) {
      showMessage('No data to download', 'error');
      return;
    }

    // Define CSV headers
    const headers = [
      'S.No',
      'Date',
      'Product Name',
      'Quantity',
      'Unit',
      'Price Per Unit (₹)',
      'Total Cost (₹)',
      'Supplier/Farm',
      'Invoice Number',
      'Notes',
      'Remaining Stock'
    ];

    // Prepare rows
    const rows = filteredPurchases.map((purchase, index) => [
      index + 1,
      new Date(purchase.purchase_date).toLocaleDateString('en-IN'),
      purchase.product_name,
      purchase.quantity,
      purchase.unit || 'Litre',
      purchase.price_per_unit,
      purchase.total_cost,
      purchase.farm_name || '-',
      purchase.invoice_number || '-',
      purchase.notes || '-',
      purchase.remaining_quantity ? `${purchase.remaining_quantity} ${purchase.unit || 'Litre'}` : 'N/A'
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Add BOM for UTF-8 encoding (handles Indian Rupee symbol)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `purchase_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showMessage(`✅ Downloaded ${filteredPurchases.length} records`);
  };

  // Generate print table HTML
  const generatePrintTable = (data) => {
    if (!data || data.length === 0) {
      return '<p>No data available</p>';
    }
    
    let tableHtml = `
      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Date</th>
            <th>Product</th>
            <th>Quantity</th>
            <th>Unit</th>
            <th>Rate (₹)</th>
            <th>Total (₹)</th>
            <th>Supplier</th>
            <th>Invoice No</th>
            <th>Stock Left</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    data.forEach((purchase, index) => {
      const remainingStock = parseFloat(purchase.remaining_quantity || purchase.quantity);
      
      tableHtml += `
        <tr>
          <td>${index + 1}</td>
          <td>${new Date(purchase.purchase_date).toLocaleDateString('en-IN')}</td>
          <td>${purchase.product_name || '-'}</td>
          <td style="text-align: right">${purchase.quantity}</td>
          <td>${purchase.unit || 'Litre'}</td>
          <td style="text-align: right">₹${purchase.price_per_unit}</td>
          <td style="text-align: right">₹${Number(purchase.total_cost).toLocaleString()}</td>
          <td>${purchase.farm_name || '-'}</td>
          <td>${purchase.invoice_number || '-'}</td>
          <td style="text-align: right">${remainingStock.toFixed(2)} ${purchase.unit || 'Litre'}</td>
        </tr>
      `;
    });
    
    // Calculate total amount only (remove rate total)
    const totalAmount = calculateTotalAmount(data);
    
    tableHtml += `
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: bold;">
            <td colspan="6"><strong>GRAND TOTAL</strong></td>
            <td style="text-align: right"><strong>₹${totalAmount.toLocaleString()}</strong></td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
    `;
    
    return tableHtml;
  };

  // Get filter label for print
  const getFilterLabel = () => {
    switch(dateFilter) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      case 'custom': return `${customStartDate} to ${customEndDate}`;
      default: return 'All Time';
    }
  };

  // Print table
  const printTable = () => {
    const filteredPurchases = getFilteredPurchases();
    if (filteredPurchases.length === 0) {
      showMessage('No data to print', 'error');
      return;
    }

    const totalAmount = calculateTotalAmount(filteredPurchases);
    const totalQuantity = filteredPurchases.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);

    // Create a hidden iframe for printing
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.width = '0px';
    printFrame.style.height = '0px';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
    
    const printDoc = printFrame.contentWindow.document;
    
    // Write the content with proper styles
    printDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase History Report - Saritha Dairy</title>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 20px;
              background: white;
              color: #333;
            }
            
            .print-container {
              max-width: 1200px;
              margin: 0 auto;
            }
            
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #3b82f6;
            }
            
            .header h1 {
              color: #1e293b;
              font-size: 24px;
              margin-bottom: 8px;
            }
            
            .header .subtitle {
              color: #64748b;
              font-size: 14px;
            }
            
            .filter-info {
              background: #f8fafc;
              padding: 12px 16px;
              border-radius: 8px;
              margin-bottom: 20px;
              font-size: 13px;
              border-left: 4px solid #3b82f6;
            }
            
            .filter-info p {
              margin: 4px 0;
            }
            
            .stats {
              display: flex;
              gap: 20px;
              margin-bottom: 25px;
              padding: 15px;
              background: #eff6ff;
              border-radius: 8px;
            }
            
            .stat-item {
              flex: 1;
              text-align: center;
            }
            
            .stat-label {
              font-size: 12px;
              color: #475569;
              margin-bottom: 4px;
            }
            
            .stat-value {
              font-size: 18px;
              font-weight: bold;
              color: #1e293b;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 12px;
            }
            
            th {
              background: #f1f5f9;
              padding: 12px 8px;
              text-align: left;
              font-weight: 600;
              color: #1e293b;
              border: 1px solid #e2e8f0;
            }
            
            td {
              padding: 10px 8px;
              border: 1px solid #e2e8f0;
              vertical-align: top;
            }
            
            tr:nth-child(even) {
              background: #f8fafc;
            }
            
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
            }
            
            @media print {
              body {
                padding: 10px;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="header">
              <h1>🏪 Saritha Dairy - Purchase History Report</h1>
              <div class="subtitle">Farm Purchase Records</div>
            </div>
            
            <div class="filter-info">
              <p><strong>📅 Filter Applied:</strong> ${getFilterLabel()}</p>
              <p><strong>⏰ Generated on:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <div class="stats">
              <div class="stat-item">
                <div class="stat-label">Total Purchases</div>
                <div class="stat-value">${filteredPurchases.length}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Total Quantity</div>
                <div class="stat-value">${totalQuantity.toFixed(2)}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Total Amount</div>
                <div class="stat-value">₹${totalAmount.toLocaleString()}</div>
              </div>
            </div>
            
            ${generatePrintTable(filteredPurchases)}
            
            <div class="footer">
              <p>This is a computer-generated document. No signature required.</p>
              <p>Saritha Dairy - All Rights Reserved</p>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            };
          <\/script>
        </body>
      </html>
    `);
    
    printDoc.close();
    
    // Remove iframe after printing
    setTimeout(() => {
      if (printFrame && printFrame.parentNode) {
        document.body.removeChild(printFrame);
      }
    }, 1000);
  };

  const calculateTotalAmount = (data) => {
    return data.reduce((sum, p) => sum + (parseFloat(p.total_cost) || 0), 0);
  };

  const calculateTotalRate = (data) => {
    return data.reduce((sum, p) => sum + (parseFloat(p.price_per_unit) || 0), 0);
  };

  const getProductIcon = (productName) => {
    if (!productName) return '📦';
    const n = productName.toLowerCase();
    if (n.includes('milk')) return '🥛';
    if (n.includes('curd')) return '🥄';
    if (n.includes('paneer')) return '🧀';
    if (n.includes('ghee')) return '🫕';
    if (n.includes('butter')) return '🧈';
    return '📦';
  };

  const getProductColor = (productName) => {
    if (!productName) return '#64748b';
    const n = productName.toLowerCase();
    if (n.includes('milk')) return '#3b82f6';
    if (n.includes('curd')) return '#10b981';
    if (n.includes('paneer')) return '#f59e0b';
    if (n.includes('ghee')) return '#ef4444';
    if (n.includes('butter')) return '#8b5cf6';
    return '#64748b';
  };

  const handleQuantityChange = (e) => {
    const qty = parseFloat(e.target.value) || 0;
    const price = parseFloat(formData.pricePerUnit) || 0;
    setFormData({ ...formData, quantity: e.target.value });
    setTotalCost(qty * price);
  };

  const handlePriceChange = (e) => {
    const price = parseFloat(e.target.value) || 0;
    const qty = parseFloat(formData.quantity) || 0;
    setFormData({ ...formData, pricePerUnit: e.target.value });
    setTotalCost(qty * price);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProductSelect = (e) => {
    setFormData({ ...formData, productName: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.productName || !formData.quantity || !formData.pricePerUnit) {
      showMessage('Please fill all required fields', 'error');
      return;
    }

    setLoading(true);
    const purchaseData = {
      productName: formData.productName,
      quantity: parseFloat(formData.quantity),
      unit: formData.unit,
      pricePerUnit: parseFloat(formData.pricePerUnit),
      totalCost: totalCost,
      farmName: formData.supplier,
      invoiceNumber: formData.invoiceNumber,
      purchaseDate: formData.date,
      notes: formData.notes
    };

    try {
      const response = await fetch(`${API_URL}/farm-purchases`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(purchaseData)
      });
      const result = await response.json();
      if (result.success) {
        showMessage('✅ Purchase saved successfully!');
        setFormData({
          productName: '', quantity: '', unit: 'Litre', pricePerUnit: '',
          supplier: '', invoiceNumber: '', date: new Date().toISOString().split('T')[0], notes: ''
        });
        setTotalCost(0);
        fetchPurchases();
      } else {
        showMessage('❌ ' + (result.error || 'Error saving purchase'), 'error');
      }
    } catch (error) {
      showMessage('❌ ' + error.message, 'error');
    }
    setLoading(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!formData.productName || !formData.quantity || !formData.pricePerUnit) {
      showMessage('Please fill all fields', 'error');
      return;
    }

    setLoading(true);
    const updateData = {
      productName: formData.productName,
      quantity: parseFloat(formData.quantity),
      unit: formData.unit,
      pricePerUnit: parseFloat(formData.pricePerUnit),
      totalCost: totalCost,
      farmName: formData.supplier,
      invoiceNumber: formData.invoiceNumber,
      purchaseDate: formData.date,
      notes: formData.notes
    };

    try {
      const response = await fetch(`${API_URL}/farm-purchases/${editingId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData)
      });
      const result = await response.json();
      if (result.success) {
        showMessage('✅ Purchase updated!');
        cancelEdit();
        fetchPurchases();
      } else {
        showMessage('❌ ' + (result.error || 'Error updating'), 'error');
      }
    } catch (error) {
      showMessage('❌ ' + error.message, 'error');
    }
    setLoading(false);
  };

  const handleDelete = async (id, productName) => {
    if (window.confirm(`Delete ${productName} purchase?`)) {
      try {
        const response = await fetch(`${API_URL}/farm-purchases/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const result = await response.json();
        if (result.success) {
          showMessage('✅ Purchase deleted');
          fetchPurchases();
        } else {
          showMessage('❌ Error deleting', 'error');
        }
      } catch (error) {
        showMessage('❌ ' + error.message, 'error');
      }
    }
  };

  const handleEdit = (purchase) => {
    setEditingId(purchase.id);
    setActiveTab('add');
    setFormData({
      productName: purchase.product_name,
      quantity: purchase.quantity,
      unit: purchase.unit || 'Litre',
      pricePerUnit: purchase.price_per_unit,
      supplier: purchase.farm_name || '',
      invoiceNumber: purchase.invoice_number || '',
      date: purchase.purchase_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      notes: purchase.notes || ''
    });
    setTotalCost(purchase.quantity * purchase.price_per_unit);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      productName: '', quantity: '', unit: 'Litre', pricePerUnit: '',
      supplier: '', invoiceNumber: '', date: new Date().toISOString().split('T')[0], notes: ''
    });
    setTotalCost(0);
  };

  const filteredPurchases = getFilteredPurchases();
  const totalAmount = calculateTotalAmount(filteredPurchases);
  const totalQuantity = filteredPurchases.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
  const totalRateSum = calculateTotalRate(filteredPurchases);

  return (
    <div className="purchase-tabs-container">
      {/* Toast Notification */}
      {message && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 3000,
          padding: '14px 20px', borderRadius: '10px', color: 'white',
          background: message.type === 'success' ? '#4caf50' : '#ef4444',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.2)', fontWeight: 500,
          animation: 'slideInRight 0.3s ease'
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
            cursor: 'pointer', padding: '2px 8px', borderRadius: '50%', fontSize: '16px'
          }}>×</button>
        </div>
      )}

      <div className="tabs-header">
        <h1>📦 Purchase Management</h1>
        <p>Manage your farm purchases efficiently</p>
      </div>

      <div className="stats-tabs">
        <div className="stat-card-tab">
          <div className="stat-icon-tab">📋</div>
          <div className="stat-info-tab">
            <span className="stat-value-tab">{filteredPurchases.length}</span>
            <span className="stat-label-tab">Total Purchases</span>
          </div>
        </div>
        <div className="stat-card-tab">
          <div className="stat-icon-tab">📦</div>
          <div className="stat-info-tab">
            <span className="stat-value-tab">{Number(totalQuantity).toFixed(0)}</span>
            <span className="stat-label-tab">Total Quantity</span>
          </div>
        </div>
        <div className="stat-card-tab">
          <div className="stat-icon-tab">💰</div>
          <div className="stat-info-tab">
            <span className="stat-value-tab">₹{Number(totalAmount).toLocaleString()}</span>
            <span className="stat-label-tab">Total Spent</span>
          </div>
        </div>
      </div>

      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => { setActiveTab('add'); cancelEdit(); }}
        >
          <span className="tab-icon">➕</span>
          Add New Purchase
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="tab-icon">📋</span>
          Purchase History
          <span className="tab-count">{purchases.length}</span>
        </button>
      </div>

      {activeTab === 'add' && (
        <div className="tab-content">
          <div className="form-card-tab">
            <div className="form-header-tab">
              <h2>{editingId ? '✏️ Edit Purchase' : '➕ Add New Purchase'}</h2>
              {editingId && <span className="edit-badge-tab">Editing Mode</span>}
            </div>

            <form id="form-section" onSubmit={editingId ? handleUpdate : handleSubmit}>
              <div className="form-grid-tab">
                <div className="input-group-tab">
                  <label>Product <span className="required">*</span></label>
                  <select value={formData.productName} onChange={handleProductSelect} required>
                    <option value="">-- Select Product --</option>
                    {uniqueProducts.map((p, i) => (
                      <option key={i} value={p.name}>
                        {getProductIcon(p.name)} {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group-tab">
                  <label>Quantity <span className="required">*</span></label>
                  <input type="number" name="quantity" value={formData.quantity} onChange={handleQuantityChange} step="0.01" placeholder="0.00" required />
                </div>

                <div className="input-group-tab">
                  <label>Unit</label>
                  <select name="unit" value={formData.unit} onChange={handleChange}>
                    <option value="Litre">Litre</option>
                    <option value="Kg">Kg</option>
                    <option value="Gram">Gram</option>
                    <option value="Piece">Piece</option>
                  </select>
                </div>

                <div className="input-group-tab">
                  <label>Price/Unit (₹) <span className="required">*</span></label>
                  <input type="number" name="pricePerUnit" value={formData.pricePerUnit} onChange={handlePriceChange} step="0.01" placeholder="0.00" required />
                </div>

                <div className="input-group-tab total-field-tab">
                  <label>Total Cost</label>
                  <div className="total-value-tab">₹{Number(totalCost).toLocaleString()}</div>
                </div>

                <div className="input-group-tab">
                  <label>Supplier</label>
                  <input type="text" name="supplier" value={formData.supplier} onChange={handleChange} placeholder="Farm name" />
                </div>

                <div className="input-group-tab">
                  <label>Invoice No</label>
                  <input type="text" name="invoiceNumber" value={formData.invoiceNumber} onChange={handleChange} placeholder="Bill number" />
                </div>

                <div className="input-group-tab">
                  <label>Date</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange} required />
                </div>

                <div className="input-group-tab full-width-tab">
                  <label>Notes</label>
                  <input type="text" name="notes" value={formData.notes} onChange={handleChange} placeholder="Additional notes..." />
                </div>
              </div>

              <div className="form-actions-tab">
                {editingId && <button type="button" className="btn-cancel-tab" onClick={cancelEdit}>Cancel Edit</button>}
                <button type="submit" className="btn-submit-tab" disabled={loading}>
                  {loading ? 'Saving...' : (editingId ? 'Update Purchase' : 'Save Purchase')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="tab-content">
          <div className="history-card-tab">
            {/* Filter Bar */}
            <div className="filter-bar-tab">
              <div className="filter-group-tab">
                <label>Date Filter:</label>
                <div className="filter-buttons-tab">
                  <button 
                    className={`filter-btn ${dateFilter === 'all' ? 'active' : ''}`}
                    onClick={() => handleDateFilterChange('all')}
                  >
                    All
                  </button>
                  <button 
                    className={`filter-btn ${dateFilter === 'today' ? 'active' : ''}`}
                    onClick={() => handleDateFilterChange('today')}
                  >
                    Today
                  </button>
                  <button 
                    className={`filter-btn ${dateFilter === 'yesterday' ? 'active' : ''}`}
                    onClick={() => handleDateFilterChange('yesterday')}
                  >
                    Yesterday
                  </button>
                  <button 
                    className={`filter-btn ${dateFilter === 'week' ? 'active' : ''}`}
                    onClick={() => handleDateFilterChange('week')}
                  >
                    Last 7 Days
                  </button>
                  <button 
                    className={`filter-btn ${dateFilter === 'month' ? 'active' : ''}`}
                    onClick={() => handleDateFilterChange('month')}
                  >
                    Last 30 Days
                  </button>
                  <button 
                    className={`filter-btn ${dateFilter === 'custom' ? 'active' : ''}`}
                    onClick={() => handleDateFilterChange('custom')}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {showCustomDate && (
                <div className="custom-date-range-tab">
                  <input 
                    type="date" 
                    value={customStartDate} 
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    placeholder="Start Date"
                  />
                  <span>to</span>
                  <input 
                    type="date" 
                    value={customEndDate} 
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    placeholder="End Date"
                  />
                </div>
              )}

              <div className="search-export-tab">
                <div className="search-wrapper-tab">
                  <span className="search-icon-tab">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search by product, supplier or invoice..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                  />
                </div>
                <div className="export-buttons-tab">
                  <button className="export-btn csv-btn" onClick={downloadCSV}>
                    📥 Download CSV
                  </button>
                  <button className="export-btn print-btn" onClick={printTable}>
                    🖨️ Print
                  </button>
                </div>
              </div>
            </div>

            {filteredPurchases.length === 0 ? (
              <div className="empty-tab">
                <div className="empty-icon-tab">📦</div>
                <h3>No purchases found</h3>
                <p>Try changing your filter or add a new purchase</p>
              </div>
            ) : (
              <div className="table-responsive-tab">
                <table className="purchase-table-tab">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Rate (₹)</th>
                      <th>Total (₹)</th>
                      <th>Supplier</th>
                      <th>Invoice</th>
                      <th>Stock Left</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map((purchase, index) => {
                      const remainingStock = parseFloat(purchase.remaining_quantity || purchase.quantity);
                      const isLowStock = remainingStock > 0 && remainingStock < purchase.quantity * 0.2;
                      
                      return (
                        <tr key={purchase.id}>
                          <td>{index + 1}</td>
                          <td>{new Date(purchase.purchase_date).toLocaleDateString('en-IN')}</td>
                          <td>
                            <span className="product-badge-table">
                              {purchase.product_name}
                            </span>
                          </td>
                          <td>{purchase.quantity}</td>
                          <td>{purchase.unit || 'Litre'}</td>
                          <td>₹{purchase.price_per_unit}</td>
                          <td className="total-cell">₹{Number(purchase.total_cost).toLocaleString()}</td>
                          <td>{purchase.farm_name || '-'}</td>
                          <td>{purchase.invoice_number || '-'}</td>
                          <td>
                            <span className={`stock-badge ${remainingStock <= 0 ? 'finished' : (isLowStock ? 'low' : 'available')}`}>
                              {remainingStock <= 0 ? '✅ Finished' : `${remainingStock.toFixed(2)}`}
                            </span>
                          </td>
                          <td className="action-cell">
                            <button className="edit-action-table" onClick={() => handleEdit(purchase)} title="Edit">
                              ✏️
                            </button>
                            <button className="delete-action-table" onClick={() => handleDelete(purchase.id, purchase.product_name)} title="Delete">
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="table-footer-total">
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        /* Filter Bar Styles */
        .filter-bar-tab {
          background: white;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .filter-group-tab {
          margin-bottom: 15px;
        }

        .filter-group-tab label {
          font-weight: 600;
          color: #333;
          margin-right: 15px;
        }

        .filter-buttons-tab {
          display: inline-flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-btn {
          padding: 6px 14px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 20px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .filter-btn.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .custom-date-range-tab {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 15px;
          padding: 10px 0;
        }

        .custom-date-range-tab input {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
        }

        .search-export-tab {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
          margin-top: 10px;
        }

        .search-wrapper-tab {
          flex: 1;
          position: relative;
          max-width: 300px;
        }

        .search-wrapper-tab input {
          width: 100%;
          padding: 10px 15px 10px 38px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
        }

        .search-icon-tab {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 16px;
        }

        .export-buttons-tab {
          display: flex;
          gap: 10px;
        }

        .export-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .csv-btn {
          background: #10b981;
          color: white;
        }

        .csv-btn:hover {
          background: #059669;
        }

        .print-btn {
          background: #6366f1;
          color: white;
        }

        .print-btn:hover {
          background: #4f46e5;
        }

        /* Table Styles */
        .table-responsive-tab {
          overflow-x: auto;
          border-radius: 16px;
          background: white;
        }

        .purchase-table-tab {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .purchase-table-tab th {
          background: #f1f5f9;
          padding: 14px 12px;
          text-align: left;
          font-weight: 600;
          color: #1e293b;
          border-bottom: 2px solid #e2e8f0;
        }

        .purchase-table-tab td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }

        .purchase-table-tab tr:hover {
          background: #f8fafc;
        }

        .product-badge-table {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
        }

        .total-cell {
          font-weight: 600;
          color: #059669;
        }

        .stock-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .stock-badge.available {
          background: #dbeafe;
          color: #1e40af;
        }

        .stock-badge.low {
          background: #fed7aa;
          color: #9a3412;
        }

        .stock-badge.finished {
          background: #dcfce7;
          color: #166534;
        }

        .action-cell {
          display: flex;
          gap: 8px;
        }

        .edit-action-table, .delete-action-table {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 4px 8px;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .edit-action-table:hover {
          background: #dbeafe;
        }

        .delete-action-table:hover {
          background: #fee2e2;
        }

        .table-footer-total {
          background: #f8fafc;
          font-weight: 600;
        }

        .table-footer-total td {
          border-top: 2px solid #e2e8f0;
        }

        @media (max-width: 768px) {
          .filter-buttons-tab {
            margin-top: 10px;
          }
          
          .search-export-tab {
            flex-direction: column;
            align-items: stretch;
          }
          
          .search-wrapper-tab {
            max-width: 100%;
          }
          
          .export-buttons-tab {
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
};

export default AddPurchase;