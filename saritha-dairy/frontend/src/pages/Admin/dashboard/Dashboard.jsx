// src/pages/Admin/dashboard/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState({
    products: [],
    totalInvestment: 0,
    totalRevenue: 0,
    totalProfit: 0,
    overallProfitMargin: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState('');
  const [userName, setUserName] = useState('Admin');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
    
    const user = sessionStorage.getItem('userName');
    if (user) setUserName(user);
    
    return () => clearInterval(timer);
  }, []);

  // Get auth token
  const getToken = () => sessionStorage.getItem('authToken');

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const fetchDashboardData = async () => {
    try {
      const [productsRes, purchasesRes, salesRes, stockRes] = await Promise.all([
        fetch(`${API_URL}/products`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/farm-purchases`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/sales-history`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/store-stock`, { headers: getAuthHeaders() })
      ]);

      // Check for 401
      if ([productsRes, purchasesRes, salesRes, stockRes].some(r => r.status === 401)) {
        window.location.href = '/login';
        return;
      }

      const productsData = await productsRes.json();
      const purchasesData = await purchasesRes.json();
      const salesData = await salesRes.json();
      const stockData = await stockRes.json();

      if (productsData.success) {
        // Group products by name to remove duplicates
        const productMap = new Map();
        
        productsData.data.forEach(product => {
          if (!productMap.has(product.name)) {
            productMap.set(product.name, {
              id: product.id,
              name: product.name,
              image: product.image_url,
              packs: typeof product.packs === 'string' ? JSON.parse(product.packs) : product.packs,
              variants: []
            });
          }
          // Store all variants for this product
          productMap.get(product.name).variants.push({
            id: product.id,
            packs: typeof product.packs === 'string' ? JSON.parse(product.packs) : product.packs
          });
        });
        
        // Calculate aggregated data for each unique product
        const productWiseData = Array.from(productMap.values()).map(product => {
          // Get all purchases for this product name
          const productPurchases = purchasesData.data?.filter(p => p.product_name === product.name) || [];
          const totalInvestment = productPurchases.reduce((sum, p) => sum + (parseFloat(p.total_cost) || 0), 0);
          const totalQuantityPurchased = productPurchases.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
          
          let totalRevenue = 0;
          let totalSoldQuantity = 0;
          if (salesData.success) {
            salesData.data.forEach(sale => {
              if (sale.items) {
                sale.items.forEach(item => {
                  if (item.product_name === product.name) {
                    totalRevenue += parseFloat(item.total) || 0;
                    totalSoldQuantity += item.quantity || 0;
                  }
                });
              }
            });
          }
          
          // Get current stock for this product
          const currentStock = stockData.data?.filter(s => s.product_name === product.name) || [];
          const currentStockQuantity = currentStock.reduce((sum, s) => sum + s.quantity, 0);
          
          const profit = totalRevenue - totalInvestment;
          const profitMargin = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;
          
          // Combine all packs/variants
          const allPacks = [];
          product.variants.forEach(variant => {
            if (variant.packs && Array.isArray(variant.packs)) {
              variant.packs.forEach(pack => {
                if (!allPacks.some(p => p.size === pack.size && p.unit === pack.unit)) {
                  allPacks.push(pack);
                }
              });
            }
          });
          
          return {
            id: product.id,
            name: product.name,
            image: product.image,
            packs: allPacks,
            totalInvestment,
            totalRevenue,
            profit,
            profitMargin,
            totalQuantityPurchased,
            totalSoldQuantity,
            currentStockQuantity,
            remainingStock: totalQuantityPurchased - totalSoldQuantity
          };
        });
        
        const totalInvestment = productWiseData.reduce((sum, p) => sum + p.totalInvestment, 0);
        const totalRevenue = productWiseData.reduce((sum, p) => sum + p.totalRevenue, 0);
        const totalProfit = totalRevenue - totalInvestment;
        const overallProfitMargin = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
        
        setDashboardData({
          products: productWiseData,
          totalInvestment,
          totalRevenue,
          totalProfit,
          overallProfitMargin
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStockLevel = (current, max) => {
    const percentage = max > 0 ? (current / max) * 100 : 0;
    if (percentage <= 20) return { level: 'Critical', color: '#ef4444', bg: '#fef2f2', icon: '🔴' };
    if (percentage <= 50) return { level: 'Low', color: '#f59e0b', bg: '#fffbeb', icon: '🟠' };
    if (percentage <= 80) return { level: 'Medium', color: '#3b82f6', bg: '#eff6ff', icon: '🔵' };
    return { level: 'Good', color: '#10b981', bg: '#f0fdf4', icon: '🟢' };
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

  // Filter products
  const getFilteredProducts = () => {
    let filtered = [...dashboardData.products];
    
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterType === 'profit') {
      filtered = filtered.filter(p => p.profit > 0);
    } else if (filterType === 'loss') {
      filtered = filtered.filter(p => p.profit < 0);
    } else if (filterType === 'low-stock') {
      filtered = filtered.filter(p => {
        const percentage = p.currentStockQuantity / Math.max(p.totalQuantityPurchased, 1) * 100;
        return percentage <= 30;
      });
    }
    
    return filtered;
  };

  const filteredProducts = getFilteredProducts();

  return (
    <div className="compact-dashboard">
      {/* Header */}
      <div className="compact-header">
        <div className="header-title">
          <span className="header-icon">📊</span>
          <div>
            <h1>Dashboard</h1>
            <p>{greeting}, {userName}</p>
          </div>
        </div>
        <div className="header-right">
          <div className="header-time">
            <span className="time-icon">⏰</span>
            <div>
              <div className="time">{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="date">{currentTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="filter-section">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>✕</button>
          )}
        </div>
        <div className="filter-chips">
          <button 
            className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Products
          </button>
          <button 
            className={`filter-chip ${filterType === 'profit' ? 'active' : ''}`}
            onClick={() => setFilterType('profit')}
          >
            📈 Profitable
          </button>
          <button 
            className={`filter-chip ${filterType === 'loss' ? 'active' : ''}`}
            onClick={() => setFilterType('loss')}
          >
            📉 In Loss
          </button>
          <button 
            className={`filter-chip ${filterType === 'low-stock' ? 'active' : ''}`}
            onClick={() => setFilterType('low-stock')}
          >
            ⚠️ Low Stock
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="mini-card">
          <div className="mini-card-icon">💰</div>
          <div>
            <div className="mini-card-value">{formatCurrency(dashboardData.totalInvestment)}</div>
            <div className="mini-card-label">Total Investment</div>
          </div>
        </div>
        <div className="mini-card">
          <div className="mini-card-icon">📈</div>
          <div>
            <div className="mini-card-value">{formatCurrency(dashboardData.totalRevenue)}</div>
            <div className="mini-card-label">Total Revenue</div>
          </div>
        </div>
        <div className="mini-card">
          <div className="mini-card-icon">🎯</div>
          <div>
            <div className="mini-card-value" style={{ color: dashboardData.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
              {formatCurrency(dashboardData.totalProfit)}
            </div>
            <div className="mini-card-label">Total Profit</div>
          </div>
          <div className="mini-badge" style={{ background: dashboardData.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
            {dashboardData.overallProfitMargin >= 0 ? '+' : ''}{dashboardData.overallProfitMargin.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="loading-compact">Loading...</div>
      ) : (
        <>
          {filteredProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No products found</h3>
              <p>Try adjusting your search or filter</p>
            </div>
          ) : (
            <div className="products-compact-grid">
              {filteredProducts.map((product, idx) => {
                const stockLevel = getStockLevel(product.currentStockQuantity, product.totalQuantityPurchased);
                
                return (
                  <div key={idx} className={`product-compact-card ${selectedProduct?.id === product.id ? 'expanded' : ''}`}>
                    <div className="card-header" onClick={() => setSelectedProduct(selectedProduct?.id === product.id ? null : product)}>
                      <div className="card-icon">
                        {product.image ? (
                          <img src={`${API_URL.replace('/api', '')}${product.image}`} alt={product.name} />
                        ) : (
                          <span>{getProductIcon(product.name)}</span>
                        )}
                      </div>
                      <div className="card-info">
                        <h4>{product.name}</h4>
                        <div className="card-stats">
                          <span className="stock-badge" style={{ background: stockLevel.bg, color: stockLevel.color }}>
                            {stockLevel.icon} {stockLevel.level}
                          </span>
                          <span className="stock-qty">{product.currentStockQuantity} units</span>
                        </div>
                      </div>
                      <div className={`profit-chip ${product.profit >= 0 ? 'positive' : 'negative'}`}>
                        {product.profit >= 0 ? '▲' : '▼'} {Math.abs(product.profitMargin).toFixed(0)}%
                      </div>
                    </div>

                    {/* Financial Row */}
                    <div className="financial-row">
                      <div className="financial-col">
                        <span>Investment</span>
                        <strong>{formatCurrency(product.totalInvestment)}</strong>
                      </div>
                      <div className="financial-col">
                        <span>Revenue</span>
                        <strong>{formatCurrency(product.totalRevenue)}</strong>
                      </div>
                      <div className="financial-col">
                        <span>Profit</span>
                        <strong style={{ color: product.profit >= 0 ? '#10b981' : '#ef4444' }}>
                          {formatCurrency(product.profit)}
                        </strong>
                      </div>
                    </div>

                    {/* Stock Bar */}
                    <div className="stock-bar-mini">
                      <div className="stock-bar-bg">
                        <div 
                          className="stock-bar-fill" 
                          style={{ 
                            width: `${(product.currentStockQuantity / Math.max(product.totalQuantityPurchased, 1)) * 100}%`,
                            background: stockLevel.color
                          }}
                        ></div>
                      </div>
                      <div className="stock-bar-labels">
                        <span>Sold: {product.totalSoldQuantity}</span>
                        <span>Left: {product.currentStockQuantity}</span>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedProduct?.id === product.id && (
                      <div className="card-expanded">
                        <div className="expanded-row">
                          <div className="expanded-item">
                            <span>Total Purchased</span>
                            <strong>{product.totalQuantityPurchased} units</strong>
                          </div>
                          <div className="expanded-item">
                            <span>Total Sold</span>
                            <strong>{product.totalSoldQuantity} units</strong>
                          </div>
                          <div className="expanded-item">
                            <span>Remaining Stock</span>
                            <strong>{product.remainingStock} units</strong>
                          </div>
                          <div className="expanded-item">
                            <span>Profit Margin</span>
                            <strong style={{ color: product.profit >= 0 ? '#10b981' : '#ef4444' }}>
                              {product.profitMargin.toFixed(2)}%
                            </strong>
                          </div>
                        </div>
                        {product.packs && product.packs.length > 0 && (
                          <div className="expanded-packs">
                            <span className="packs-label">Available Packs:</span>
                            <div className="packs-list">
                              {product.packs.map((pack, i) => (
                                <span key={i} className="pack-tag">{pack.size}{pack.unit} - ₹{pack.price}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Quick Actions */}
      <div className="quick-actions-bar">
        <button onClick={() => navigate('/purchases/add')}>➕ Add Purchase</button>
        <button onClick={() => navigate('/inventory/pack-products')}>📦 Pack Products</button>
        <button onClick={() => navigate('/sales')}>🛒 Make Sale</button>
        <button onClick={() => navigate('/inventory/products')}>📋 Manage Products</button>
      </div>

      <style>{`
        .filter-section {
          background: white;
          border-radius: 16px;
          padding: 15px 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .search-bar {
          position: relative;
          margin-bottom: 15px;
        }
        
        .search-bar input {
          width: 100%;
          padding: 10px 15px 10px 40px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
        }
        
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 16px;
          color: #94a3b8;
        }
        
        .clear-search {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: #94a3b8;
        }
        
        .filter-chips {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        
        .filter-chip {
          padding: 6px 14px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 20px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        
        .filter-chip:hover {
          border-color: #3b82f6;
          color: #3b82f6;
        }
        
        .filter-chip.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
        
        .header-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 16px;
        }
        
        .empty-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        
        .empty-state h3 {
          margin: 0 0 10px 0;
          color: #1e293b;
        }
        
        .empty-state p {
          color: #64748b;
        }
        
        .packs-label {
          font-size: 12px;
          color: #64748b;
          display: block;
          margin-bottom: 8px;
        }
        
        .packs-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .expanded-item strong {
          font-size: 16px;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;