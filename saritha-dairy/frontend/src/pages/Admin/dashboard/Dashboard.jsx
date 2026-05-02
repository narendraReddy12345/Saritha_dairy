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

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
    return () => clearInterval(timer);
  }, []);

  // ✅ Get auth token
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
        const productWiseData = productsData.data.map(product => {
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
          
          const currentStock = stockData.data?.filter(s => s.product_name === product.name) || [];
          const currentStockQuantity = currentStock.reduce((sum, s) => sum + s.quantity, 0);
          
          const profit = totalRevenue - totalInvestment;
          const profitMargin = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;
          const packs = typeof product.packs === 'string' ? JSON.parse(product.packs) : product.packs;
          
          return {
            id: product.id,
            name: product.name,
            image: product.image_url,
            packs: packs,
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

  return (
    <div className="compact-dashboard">
      {/* Header */}
      <div className="compact-header">
        <div className="header-title">
          <span className="header-icon">📊</span>
          <div>
            <h1>Dashboard</h1>
            <p>{greeting}, Admin</p>
          </div>
        </div>
        <div className="header-time">
          <span className="time-icon">⏰</span>
          <div>
            <div className="time">{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="date">{currentTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="mini-card">
          <div className="mini-card-icon">💰</div>
          <div>
            <div className="mini-card-value">{formatCurrency(dashboardData.totalInvestment)}</div>
            <div className="mini-card-label">Investment</div>
          </div>
        </div>
        <div className="mini-card">
          <div className="mini-card-icon">📈</div>
          <div>
            <div className="mini-card-value">{formatCurrency(dashboardData.totalRevenue)}</div>
            <div className="mini-card-label">Revenue</div>
          </div>
        </div>
        <div className="mini-card">
          <div className="mini-card-icon">🎯</div>
          <div>
            <div className="mini-card-value" style={{ color: dashboardData.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
              {formatCurrency(dashboardData.totalProfit)}
            </div>
            <div className="mini-card-label">Profit</div>
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
        <div className="products-compact-grid">
          {dashboardData.products.map((product, idx) => {
            const stockLevel = getStockLevel(product.currentStockQuantity, product.totalQuantityPurchased);
            
            return (
              <div key={idx} className={`product-compact-card ${selectedProduct?.id === product.id ? 'expanded' : ''}`}>
                <div className="card-header" onClick={() => setSelectedProduct(selectedProduct?.id === product.id ? null : product)}>
                  <div className="card-icon">
                    {product.image ? (
                      <img src={`http://localhost:5000${product.image}`} alt={product.name} />
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
                        <span>Remaining</span>
                        <strong>{product.remainingStock} units</strong>
                      </div>
                    </div>
                    <div className="expanded-packs">
                      {product.packs?.map((pack, i) => (
                        <span key={i} className="pack-tag">{pack.size}{pack.unit} - ₹{pack.price}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions-bar">
        <button onClick={() => navigate('/purchases/add')}>➕ Add Purchase</button>
        <button onClick={() => navigate('/inventory/pack-products')}>📦 Pack</button>
        <button onClick={() => navigate('/sales')}>🛒 Sell</button>
        <button onClick={() => navigate('/inventory/products')}>📋 Products</button>
      </div>
    </div>
  );
};

export default Dashboard;