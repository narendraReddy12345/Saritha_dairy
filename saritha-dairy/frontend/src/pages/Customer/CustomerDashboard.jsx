// src/pages/Customer/CustomerDashboard.jsx
import React, { useState, useEffect } from 'react';
import './CustomerDashboard.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';
const BASE_URL = 'https://saritha-dairy-api.onrender.com';

// ✅ Image helper
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return `${BASE_URL}/${url}`;
};

const CustomerDashboard = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [showProfile, setShowProfile] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [message, setMessage] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [pulseAnim, setPulseAnim] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [preferences, setPreferences] = useState({
    wantMilk: true, skipDays: [], quantity: 2, packSize: '500ml'
  });

  const [extraOrders, setExtraOrders] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedPackSize, setSelectedPackSize] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);
  const [confetti, setConfetti] = useState(false);

  const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
  const getToken = () => sessionStorage.getItem('authToken');
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  useEffect(() => {
    if (!userData?.id) { window.location.href = '/login'; return; }
    loadCustomerData();
    fetchAllProducts();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const pulseTimer = setInterval(() => setPulseAnim(p => !p), 3000);
    return () => { clearInterval(timer); clearInterval(pulseTimer); };
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setCartCount(extraOrders.filter(o => o.date === today).length);
  }, [extraOrders]);

  useEffect(() => {
    if (confetti) {
      const timer = setTimeout(() => setConfetti(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [confetti]);

  const safeParseArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try { const p = JSON.parse(data); return Array.isArray(p) ? p : []; } 
      catch (e) { return []; }
    }
    return [];
  };

  const fetchAllProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        const productsWithPacks = (data.data || []).map(p => ({
          ...p,
          packs: typeof p.packs === 'string' ? JSON.parse(p.packs) : (p.packs || []),
          imageUrl: getImageUrl(p.image_url)
        }));
        setAllProducts(productsWithPacks);
      }
    } catch (e) { console.error('Error fetching products:', e); }
  };

  const loadCustomerData = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/customer-deliveries/${userData.id}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setDeliveries(data.deliveries || []);
      
      let loadedFromAPI = false;
      try {
        const prefRes = await fetch(`${API_URL}/customer-preferences/${userData.id}`, { headers: getAuthHeaders() });
        const prefData = await prefRes.json();
        
        if (prefData.success && prefData.data) {
          loadedFromAPI = true;
          const apiPrefs = {
            wantMilk: prefData.data.want_milk ?? true,
            quantity: prefData.data.quantity ?? 2,
            packSize: prefData.data.pack_size ?? '500ml',
            skipDays: safeParseArray(prefData.data.skip_days)
          };
          
          setPreferences(apiPrefs);
          localStorage.setItem(`milkPrefs_${userData.id}`, JSON.stringify(apiPrefs));
          
          const orders = safeParseArray(prefData.data.extra_orders);
          if (orders.length > 0) {
            const fixedOrders = orders.map(o => ({ ...o, imageUrl: getImageUrl(o.imageUrl) || o.imageUrl }));
            setExtraOrders(fixedOrders);
            localStorage.setItem(`extraOrders_${userData.id}`, JSON.stringify(fixedOrders));
          }
        }
      } catch (e) { console.log('API failed:', e.message); }
      
      if (!loadedFromAPI) {
        const savedPrefs = localStorage.getItem(`milkPrefs_${userData.id}`);
        if (savedPrefs) {
          try { 
            const p = JSON.parse(savedPrefs);
            setPreferences({
              wantMilk: p.wantMilk ?? true,
              quantity: p.quantity ?? 2,
              packSize: p.packSize ?? '500ml',
              skipDays: Array.isArray(p.skipDays) ? p.skipDays : []
            });
          } catch (e) {}
        }
        const savedOrders = localStorage.getItem(`extraOrders_${userData.id}`);
        if (savedOrders) {
          const orders = safeParseArray(savedOrders);
          setExtraOrders(orders.map(o => ({ ...o, imageUrl: getImageUrl(o.imageUrl) || o.imageUrl })));
        }
      }
    } catch (error) { console.error('Error:', error); }
    setLoading(false);
  };

  const savePreferences = async (newPrefs) => {
    setPreferences(newPrefs); 
    setSaving(true);
    const cleanPrefs = {
      wantMilk: newPrefs.wantMilk, quantity: newPrefs.quantity,
      packSize: newPrefs.packSize, skipDays: newPrefs.skipDays || []
    };
    localStorage.setItem(`milkPrefs_${userData.id}`, JSON.stringify(cleanPrefs));
    try {
      await fetch(`${API_URL}/customer-preferences/${userData.id}`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ 
          wantMilk: cleanPrefs.wantMilk, quantity: cleanPrefs.quantity,
          packSize: cleanPrefs.packSize, skipDays: cleanPrefs.skipDays,
          extraOrders: extraOrders || []
        })
      });
      showMessage('success', '✅ Saved!');
    } catch (error) { showMessage('success', '✅ Saved locally!'); }
    setSaving(false);
  };

  const saveExtraOrders = async (newOrders) => {
    setExtraOrders(newOrders);
    localStorage.setItem(`extraOrders_${userData.id}`, JSON.stringify(newOrders));
    try {
      await fetch(`${API_URL}/customer-preferences/${userData.id}`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ 
          wantMilk: preferences.wantMilk, quantity: preferences.quantity,
          packSize: preferences.packSize, skipDays: preferences.skipDays || [],
          extraOrders: newOrders 
        })
      });
    } catch (error) {}
  };

  const addProductWithQuantity = () => {
    if (!selectedProduct || !selectedPackSize) { showMessage('error', 'Select product & size'); return; }
    const pack = selectedProduct.packs.find(p => `${p.size}${p.unit}` === selectedPackSize);
    const today = new Date().toISOString().split('T')[0];
    const newOrder = {
      id: Date.now(), productName: selectedProduct.name, packSize: selectedPackSize,
      quantity: orderQuantity, price: pack?.price || 0, date: today, imageUrl: selectedProduct.imageUrl,
      status: 'pending'
    };
    saveExtraOrders([...extraOrders, newOrder]);
    setSelectedProduct(null); setSelectedPackSize(''); setOrderQuantity(1); setShowProductModal(false);
    setConfetti(true);
    showMessage('success', '🎉 Added to cart!');
  };

  const removeExtraOrder = (id) => { saveExtraOrders(extraOrders.filter(o => o.id !== id)); };
  const showMessage = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage(null), 2500); };
  const handleLogout = () => { setShowLogoutConfirm(true); };

  const confirmLogout = () => {
    const cleanPrefs = { wantMilk: preferences.wantMilk, quantity: preferences.quantity, packSize: preferences.packSize, skipDays: preferences.skipDays || [], extraOrders: extraOrders || [] };
    localStorage.setItem(`milkPrefs_${userData.id}`, JSON.stringify(cleanPrefs));
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const cancelLogout = () => { setShowLogoutConfirm(false); };
  const handleChangePassword = () => { window.location.href = '/customer/change-password'; };

  const submitFeedback = () => {
    if (feedbackRating === 0) { showMessage('error', 'Rate please'); return; }
    const feedbacks = JSON.parse(localStorage.getItem('feedbacks') || '[]');
    feedbacks.push({ customerId: userData.id, customerName: userData.name, rating: feedbackRating, text: feedbackText, date: new Date().toISOString() });
    localStorage.setItem('feedbacks', JSON.stringify(feedbacks));
    setFeedbackSubmitted(true); showMessage('success', 'Thanks! 🎉');
    setTimeout(() => { setShowFeedback(false); setFeedbackRating(0); setFeedbackText(''); setFeedbackSubmitted(false); }, 1500);
  };

  const getProductColor = (name) => {
    const n = (name||'').toLowerCase();
    if (n.includes('milk')) return 'milk';
    if (n.includes('curd')) return 'curd';
    if (n.includes('paneer')) return 'paneer';
    if (n.includes('ghee')) return 'ghee';
    if (n.includes('butter')) return 'butter';
    return 'default';
  };

  const today = new Date().toISOString().split('T')[0];
  const todayDelivered = deliveries.filter(d => d.delivery_date?.startsWith(today) && d.status === 'delivered');

  const isOrderDelivered = (order) => {
    if (order.status === 'delivered') return true;
    const deliveredProduct = deliveries.find(d => 
      d.delivery_date?.startsWith(today) && d.product_name === order.productName && d.status === 'delivered'
    );
    return !!deliveredProduct;
  };

  // ✅ Calculate totals
  const thisMonthDeliveries = deliveries.filter(d => {
    const dDate = new Date(d.delivery_date);
    const now = new Date();
    return dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
  });
  const milkTotal = thisMonthDeliveries.reduce((s, d) => s + (parseFloat(d.total_amount) || 0), 0);
  const extraOrdersTotal = extraOrders.reduce((s, o) => s + (o.price * o.quantity), 0);
  const grandTotal = milkTotal + extraOrdersTotal;

  const hour = currentTime.getHours();
  const timeEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';
  const timeText = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  if (loading) {
    return (
      <div className="cst-loading-screen">
        <div className="cst-loader-container"><div className="cst-loader-ring"></div><div className="cst-loader-center">🥛</div></div>
        <p className="cst-loading-text">Pouring fresh goodness...</p>
      </div>
    );
  }

  return (
    <div className="cst-magic-app">
      {message && (<div className={`cst-toast-glass ${message.type}`}><span>{message.text}</span><button onClick={() => setMessage(null)}>×</button></div>)}

      {/* ✅ Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="cst-modal-overlay" onClick={cancelLogout}>
          <div className="cst-modal-magic" onClick={e => e.stopPropagation()} style={{maxWidth:'320px',margin:'auto',borderRadius:'24px',padding:'24px'}}>
            <div className="cst-modal-handle"></div>
            <div style={{textAlign:'center',padding:'10px 0'}}>
              <span style={{fontSize:'50px',display:'block',marginBottom:'10px'}}>🚪</span>
              <h3 style={{margin:'0 0 6px',fontSize:'18px',color:'#1a1a1a'}}>Logout?</h3>
              <p style={{color:'#94a3b8',fontSize:'13px',margin:'0 0 20px'}}>Are you sure you want to logout?</p>
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={cancelLogout} className="cst-btn-ghost" style={{flex:1,padding:'12px',borderRadius:'14px',border:'none',background:'#f3f4f6',fontWeight:'600',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
                <button onClick={confirmLogout} className="cst-btn-magic" style={{flex:1,background:'#ef4444',padding:'12px',borderRadius:'14px',border:'none',color:'white',fontWeight:'700',fontSize:'14px',cursor:'pointer'}}>Logout</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confetti && (<div className="cst-confetti-container">{[...Array(20)].map((_, i) => (<span key={i} className="cst-confetti-piece" style={{left:`${Math.random()*100}%`,animationDelay:`${Math.random()*0.5}s`,backgroundColor:['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6'][i%5],width:`${6+Math.random()*8}px`,height:`${6+Math.random()*8}px`}}></span>))}</div>)}

      {showProductModal && selectedProduct && (
        <div className="cst-modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="cst-modal-magic" onClick={e => e.stopPropagation()}>
            <div className="cst-modal-handle"></div>
            <div className="cst-modal-hero">
              <div className="cst-modal-hero-img">{selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} alt={selectedProduct.name} /> : <span className="cst-modal-hero-emoji">📷</span>}</div>
              <div className="cst-modal-hero-info"><h2>{selectedProduct.name}</h2><span className="cst-modal-badge">Fresh & Pure</span></div>
            </div>
            <div className="cst-form-group"><label>📏 Choose Pack Size</label><div className="cst-chips-glass">{selectedProduct.packs.map((p, i) => (<button key={i} className={`cst-chip-glass ${selectedPackSize===`${p.size}${p.unit}`?'active':''}`} onClick={()=>setSelectedPackSize(`${p.size}${p.unit}`)}><strong>{p.size}{p.unit}</strong><span>₹{p.price}</span></button>))}</div></div>
            {selectedPackSize && (<div className="cst-form-group"><label>🔢 Quantity</label><div className="cst-qty-selector">{[1,2,3,4,5].map(q=>(<button key={q} className={`cst-qty-btn ${orderQuantity===q?'active':''}`} onClick={()=>setOrderQuantity(q)}>{q}</button>))}</div></div>)}
            <div className="cst-modal-actions"><button onClick={()=>setShowProductModal(false)} className="cst-btn-ghost">Cancel</button><button onClick={addProductWithQuantity} className="cst-btn-magic" disabled={!selectedPackSize}>✨ Add to Cart</button></div>
          </div>
        </div>
      )}

      {showFeedback && (
        <div className="cst-modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="cst-modal-magic" onClick={e => e.stopPropagation()}>
            <div className="cst-modal-handle"></div>
            {!feedbackSubmitted ? (<><h3 className="cst-modal-title">💬 How was your experience?</h3><div className="cst-stars-magic">{[1,2,3,4,5].map(s=>(<button key={s} className={`cst-star-magic ${feedbackRating>=s?'active':''}`} onClick={()=>setFeedbackRating(s)}>{feedbackRating>=s?'⭐':'☆'}</button>))}</div><textarea placeholder="Your feedback helps us improve..." value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} rows={2}/><button onClick={submitFeedback} className="cst-btn-magic full">Submit Feedback</button></>) : (<div className="cst-thankyou"><span>🎉</span><h3>Thank You!</h3><p>Your feedback means a lot!</p></div>)}
          </div>
        </div>
      )}

      {/* ✅ Header with Logout button properly placed */}
      <header className="cst-header-magic">
        <div className="cst-header-user" onClick={()=>setShowProfile(!showProfile)}>
          <div className="cst-avatar-magic"><div className="cst-avatar-core">{userData?.name?.charAt(0)?.toUpperCase()||'C'}</div><div className={`cst-avatar-aura ${pulseAnim?'pulse':''}`}></div></div>
          <div><small className="cst-header-greeting">{timeEmoji} Good {timeText}</small><h2>{userData?.name?.split(' ')[0]||'Customer'}</h2></div>
        </div>
        <div className="cst-header-actions">
          <button className="cst-cart-magic" onClick={()=>setActiveTab('orders')}>🛒{cartCount>0&&<span className="cst-cart-dot-magic">{cartCount}</span>}</button>
          <button onClick={handleLogout} className="cst-logout-icon-btn" title="Logout">
            <span>🚪</span>
          </button>
        </div>
      </header>

      {showProfile && (
        <div className="cst-profile-panel">
          <div className="cst-profile-avatar-big">{userData?.name?.charAt(0)?.toUpperCase()}</div><h3>{userData?.name}</h3><p>📱 {userData?.phone}</p>
          <div className="cst-profile-grid-2"><span>🏢 {userData?.apartment||'N/A'}</span><span>🚪 {userData?.flat_no||'N/A'}</span></div>
          <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
            <button onClick={handleChangePassword} className="cst-btn-ghost" style={{flex:1,fontSize:'12px'}}>🔒 Password</button>
            <button onClick={handleLogout} className="cst-btn-magic" style={{flex:1,background:'#ef4444',fontSize:'12px'}}>🚪 Logout</button>
          </div>
        </div>
      )}

      <main className="cst-main-scroll">
        {/* HOME TAB */}
        {activeTab === 'home' && (<>
          <div className="cst-hero-magic">
            <div className="cst-hero-content-magic"><span className="cst-hero-pill">🥛 Fresh Daily</span><h1>Pure Dairy.<br/>Pure Love.</h1><p>Farm fresh products delivered to your doorstep every morning</p><div className="cst-hero-stats"><span>🚀 Free Delivery</span><span>⭐ 4.8 Rating</span></div></div>
            <div className="cst-hero-visual-magic"><span className="cst-hero-float-1">🥛</span><span className="cst-hero-float-2">🧀</span></div>
          </div>

          {/* ✅ TOTAL BILL CARD */}
          <div className="cst-bill-card">
            <div className="cst-bill-header">
              <span>💰 Your Bill</span>
              <span className="cst-bill-date">{new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="cst-bill-section">
              <p className="cst-bill-section-title">🥛 Milk Subscription</p>
              <div className="cst-bill-row"><span>{preferences.quantity || 2} × {preferences.packSize || '500ml'} per day</span><span className="text-green">Active</span></div>
              <div className="cst-bill-row"><span>Monthly deliveries</span><span>{thisMonthDeliveries.length} packets</span></div>
              <div className="cst-bill-row"><span>Milk Charges</span><strong>₹{milkTotal.toLocaleString()}</strong></div>
            </div>
            <div className="cst-bill-section">
              <p className="cst-bill-section-title">📦 Extra Products</p>
              {extraOrders.length === 0 ? (
                <p className="cst-bill-empty">No extra orders yet</p>
              ) : (
                extraOrders.slice(0, 5).map((order, i) => (
                  <div key={i} className="cst-bill-row">
                    <span>{order.productName} ({order.packSize}) ×{order.quantity}</span>
                    <span className={order.status === 'delivered' ? 'text-green' : 'text-orange'}>
                      ₹{order.price * order.quantity}
                      {order.status === 'delivered' ? ' ✅' : ' ⏳'}
                    </span>
                  </div>
                ))
              )}
              {extraOrders.length > 5 && <p className="cst-bill-more">+{extraOrders.length - 5} more items</p>}
              <div className="cst-bill-row"><span>Extra Charges</span><strong>₹{extraOrdersTotal.toLocaleString()}</strong></div>
            </div>
            <div className="cst-bill-total">
              <span>Total Amount</span>
              <strong>₹{grandTotal.toLocaleString()}</strong>
            </div>
          </div>

          {todayDelivered.length>0&&(<div className="cst-status-strip"><span>✅ Milk delivered today! ({todayDelivered.length} packet)</span><button onClick={()=>setShowFeedback(true)}>Rate</button></div>)}
          <div className="cst-section-header"><div><h3>🛍️ Our Products</h3><p>Tap to add to your cart</p></div></div>
          <div className="cst-magic-grid">{allProducts.length===0?(<div className="cst-empty-magic"><span>📦</span><p>No products available</p></div>):allProducts.map((product,i)=>{const color=getProductColor(product.name);const minPrice=product.packs.length>0?Math.min(...product.packs.map(p=>parseFloat(p.price)||0)):0;const maxPrice=product.packs.length>0?Math.max(...product.packs.map(p=>parseFloat(p.price)||0)):0;return(<div key={product.id} className={`cst-magic-card ${color}`} style={{animationDelay:`${i*0.05}s`}} onClick={()=>{setSelectedProduct(product);setSelectedPackSize('');setOrderQuantity(1);setShowProductModal(true);}}><div className="cst-magic-card-img">{product.imageUrl?(<img src={product.imageUrl} alt={product.name} loading="lazy" onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>):null}<span className="cst-magic-fallback" style={{display:product.imageUrl?'none':'flex'}}>📷</span><div className="cst-magic-price">{minPrice===maxPrice?`₹${minPrice}`:`₹${minPrice}-${maxPrice}`}</div><div className="cst-magic-rating">⭐ 4.8</div></div><div className="cst-magic-card-body"><h4>{product.name}</h4><p>{product.packs.map(p=>`${p.size}${p.unit}`).join(' · ')}</p><button className="cst-magic-add-btn"><span>+</span> Add</button></div></div>)})}</div>
        </>)}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="cst-section">
            <h3>🛒 Your Orders</h3>
            {extraOrders.length === 0 ? (
              <div className="cst-empty-magic"><span>🛒</span><p>No orders yet</p><button onClick={()=>setActiveTab('home')} className="cst-btn-magic">Browse Products</button></div>
            ) : (<>
              <p className="cst-subtitle">📅 Today's Orders</p>
              {extraOrders.filter(o=>o.date===today).length===0 ? (
                <div className="cst-no-orders-today"><span>📭</span><p>No orders for today yet</p></div>
              ) : extraOrders.filter(o=>o.date===today).map(o=>{const delivered=isOrderDelivered(o);return(<div key={o.id} className={`cst-order-card ${delivered?'delivered-card':'pending-card'}`}><div className="cst-order-img">{o.imageUrl?<img src={o.imageUrl} alt={o.productName}/>:<span>📦</span>}</div><div className="cst-order-info"><h5>{o.productName}</h5><p>{o.packSize} × {o.quantity}</p></div><div className="cst-order-right"><strong>₹{o.price*o.quantity}</strong><span className={`cst-order-status-badge ${delivered?'delivered':'pending'}`}>{delivered?'✅ Delivered':'⏳ Pending'}</span></div>{!delivered&&<button onClick={()=>removeExtraOrder(o.id)} className="cst-order-del">×</button>}</div>)})}
              {extraOrders.filter(o=>o.date!==today).length>0&&(<><p className="cst-subtitle" style={{marginTop:'20px'}}>📜 Previous Orders</p>{extraOrders.filter(o=>o.date!==today).map(o=>{const delivered=isOrderDelivered(o);return(<div key={o.id} className={`cst-order-card past ${delivered?'was-delivered':''}`}><span className="cst-past-icon">{delivered?'✅':'📦'}</span><span className="cst-past-product">{o.productName} ({o.packSize}) ×{o.quantity}</span><span className="cst-past-date">{new Date(o.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span><span className={`cst-order-status-badge small ${delivered?'delivered':'pending'}`}>{delivered?'Delivered':'Pending'}</span><strong>₹{o.price*o.quantity}</strong></div>)})}</>)}
            </>)}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (<div className="cst-section"><h3>📜 Delivery History</h3>{deliveries.length===0?(<div className="cst-empty-magic"><span>📭</span><p>No deliveries</p></div>):deliveries.map(d=>(<div key={d.id} className="cst-history-magic"><div className={`cst-history-dot-magic ${d.status}`}></div><div className="cst-history-content-magic"><span className="cst-history-date">{new Date(d.delivery_date).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span><span>{d.product_name} · {d.pack_size} × {d.quantity}</span><div className="cst-history-row-magic"><span className={`cst-badge-magic ${d.status}`}>{d.status==='delivered'?'Done':'Pending'}</span><strong>₹{d.total_amount}</strong></div></div></div>))}</div>)}

        {/* PREFERENCES TAB */}
        {activeTab === 'preferences' && (<div className="cst-section"><h3>🥛 Milk Settings</h3><div className="cst-pref-magic"><div className="cst-pref-row-magic"><span>Daily Delivery</span><label className="cst-toggle-magic"><input type="checkbox" checked={preferences.wantMilk} onChange={e=>savePreferences({...preferences,wantMilk:e.target.checked})}/><span></span></label></div></div><div className="cst-pref-magic"><p>Quantity</p><div className="cst-chips-glass">{[1,2,3,4,5].map(q=><button key={q} className={`cst-chip-glass ${preferences.quantity===q?'active':''}`} onClick={()=>savePreferences({...preferences,quantity:q})}>{q}</button>)}</div></div><div className="cst-pref-magic"><p>Pack Size</p><div className="cst-chips-glass">{['250ml','500ml','1L'].map(s=><button key={s} className={`cst-chip-glass ${preferences.packSize===s?'active':''}`} onClick={()=>savePreferences({...preferences,packSize:s})}>{s}</button>)}</div></div><div className="cst-pref-magic"><p>Skip Days</p><div className="cst-chips-glass">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><button key={d} className={`cst-chip-glass ${preferences.skipDays.includes(d)?'active':''}`} onClick={()=>{const ns=preferences.skipDays.includes(d)?preferences.skipDays.filter(x=>x!==d):[...preferences.skipDays,d];savePreferences({...preferences,skipDays:ns})}}>{d}</button>)}</div></div><button onClick={()=>showMessage('success','✅ Saved!')} className="cst-btn-magic full" disabled={saving}>{saving?'⏳ Saving...':'💾 Save'}</button></div>)}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (<div className="cst-section"><h3>⚙️ More</h3><button onClick={handleChangePassword} className="cst-setting-magic"><span>🔒</span>Change Password<span>→</span></button><button onClick={()=>setShowFeedback(true)} className="cst-setting-magic"><span>💬</span>Feedback<span>→</span></button><div className="cst-setting-magic"><span>📞</span>9398263810</div><button onClick={handleLogout} className="cst-setting-magic logout"><span>🚪</span>Logout</button></div>)}
      </main>

      <nav className="cst-nav-magic">
        {[{id:'home',icon:'🏪',label:'Shop'},{id:'orders',icon:'🛒',label:'Orders'},{id:'history',icon:'📜',label:'History'},{id:'preferences',icon:'🥛',label:'Milk'}].map(item=>(<button key={item.id} className={`cst-nav-item-magic ${activeTab===item.id?'active':''}`} onClick={()=>setActiveTab(item.id)}><span className="cst-nav-icon-magic">{item.icon}</span><span className="cst-nav-label-magic">{item.label}</span>{activeTab===item.id&&<span className="cst-nav-active-dot"></span>}</button>))}
      </nav>
    </div>
  );
};

export default CustomerDashboard;