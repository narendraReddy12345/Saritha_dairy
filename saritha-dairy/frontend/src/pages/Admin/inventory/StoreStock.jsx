// src/pages/Admin/inventory/StoreStock.jsx
import React, { useState, useEffect } from 'react';
import './StoreStock.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const StoreStock = () => {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // ✅ Get auth token
  const getToken = () => sessionStorage.getItem('authToken');

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/store-stock`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();
      if (result.success) setStock(result.data);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSell = async (item, e) => {
    e.stopPropagation();
    const quantity = prompt(`How many ${item.pack_size_display} to sell?`, "1");
    if (!quantity) return;
    
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      showMessage('error', 'Invalid quantity!');
      return;
    }
    
    if (qty > item.quantity) {
      showMessage('error', `Only ${item.quantity} available!`);
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/sell-product`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          product_name: item.product_name,
          pack_size_display: item.pack_size_display,
          quantity: qty 
        })
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        showMessage('success', `✅ Sold ${qty} ${item.pack_size_display}`);
        fetchStock();
      } else {
        showMessage('error', result.error);
      }
    } catch (err) {
      showMessage('error', 'Failed to sell');
    }
  };

  const getMaxStock = (productName, packSize) => {
    if (productName?.toLowerCase().includes('milk')) {
      if (packSize.includes('500') || packSize.includes('ml')) return 100;
      if (packSize.includes('1L') || packSize.includes('Liter')) return 80;
    }
    if (productName?.toLowerCase().includes('curd')) return 60;
    if (productName?.toLowerCase().includes('ghee')) return 40;
    if (productName?.toLowerCase().includes('paneer')) return 50;
    return 50;
  };

  const getPercentage = (current, max) => {
    if (current >= max) return 100;
    return (current / max) * 100;
  };

  const getColor = (percentage) => {
    if (percentage <= 20) return '#ef4444';
    if (percentage <= 50) return '#f59e0b';
    return '#10b981';
  };

  const getProductIcon = (name) => {
    if (!name) return '📦';
    const n = name.toLowerCase();
    if (n.includes('milk')) return '🥛';
    if (n.includes('curd')) return '🥄';
    if (n.includes('paneer')) return '🧀';
    if (n.includes('ghee')) return '🫕';
    if (n.includes('butter')) return '🧈';
    return '📦';
  };

  // Group stock by product
  const getGroupedStock = () => {
    const grouped = {};
    stock.forEach(item => {
      if (!grouped[item.product_name]) {
        grouped[item.product_name] = [];
      }
      grouped[item.product_name].push(item);
    });
    return grouped;
  };

  // Get unique products for icon grid
  const getUniqueProducts = () => {
    const products = {};
    stock.forEach(item => {
      if (!products[item.product_name]) {
        products[item.product_name] = {
          name: item.product_name,
          totalQuantity: 0,
          variants: []
        };
      }
      products[item.product_name].totalQuantity += item.quantity;
      products[item.product_name].variants.push(item);
    });
    return Object.values(products);
  };

  const uniqueProducts = getUniqueProducts();
  const filteredProducts = uniqueProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProductData = selectedProduct 
    ? getGroupedStock()[selectedProduct] 
    : null;

  const totalPackets = stock.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = stock.reduce((sum, item) => sum + (item.quantity * item.selling_price), 0);

  return (
    <div className="phone-stock-app">
      {/* Header */}
      <div className="phone-stock-header">
        <h1>📱 Stock Manager</h1>
        <p>Tap any product to view stock details</p>
      </div>

      {/* Toast Message */}
      {message && (
        <div className={`phone-stock-toast ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Stats */}
      <div className="phone-stock-stats">
        <div className="phone-stat-card">
          <span className="phone-stat-icon">📦</span>
          <div>
            <div className="phone-stat-number">{totalPackets}</div>
            <div className="phone-stat-label">Total Packets</div>
          </div>
        </div>
        <div className="phone-stat-card">
          <span className="phone-stat-icon">💰</span>
          <div>
            <div className="phone-stat-number">₹{totalValue.toLocaleString()}</div>
            <div className="phone-stat-label">Total Value</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="phone-stock-search">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="search-clear" onClick={() => setSearchTerm('')}>✕</button>
        )}
      </div>

      {/* Product Icons Grid */}
      {loading ? (
        <div className="phone-stock-loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="phone-stock-empty">
          <span>📦</span>
          <p>No stock available</p>
        </div>
      ) : (
        <>
          {/* App Icons Grid */}
          <div className="phone-icons-grid">
            {filteredProducts.map((product) => {
              const maxStock = 100;
              const percentage = getPercentage(product.totalQuantity, maxStock);
              const color = getColor(percentage);
              const size = 85;
              const strokeWidth = 6;
              const radius = (size - strokeWidth) / 2;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (percentage / 100) * circumference;
              
              return (
                <div 
                  key={product.name}
                  className={`phone-app-icon ${selectedProduct === product.name ? 'active' : ''}`}
                  onClick={() => setSelectedProduct(selectedProduct === product.name ? null : product.name)}
                >
                  {/* Circular Progress */}
                  <div className="phone-icon-circle">
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
                      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color}
                        strokeWidth={strokeWidth} strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset} strokeLinecap="round"
                        transform={`rotate(-90 ${size/2} ${size/2})`} />
                    </svg>
                    <div className="phone-icon-center">
                      <span className="phone-icon-emoji">{getProductIcon(product.name)}</span>
                    </div>
                  </div>
                  
                  <div className="phone-icon-name">{product.name}</div>
                  <div className="phone-icon-total">{product.totalQuantity} pcs</div>
                  
                  {selectedProduct === product.name && (
                    <div className="phone-icon-indicator">▼</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Expanded Stock Details */}
          {selectedProduct && selectedProductData && (
            <div className="phone-stock-details">
              <div className="phone-details-header">
                <div className="phone-details-icon">{getProductIcon(selectedProduct)}</div>
                <div className="phone-details-title">
                  <h2>{selectedProduct}</h2>
                  <p>Stock Details</p>
                </div>
                <button className="phone-details-close" onClick={() => setSelectedProduct(null)}>✕</button>
              </div>
              <div className="phone-details-grid">
                {selectedProductData.map((variant, idx) => {
                  const maxStock = getMaxStock(selectedProduct, variant.pack_size_display);
                  const percentage = getPercentage(variant.quantity, maxStock);
                  const color = getColor(percentage);
                  
                  return (
                    <div key={idx} className="phone-detail-card">
                      <div className="phone-detail-info">
                        <div className="phone-detail-size">{variant.pack_size_display}</div>
                        <div className="phone-detail-stock">
                          <span className="detail-stock-number">{variant.quantity}</span>
                          <span className="detail-stock-unit">packets</span>
                        </div>
                        <div className="phone-detail-price">₹{variant.selling_price} each</div>
                        <div className="phone-detail-progress">
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${percentage}%`, background: color }}></div>
                          </div>
                          <span className="progress-percent">{Math.round(percentage)}%</span>
                        </div>
                      </div>
                      <button 
                        className="phone-detail-sell"
                        onClick={(e) => handleSell(variant, e)}
                        disabled={variant.quantity === 0}
                      >
                        Sell
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StoreStock;