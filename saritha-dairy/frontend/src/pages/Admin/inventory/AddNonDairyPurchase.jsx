// src/pages/Admin/inventory/NonDairyPurchase.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './NonDairyPurchase.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const NonDairyPurchase = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('add');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  // Form for adding new product
  const [productForm, setProductForm] = useState({
    name: '',
    sellingPrice: '',
  });

  // Form for purchasing stock
  const [purchaseForm, setPurchaseForm] = useState({
    productId: '',
    productName: '',
    quantity: '',
    purchasePrice: '',
    supplier: '',
    invoiceNumber: '',
    notes: ''
  });

  useEffect(() => {
    fetchProducts();
    fetchPurchases();
  }, []);

  const getToken = () => sessionStorage.getItem('authToken');
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Fetch all products
  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/non-dairy-items`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setProducts(result.data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Fetch purchase history
  const fetchPurchases = async () => {
    try {
      const response = await fetch(`${API_URL}/non-dairy-purchase-history`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setPurchases(result.data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showMessage('Image size should be less than 5MB', 'error');
        return;
      }
      if (!file.type.startsWith('image/')) {
        showMessage('Please select an image file', 'error');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Add New Product
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name || !productForm.sellingPrice) {
      showMessage('Please fill product name and selling price', 'error');
      return;
    }

    setLoading(true);
    
    const formData = new FormData();
    formData.append('name', productForm.name);
    formData.append('sellingPrice', productForm.sellingPrice);
    formData.append('quantity', '0');
    formData.append('packSize', '1');
    formData.append('packUnit', 'piece');
    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      const response = await fetch(`${API_URL}/non-dairy-items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        showMessage(`✅ ${productForm.name} added successfully!`);
        resetProductForm();
        fetchProducts();
        setImagePreview('');
        setImageFile(null);
      } else {
        showMessage(result.error || 'Error adding product', 'error');
      }
    } catch (error) {
      showMessage('Error adding product', 'error');
    }
    setLoading(false);
  };

  // Purchase stock for existing product
  const handlePurchaseStock = async (e) => {
    e.preventDefault();
    if (!purchaseForm.productId || !purchaseForm.quantity || !purchaseForm.purchasePrice) {
      showMessage('Please select product and enter quantity & price', 'error');
      return;
    }

    setLoading(true);
    const purchaseData = {
      productId: parseInt(purchaseForm.productId),
      quantity: parseInt(purchaseForm.quantity),
      purchasePrice: parseFloat(purchaseForm.purchasePrice),
      supplier: purchaseForm.supplier,
      invoiceNumber: purchaseForm.invoiceNumber,
      notes: purchaseForm.notes
    };

    try {
      const response = await fetch(`${API_URL}/non-dairy-items/purchase`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(purchaseData)
      });
      const result = await response.json();
      if (result.success) {
        showMessage(`✅ Added ${purchaseForm.quantity} units to ${purchaseForm.productName}!`);
        resetPurchaseForm();
        fetchProducts();
        fetchPurchases();
        setActiveTab('history');
      } else {
        showMessage(result.error || 'Error adding stock', 'error');
      }
    } catch (error) {
      showMessage('Error adding stock', 'error');
    }
    setLoading(false);
  };

  // Delete product
  const handleDeleteProduct = async (id, name) => {
    if (window.confirm(`⚠️ Delete "${name}"? This will also delete all purchase history.`)) {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/non-dairy-items/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const result = await response.json();
        if (result.success) {
          showMessage(`✅ ${name} deleted successfully!`);
          fetchProducts();
          fetchPurchases();
        } else {
          showMessage(result.error || 'Error deleting product', 'error');
        }
      } catch (error) {
        showMessage('Error deleting product', 'error');
      }
      setLoading(false);
    }
  };

  // Delete purchase record
  const handleDeletePurchase = async (id, productName) => {
    if (window.confirm(`⚠️ Delete purchase record for "${productName}"?`)) {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/non-dairy-purchase-history/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        const result = await response.json();
        if (result.success) {
          showMessage(`✅ Purchase record deleted!`);
          fetchPurchases();
          fetchProducts();
        } else {
          showMessage(result.error || 'Error deleting record', 'error');
        }
      } catch (error) {
        showMessage('Error deleting record', 'error');
      }
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    const qty = parseFloat(purchaseForm.quantity) || 0;
    const price = parseFloat(purchaseForm.purchasePrice) || 0;
    return qty * price;
  };

  const resetProductForm = () => {
    setProductForm({ name: '', sellingPrice: '' });
    setImagePreview('');
    setImageFile(null);
  };

  const resetPurchaseForm = () => {
    setPurchaseForm({
      productId: '',
      productName: '',
      quantity: '',
      purchasePrice: '',
      supplier: '',
      invoiceNumber: '',
      notes: ''
    });
    setSelectedProduct(null);
  };

  const handleProductSelect = (e) => {
    const productId = e.target.value;
    const product = products.find(p => p.id === parseInt(productId));
    if (product) {
      setSelectedProduct(product);
      setPurchaseForm({
        ...purchaseForm,
        productId: product.id,
        productName: product.name
      });
    }
  };

  // Filter purchases based on date
  const getFilteredPurchases = () => {
    let filtered = [...purchases];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch(dateFilter) {
      case 'today':
        filtered = filtered.filter(p => {
          const date = new Date(p.created_at);
          date.setHours(0, 0, 0, 0);
          return date.getTime() === today.getTime();
        });
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        filtered = filtered.filter(p => {
          const date = new Date(p.created_at);
          date.setHours(0, 0, 0, 0);
          return date.getTime() === yesterday.getTime();
        });
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(p => new Date(p.created_at) >= weekAgo);
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = filtered.filter(p => new Date(p.created_at) >= monthAgo);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          filtered = filtered.filter(p => {
            const date = new Date(p.created_at);
            return date >= start && date <= end;
          });
        }
        break;
      default:
        break;
    }
    
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  const filteredPurchases = getFilteredPurchases();
  const totalSpent = filteredPurchases.reduce((sum, p) => sum + (parseFloat(p.total_cost) || 0), 0);
  const totalQuantity = filteredPurchases.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);

  // Print function
  const printReport = () => {
    if (filteredPurchases.length === 0) {
      showMessage('No data to print', 'error');
      return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Non-Dairy Purchase Report - Saritha Dairy</title>
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
              border-bottom: 2px solid #10b981;
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
              border-left: 4px solid #10b981;
              font-size: 13px;
            }
            .stats {
              display: flex;
              gap: 20px;
              margin-bottom: 25px;
              padding: 15px;
              background: #f0fdf4;
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
              <h1>🌱 Saritha Dairy - Non-Dairy Purchase Report</h1>
              <div class="subtitle">Purchase Records</div>
            </div>
            <div class="filter-info">
              <strong>📅 Filter Applied:</strong> ${getFilterLabel()}<br>
              <strong>⏰ Generated on:</strong> ${new Date().toLocaleString()}
            </div>
            <div class="stats">
              <div class="stat-item">
                <div class="stat-label">Total Purchases</div>
                <div class="stat-value">${filteredPurchases.length}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Total Quantity</div>
                <div class="stat-value">${totalQuantity}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Total Investment</div>
                <div class="stat-value">₹${totalSpent.toLocaleString()}</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Purchase Price</th>
                  <th>Total Cost</th>
                  <th>Supplier</th>
                  <th>Invoice No</th>
                </tr>
              </thead>
              <tbody>
                ${filteredPurchases.map((p, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                    <td>${p.product_name}</td>
                    <td>${p.quantity}</td>
                    <td>₹${p.purchase_price}</td>
                    <td>₹${p.total_cost?.toLocaleString()}</td>
                    <td>${p.supplier || '-'}</td>
                    <td>${p.invoice_number || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background: #f1f5f9; font-weight: bold;">
                  <td colspan="3"><strong>GRAND TOTAL</strong></td>
                  <td><strong>${totalQuantity}</strong></td>
                  <td></td>
                  <td><strong>₹${totalSpent.toLocaleString()}</strong></td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
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
    printWindow.document.close();
  };

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

  const getProductIcon = (name) => {
    if (!name) return '📦';
    const n = name.toLowerCase();
    if (n.includes('water')) return '💧';
    if (n.includes('bottle')) return '🧴';
    if (n.includes('juice')) return '🧃';
    if (n.includes('bread')) return '🍞';
    if (n.includes('cake')) return '🎂';
    if (n.includes('biscuit')) return '🍪';
    return '📦';
  };

  // Animated stats counter
  const AnimatedNumber = ({ value }) => {
    const [displayValue, setDisplayValue] = useState(0);
    useEffect(() => {
      let start = 0;
      const duration = 500;
      const increment = value / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(start));
        }
      }, 16);
      return () => clearInterval(timer);
    }, [value]);
    return <span>{displayValue.toLocaleString()}</span>;
  };

  return (
    <div className="nondairy-container">
      {message && (
        <div className={`toast-message ${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Hero Header Section */}
      <div className="hero-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-info">
              <span className="stat-value"><AnimatedNumber value={products.length} /></span>
              <span className="stat-label">Total Products</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🛒</div>
            <div className="stat-info">
              <span className="stat-value"><AnimatedNumber value={purchases.length} /></span>
              <span className="stat-label">Total Purchases</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <span className="stat-value">₹<AnimatedNumber value={totalSpent} /></span>
              <span className="stat-label">Total Investment</span>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => { setActiveTab('add'); resetProductForm(); }}
        >
          <span className="tab-icon">✨</span>
          <span>Add Product</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'purchase' ? 'active' : ''}`}
          onClick={() => { setActiveTab('purchase'); resetPurchaseForm(); }}
        >
          <span className="tab-icon">🛒</span>
          <span>Purchase Stock</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          <span className="tab-icon">📦</span>
          <span>Products</span>
          {products.length > 0 && <span className="badge">{products.length}</span>}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="tab-icon">📜</span>
          <span>History</span>
          {purchases.length > 0 && <span className="badge">{purchases.length}</span>}
        </button>
      </div>

      {/* Tab 1: Add Product */}
      {activeTab === 'add' && (
        <div className="form-card glass-card">
          <div className="card-header">
            <h2>✨ Create New Product</h2>
            <p>Add a new non-dairy item to your inventory</p>
          </div>
          <form onSubmit={handleAddProduct}>
            <div className="form-grid creative-form">
              <div className="form-group floating-label">
                <input 
                  type="text" 
                  id="productName"
                  value={productForm.name} 
                  onChange={(e) => setProductForm({...productForm, name: e.target.value})} 
                  placeholder=" "
                  required 
                />
                <label htmlFor="productName">Product Name *</label>
                <span className="input-icon">🏷️</span>
              </div>

              <div className="form-group floating-label">
                <input 
                  type="number" 
                  id="sellingPrice"
                  step="0.01" 
                  value={productForm.sellingPrice} 
                  onChange={(e) => setProductForm({...productForm, sellingPrice: e.target.value})} 
                  placeholder=" "
                  required 
                />
                <label htmlFor="sellingPrice">Selling Price (₹) *</label>
                <span className="input-icon">💰</span>
              </div>

              <div className="form-group image-upload-area">
                <label className="image-upload-label">
                  <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                  <div className="upload-preview">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" />
                    ) : (
                      <>
                        <span className="upload-icon">📸</span>
                        <span>Click to upload image</span>
                        <small>PNG, JPG up to 5MB</small>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-reset" onClick={resetProductForm}>
                <span>⟳</span> Reset
              </button>
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  <>
                    <span>✅</span> Add Product
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Purchase Stock */}
      {activeTab === 'purchase' && (
        <div className="form-card glass-card">
          <div className="card-header">
            <h2>🛒 Add Purchase Stock</h2>
            <p>Record new inventory purchase</p>
          </div>
          <form onSubmit={handlePurchaseStock}>
            <div className="form-grid two-columns">
              <div className="form-group floating-label">
                <select 
                  id="productSelect"
                  value={purchaseForm.productId} 
                  onChange={handleProductSelect} 
                  required
                >
                  <option value="">Select a product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {getProductIcon(p.name)} {p.name} - ₹{p.sellingPrice}/unit
                    </option>
                  ))}
                </select>
                <label htmlFor="productSelect">Select Product *</label>
              </div>

              {selectedProduct && (
                <div className="product-info-badge">
                  <span>💰 Selling Price: ₹{selectedProduct.sellingPrice}/unit</span>
                  <span className="info-icon">ℹ️</span>
                </div>
              )}

              <div className="form-group floating-label">
                <input 
                  type="number" 
                  id="quantity"
                  step="1" 
                  value={purchaseForm.quantity} 
                  onChange={(e) => setPurchaseForm({...purchaseForm, quantity: e.target.value})} 
                  placeholder=" "
                  required 
                />
                <label htmlFor="quantity">Quantity (Units) *</label>
              </div>

              <div className="form-group floating-label">
                <input 
                  type="number" 
                  id="purchasePrice"
                  step="0.01" 
                  value={purchaseForm.purchasePrice} 
                  onChange={(e) => setPurchaseForm({...purchaseForm, purchasePrice: e.target.value})} 
                  placeholder=" "
                  required 
                />
                <label htmlFor="purchasePrice">Purchase Price (₹/unit) *</label>
              </div>

              <div className="total-cost-preview">
                <span>Total Cost</span>
                <strong>₹{calculateTotal().toLocaleString()}</strong>
              </div>

              <div className="form-group floating-label">
                <input 
                  type="text" 
                  id="supplier"
                  value={purchaseForm.supplier} 
                  onChange={(e) => setPurchaseForm({...purchaseForm, supplier: e.target.value})} 
                  placeholder=" "
                />
                <label htmlFor="supplier">Supplier / Vendor</label>
              </div>

              <div className="form-group floating-label">
                <input 
                  type="text" 
                  id="invoiceNumber"
                  value={purchaseForm.invoiceNumber} 
                  onChange={(e) => setPurchaseForm({...purchaseForm, invoiceNumber: e.target.value})} 
                  placeholder=" "
                />
                <label htmlFor="invoiceNumber">Invoice Number</label>
              </div>

              <div className="form-group full-width floating-label">
                <textarea 
                  id="notes"
                  value={purchaseForm.notes} 
                  onChange={(e) => setPurchaseForm({...purchaseForm, notes: e.target.value})} 
                  rows="2" 
                  placeholder=" "
                ></textarea>
                <label htmlFor="notes">Notes</label>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-reset" onClick={resetPurchaseForm}>
                <span>⟳</span> Reset
              </button>
              <button type="submit" className="btn-submit" disabled={loading || !purchaseForm.productId}>
                {loading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  <>
                    <span>➕</span> Add Stock
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Products List - Fixed Search Bar */}
      {activeTab === 'products' && (
        <div className="products-section">
          <div className="search-bar-modern">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Search products by name..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
            {searchTerm && (
              <button className="clear-search" onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>

          {products.length === 0 ? (
            <div className="empty-state creative-empty">
              <div className="empty-icon">🌱</div>
              <h3>Your inventory is empty</h3>
              <p>Click "Add Product" to start building your collection</p>
            </div>
          ) : (
            <div className="products-grid-modern">
              {products.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase())).map((product) => (
                <div key={product.id} className="product-card-modern">
                  <div className="product-card-front">
                    <div className="product-image-wrapper">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} />
                      ) : (
                        <div className="image-placeholder-modern">{getProductIcon(product.name)}</div>
                      )}
                      <button className="delete-product-btn-modern" onClick={() => handleDeleteProduct(product.id, product.name)}>
                        🗑️
                      </button>
                    </div>
                    <div className="product-info-modern">
                      <h3>{product.name}</h3>
                      <p className="price-tag">₹{product.selling_price}<span>/unit</span></p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Purchase History */}
      {activeTab === 'history' && (
        <div className="history-section">
          <div className="filter-bar-modern">
            <div className="search-filter-group">
              <div className="search-box-modern">
                <span>🔍</span>
                <input 
                  type="text" 
                  placeholder="Search by product, supplier or invoice..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
              <div className="date-filter-group">
                <button className={`filter-chip ${dateFilter === 'all' ? 'active' : ''}`} onClick={() => setDateFilter('all')}>All</button>
                <button className={`filter-chip ${dateFilter === 'today' ? 'active' : ''}`} onClick={() => setDateFilter('today')}>Today</button>
                <button className={`filter-chip ${dateFilter === 'yesterday' ? 'active' : ''}`} onClick={() => setDateFilter('yesterday')}>Yesterday</button>
                <button className={`filter-chip ${dateFilter === 'week' ? 'active' : ''}`} onClick={() => setDateFilter('week')}>7 Days</button>
                <button className={`filter-chip ${dateFilter === 'month' ? 'active' : ''}`} onClick={() => setDateFilter('month')}>30 Days</button>
                <button className={`filter-chip ${dateFilter === 'custom' ? 'active' : ''}`} onClick={() => setDateFilter('custom')}>Custom</button>
              </div>
            </div>
            {dateFilter === 'custom' && (
              <div className="custom-date-range-modern">
                <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                <span>→</span>
                <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
              </div>
            )}
            <div className="action-buttons">
              <button className="print-btn-modern" onClick={printReport}>
                <span>🖨️</span> Print Report
              </button>
            </div>
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="empty-state creative-empty">
              <div className="empty-icon">📭</div>
              <h3>No purchase records</h3>
              <p>Try changing your filters or add a new purchase</p>
            </div>
          ) : (
            <div className="table-wrapper-modern">
              <table className="history-table-modern">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th>Supplier</th>
                    <th>Invoice</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map((purchase, index) => (
                    <tr key={purchase.id}>
                      <td>{index + 1}</td>
                      <td>{new Date(purchase.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="product-name-cell">
                        <span className="product-icon">{getProductIcon(purchase.product_name)}</span>
                        {purchase.product_name}
                      </td>
                      <td className="quantity-cell">{purchase.quantity}</td>
                      <td>₹{purchase.purchase_price}</td>
                      <td className="total-cell">₹{purchase.total_cost?.toLocaleString()}</td>
                      <td>{purchase.supplier || '-'}</td>
                      <td>{purchase.invoice_number || '-'}</td>
                      <td>
                        <button className="delete-btn-modern" onClick={() => handleDeletePurchase(purchase.id, purchase.product_name)}>
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="footer-total-modern">
                    <td colSpan="3"><strong>GRAND TOTAL</strong></td>
                    <td><strong>{totalQuantity}</strong></td>
                    <td></td>
                    <td><strong>₹{totalSpent.toLocaleString()}</strong></td>
                    <td colSpan="3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NonDairyPurchase;