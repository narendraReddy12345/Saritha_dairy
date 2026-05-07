// src/pages/Admin/dashboard/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';
const BASE_URL = 'https://saritha-dairy-api.onrender.com';

const Dashboard = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState({
    products: [], totalInvestment: 0, totalRevenue: 0, totalProfit: 0, overallProfitMargin: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState('');
  const [userName, setUserName] = useState('Admin');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [hoveredProduct, setHoveredProduct] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
    const user = sessionStorage.getItem('userName');
    if (user) setUserName(user);
    return () => clearInterval(timer);
  }, []);

  const getToken = () => sessionStorage.getItem('authToken');
  const getAuthHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` });

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${BASE_URL}${url}`;
    return `${BASE_URL}/${url}`;
  };

  const fetchDashboardData = async () => {
    try {
      const [productsRes, purchasesRes, salesRes, stockRes] = await Promise.all([
        fetch(`${API_URL}/products`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/farm-purchases`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/sales-history`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/store-stock`, { headers: getAuthHeaders() })
      ]);
      if ([productsRes, purchasesRes, salesRes, stockRes].some(r => r.status === 401)) { window.location.href = '/login'; return; }

      const productsData = await productsRes.json();
      const purchasesData = await purchasesRes.json();
      const salesData = await salesRes.json();
      const stockData = await stockRes.json();

      if (productsData.success) {
        const productMap = new Map();
        productsData.data.forEach(product => {
          if (!productMap.has(product.name)) {
            productMap.set(product.name, {
              id: product.id, name: product.name, image_url: product.image_url,
              packs: typeof product.packs === 'string' ? JSON.parse(product.packs) : product.packs, variants: []
            });
          }
          productMap.get(product.name).variants.push({ id: product.id, packs: typeof product.packs === 'string' ? JSON.parse(product.packs) : product.packs });
        });

        const productWiseData = Array.from(productMap.values()).map(product => {
          const productPurchases = purchasesData.data?.filter(p => p.product_name === product.name) || [];
          const totalInvestment = productPurchases.reduce((s, p) => s + (parseFloat(p.total_cost) || 0), 0);
          const totalQtyPurchased = productPurchases.reduce((s, p) => s + (parseFloat(p.quantity) || 0), 0);
          let totalRevenue = 0, totalSoldQty = 0;
          if (salesData.success) salesData.data.forEach(sale => { if (sale.items) sale.items.forEach(item => { if (item.product_name === product.name) { totalRevenue += parseFloat(item.total) || 0; totalSoldQty += item.quantity || 0; } }); });
          const currentStock = stockData.data?.filter(s => s.product_name === product.name) || [];
          const currentStockQty = currentStock.reduce((s, st) => s + st.quantity, 0);
          const profit = totalRevenue - totalInvestment;
          const profitMargin = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;
          const allPacks = [];
          product.variants.forEach(v => { if (v.packs && Array.isArray(v.packs)) v.packs.forEach(p => { if (!allPacks.some(x => x.size === p.size && x.unit === p.unit)) allPacks.push(p); }); });
          return { id: product.id, name: product.name, imageUrl: getImageUrl(product.image_url), packs: allPacks, totalInvestment, totalRevenue, profit, profitMargin, totalQuantityPurchased: totalQtyPurchased, totalSoldQuantity: totalSoldQty, currentStockQuantity: currentStockQty, remainingStock: totalQtyPurchased - totalSoldQty };
        });

        const totInv = productWiseData.reduce((s, p) => s + p.totalInvestment, 0);
        const totRev = productWiseData.reduce((s, p) => s + p.totalRevenue, 0);
        const totProf = totRev - totInv;
        const totMargin = totInv > 0 ? (totProf / totInv) * 100 : 0;
        setDashboardData({ products: productWiseData, totalInvestment: totInv, totalRevenue: totRev, totalProfit: totProf, overallProfitMargin: totMargin });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const formatCurrency = (a) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(a);

  const getStockLevel = (cur, max) => {
    const pct = max > 0 ? (cur / max) * 100 : 0;
    if (pct <= 20) return { level: 'Critical', color: '#ef4444', bg: '#fef2f2', grad: 'linear-gradient(135deg,#fef2f2,#fee2e2)' };
    if (pct <= 50) return { level: 'Low', color: '#f59e0b', bg: '#fffbeb', grad: 'linear-gradient(135deg,#fffbeb,#fef3c7)' };
    if (pct <= 80) return { level: 'Medium', color: '#3b82f6', bg: '#eff6ff', grad: 'linear-gradient(135deg,#eff6ff,#dbeafe)' };
    return { level: 'Good', color: '#10b981', bg: '#f0fdf4', grad: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' };
  };

  const getProductIcon = (n) => { if(!n)return'📦'; const x=n.toLowerCase(); if(x.includes('milk'))return'🥛'; if(x.includes('curd'))return'🥄'; if(x.includes('paneer'))return'🧀'; if(x.includes('ghee'))return'🫕'; if(x.includes('butter'))return'🧈'; return'📦'; };

  // Get top products by revenue
  const topProductsByRevenue = [...dashboardData.products]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  const filteredProducts = (() => {
    let f = [...dashboardData.products];
    if (searchTerm) f = f.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterType === 'profit') f = f.filter(p => p.profit > 0);
    else if (filterType === 'loss') f = f.filter(p => p.profit < 0);
    else if (filterType === 'low-stock') f = f.filter(p => (p.currentStockQuantity / Math.max(p.totalQuantityPurchased, 1)) * 100 <= 30);
    return f;
  })();

  if (loading) return <div className="dash-load"><div className="dash-spin"></div><p>Loading dashboard...</p></div>;

  return (
    <div className="dash-wrap">
      {/* Header */}
      <div className="dash-hdr">
        <div>
          <span className="dash-hdr-greet">{greeting}, {userName} 👋</span>
          <h1>📊 Business Overview</h1>
        </div>
        <div className="dash-hdr-time">
          <span>{currentTime.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span>
          <span>{currentTime.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="dash-stats">
        <div className="dash-stat">
          <span className="dash-stat-icon" style={{background:'#eff6ff'}}>💰</span>
          <div>
            <strong>{formatCurrency(dashboardData.totalInvestment)}</strong>
            <small>Total Investment</small>
          </div>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-icon" style={{background:'#f0fdf4'}}>📈</span>
          <div>
            <strong>{formatCurrency(dashboardData.totalRevenue)}</strong>
            <small>Total Revenue</small>
          </div>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-icon" style={{background:dashboardData.totalProfit>=0?'#f0fdf4':'#fef2f2'}}>🎯</span>
          <div>
            <strong style={{color:dashboardData.totalProfit>=0?'#10b981':'#ef4444'}}>{formatCurrency(dashboardData.totalProfit)}</strong>
            <small>Total Profit</small>
          </div>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-icon" style={{background:'#faf5ff'}}>📊</span>
          <div>
            <strong style={{color:dashboardData.overallProfitMargin>=0?'#8b5cf6':'#ef4444'}}>{dashboardData.overallProfitMargin.toFixed(1)}%</strong>
            <small>Profit Margin</small>
          </div>
        </div>
      </div>

     

      {/* Search and Filter Toolbar */}
      <div className="dash-tool">
        <div className="dash-search">
          <span>🔍</span>
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchTerm} 
            onChange={e=>setSearchTerm(e.target.value)}
          />
          {searchTerm && <button onClick={()=>setSearchTerm('')}>×</button>}
        </div>
        <div className="dash-filters">
          <button className={`dash-fbtn ${filterType==='all'?'active':''}`} onClick={()=>setFilterType('all')}>All</button>
          <button className={`dash-fbtn ${filterType==='profit'?'active':''}`} onClick={()=>setFilterType('profit')}>📈 Profitable</button>
          <button className={`dash-fbtn ${filterType==='loss'?'active':''}`} onClick={()=>setFilterType('loss')}>📉 Loss</button>
          <button className={`dash-fbtn ${filterType==='low-stock'?'active':''}`} onClick={()=>setFilterType('low-stock')}>⚠️ Low Stock</button>
        </div>
      </div>

      {/* Products Grid */}
      <div className="dash-grid">
        {filteredProducts.length===0 ? (
          <div className="dash-empty">
            <span>📦</span>
            <p>No products found</p>
          </div>
        ) : (
          filteredProducts.map((product, idx) => {
            const sl = getStockLevel(product.currentStockQuantity, product.totalQuantityPurchased);
            const stockPct = Math.round((product.currentStockQuantity/Math.max(product.totalQuantityPurchased,1))*100);
            const isExp = selectedProduct?.id === product.id;
            return (
              <div key={idx} className={`dash-card ${isExp?'expanded':''}`}>
                <div className="dash-card-main" onClick={()=>setSelectedProduct(isExp?null:product)}>
                  <div className="dash-card-img" style={{background:sl.grad}}>
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
                    ) : null}
                    <span className="dash-card-emoji" style={{display:product.imageUrl?'none':'flex'}}>{getProductIcon(product.name)}</span>
                    <div className="dash-card-stock-badge" style={{background:sl.bg,color:sl.color}}>{sl.level}</div>
                  </div>
                  <div className="dash-card-body">
                    <h4>{product.name}</h4>
                    <div className="dash-card-fin">
                      <div><small>Investment</small> {formatCurrency(product.totalInvestment)}</div>
                      <div><small>Revenue</small> {formatCurrency(product.totalRevenue)}</div>
                      <div style={{color:product.profit>=0?'#10b981':'#ef4444'}}><small>Profit</small> {formatCurrency(product.profit)}</div>
                    </div>
                    <div className="dash-card-profit" style={{background:product.profit>=0?'#f0fdf4':'#fef2f2',color:product.profit>=0?'#10b981':'#ef4444'}}>
                      {product.profit>=0?'▲':'▼'} {Math.abs(product.profitMargin).toFixed(0)}%
                    </div>
                  </div>
                </div>
                <div className="dash-card-bar">
                  <div className="dash-card-bar-bg">
                    <div className="dash-card-bar-fill" style={{width:`${stockPct}%`,background:sl.color}}></div>
                  </div>
                  <div className="dash-card-bar-lbl">
                    <span>Stock: {product.currentStockQuantity} units</span>
                    <span>Sold: {product.totalSoldQuantity} units</span>
                  </div>
                </div>
                {isExp && (
                  <div className="dash-card-detail">
                    <div className="dash-card-detail-grid">
                      <div><span>Total Purchased</span><strong>{product.totalQuantityPurchased} units</strong></div>
                      <div><span>Total Sold</span><strong>{product.totalSoldQuantity} units</strong></div>
                      <div><span>Remaining Stock</span><strong>{product.remainingStock} units</strong></div>
                      <div><span>Profit Margin</span><strong style={{color:product.profit>=0?'#10b981':'#ef4444'}}>{product.profitMargin.toFixed(1)}%</strong></div>
                    </div>
                    {product.packs?.length>0 && (
                      <div className="dash-card-packs">
                        {product.packs.map((p,i)=>(
                          <span key={i}>{p.size}{p.unit} - ₹{p.price}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <div className="dash-actions">
        <button onClick={()=>navigate('/purchases/add')}><span>➕</span> Add Purchase</button>
        <button onClick={()=>navigate('/inventory/pack-products')}><span>📦</span> Pack Products</button>
        <button onClick={()=>navigate('/sales')}><span>🛒</span> New Sale</button>
        <button onClick={()=>navigate('/inventory/products')}><span>📋</span> Manage Products</button>
      </div>
    </div>
  );
};

export default Dashboard;