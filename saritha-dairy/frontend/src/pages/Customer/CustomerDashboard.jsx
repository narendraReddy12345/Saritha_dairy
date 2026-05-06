// src/pages/Customer/CustomerDashboard.jsx
import React, { useState, useEffect } from 'react';
import './CustomerDashboard.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';
const BASE_URL = 'https://saritha-dairy-api.onrender.com';

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
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  
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
    if (confetti) { const t = setTimeout(() => setConfetti(false), 2000); return () => clearTimeout(t); }
  }, [confetti]);

  const safeParseArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') { try { const p = JSON.parse(data); return Array.isArray(p) ? p : []; } catch (e) { return []; } }
    return [];
  };

  const fetchAllProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setAllProducts((data.data || []).map(p => ({
          ...p, packs: typeof p.packs === 'string' ? JSON.parse(p.packs) : (p.packs || []),
          imageUrl: getImageUrl(p.image_url)
        })));
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
          setPreferences({
            wantMilk: prefData.data.want_milk ?? true,
            quantity: prefData.data.quantity ?? 2,
            packSize: prefData.data.pack_size ?? '500ml',
            skipDays: safeParseArray(prefData.data.skip_days)
          });
          localStorage.setItem(`milkPrefs_${userData.id}`, JSON.stringify({ wantMilk: prefData.data.want_milk ?? true, quantity: prefData.data.quantity ?? 2, packSize: prefData.data.pack_size ?? '500ml', skipDays: safeParseArray(prefData.data.skip_days) }));
          
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
        if (savedPrefs) { try { const p = JSON.parse(savedPrefs); setPreferences(p); } catch (e) {} }
        const savedOrders = localStorage.getItem(`extraOrders_${userData.id}`);
        if (savedOrders) { const orders = safeParseArray(savedOrders); setExtraOrders(orders.map(o => ({ ...o, imageUrl: getImageUrl(o.imageUrl) || o.imageUrl }))); }
      }
    } catch (error) { console.error('Error:', error); }
    setLoading(false);
  };

  const savePreferences = async (newPrefs) => {
    setPreferences(newPrefs); setSaving(true);
    localStorage.setItem(`milkPrefs_${userData.id}`, JSON.stringify(newPrefs));
    try {
      await fetch(`${API_URL}/customer-preferences/${userData.id}`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ ...newPrefs, extraOrders })
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
        body: JSON.stringify({ ...preferences, extraOrders: newOrders })
      });
    } catch (error) {}
  };

  // ✅ Calendar Helpers - Specific dates
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getMonthName = (month) => ['January','February','March','April','May','June','July','August','September','October','November','December'][month];

  const isDateSkipped = (day, month, year) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return preferences.skipDays?.includes(dateStr);
  };

  const toggleCalendarDate = (day, month, year) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const newSkip = preferences.skipDays?.includes(dateStr)
      ? preferences.skipDays.filter(d => d !== dateStr)
      : [...(preferences.skipDays || []), dateStr];
    savePreferences({ ...preferences, skipDays: newSkip });
  };

  const changeMonth = (delta) => {
    let newMonth = calendarMonth + delta;
    let newYear = calendarYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    setCalendarMonth(newMonth);
    setCalendarYear(newYear);
  };

  const addProductWithQuantity = () => {
    if (!selectedProduct || !selectedPackSize) { showMessage('error', 'Select product & size'); return; }
    const pack = selectedProduct.packs.find(p => `${p.size}${p.unit}` === selectedPackSize);
    const today = new Date().toISOString().split('T')[0];
    const newOrder = { id: Date.now(), productName: selectedProduct.name, packSize: selectedPackSize, quantity: orderQuantity, price: pack?.price || 0, date: today, imageUrl: selectedProduct.imageUrl, status: 'pending' };
    saveExtraOrders([...extraOrders, newOrder]);
    setSelectedProduct(null); setSelectedPackSize(''); setOrderQuantity(1); setShowProductModal(false);
    setConfetti(true);
    showMessage('success', '🎉 Added to cart!');
  };

  const removeExtraOrder = (id) => { saveExtraOrders(extraOrders.filter(o => o.id !== id)); };
  const showMessage = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage(null), 2500); };
  const handleLogout = () => { setShowLogoutConfirm(true); };
  const confirmLogout = () => { sessionStorage.clear(); window.location.href = '/login'; };
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
    if (n.includes('milk')) return 'milk'; if (n.includes('curd')) return 'curd';
    if (n.includes('paneer')) return 'paneer'; if (n.includes('ghee')) return 'ghee';
    if (n.includes('butter')) return 'butter'; return 'default';
  };

  const today = new Date().toISOString().split('T')[0];
  const todayDelivered = deliveries.filter(d => d.delivery_date?.startsWith(today) && d.status === 'delivered');
  const isOrderDelivered = (order) => order.status === 'delivered' || deliveries.some(d => d.delivery_date?.startsWith(today) && d.product_name === order.productName && d.status === 'delivered');

  const thisMonthDeliveries = deliveries.filter(d => { const dD = new Date(d.delivery_date); const n = new Date(); return dD.getMonth() === n.getMonth() && dD.getFullYear() === n.getFullYear(); });
  const milkTotal = thisMonthDeliveries.reduce((s, d) => s + (parseFloat(d.total_amount) || 0), 0);
  const extraOrdersTotal = extraOrders.reduce((s, o) => s + (o.price * o.quantity), 0);
  const grandTotal = milkTotal + extraOrdersTotal;

  const hour = currentTime.getHours();
  const timeEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';
  const timeText = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  // Build calendar
  const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

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
      {showLogoutConfirm && (
        <div className="cst-modal-overlay" onClick={cancelLogout}>
          <div className="cst-modal-magic" onClick={e => e.stopPropagation()} style={{maxWidth:'320px',margin:'auto',borderRadius:'24px',padding:'24px'}}>
            <div className="cst-modal-handle"></div>
            <div style={{textAlign:'center',padding:'10px 0'}}><span style={{fontSize:'50px',display:'block',marginBottom:'10px'}}>🚪</span><h3 style={{margin:'0 0 6px',fontSize:'18px'}}>Logout?</h3><p style={{color:'#94a3b8',fontSize:'13px',margin:'0 0 20px'}}>Are you sure?</p>
              <div style={{display:'flex',gap:'10px'}}><button onClick={cancelLogout} className="cst-btn-ghost" style={{flex:1,padding:'12px',borderRadius:'14px',border:'none',background:'#f3f4f6',fontWeight:'600',cursor:'pointer'}}>Cancel</button><button onClick={confirmLogout} className="cst-btn-magic" style={{flex:1,background:'#ef4444',padding:'12px',borderRadius:'14px',border:'none',color:'white',fontWeight:'700',cursor:'pointer'}}>Logout</button></div>
            </div>
          </div>
        </div>
      )}
      {confetti && (<div className="cst-confetti-container">{[...Array(20)].map((_, i) => (<span key={i} className="cst-confetti-piece" style={{left:`${Math.random()*100}%`,animationDelay:`${Math.random()*0.5}s`,backgroundColor:['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6'][i%5],width:`${6+Math.random()*8}px`,height:`${6+Math.random()*8}px`}}></span>))}</div>)}
      {showProductModal && selectedProduct && (
        <div className="cst-modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="cst-modal-magic" onClick={e => e.stopPropagation()}>
            <div className="cst-modal-handle"></div>
            <div className="cst-modal-hero"><div className="cst-modal-hero-img">{selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} alt={selectedProduct.name} /> : <span className="cst-modal-hero-emoji">📷</span>}</div><div className="cst-modal-hero-info"><h2>{selectedProduct.name}</h2><span className="cst-modal-badge">Fresh & Pure</span></div></div>
            <div className="cst-form-group"><label>📏 Choose Pack Size</label><div className="cst-chips-glass">{selectedProduct.packs.map((p, i) => (<button key={i} className={`cst-chip-glass ${selectedPackSize===`${p.size}${p.unit}`?'active':''}`} onClick={()=>setSelectedPackSize(`${p.size}${p.unit}`)}><strong>{p.size}{p.unit}</strong><span>₹{p.price}</span></button>))}</div></div>
            {selectedPackSize && (<div className="cst-form-group"><label>🔢 Quantity</label><div className="cst-qty-selector">{[1,2,3,4,5].map(q=>(<button key={q} className={`cst-qty-btn ${orderQuantity===q?'active':''}`} onClick={()=>setOrderQuantity(q)}>{q}</button>))}</div></div>)}
            <div className="cst-modal-actions"><button onClick={()=>setShowProductModal(false)} className="cst-btn-ghost">Cancel</button><button onClick={addProductWithQuantity} className="cst-btn-magic" disabled={!selectedPackSize}>✨ Add to Cart</button></div>
          </div>
        </div>
      )}
      {showFeedback && (
        <div className="cst-modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="cst-modal-magic" onClick={e => e.stopPropagation()}><div className="cst-modal-handle"></div>
            {!feedbackSubmitted ? (<><h3 className="cst-modal-title">💬 Rate Experience</h3><div className="cst-stars-magic">{[1,2,3,4,5].map(s=>(<button key={s} className={`cst-star-magic ${feedbackRating>=s?'active':''}`} onClick={()=>setFeedbackRating(s)}>{feedbackRating>=s?'⭐':'☆'}</button>))}</div><textarea placeholder="Tell us more..." value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} rows={2}/><button onClick={submitFeedback} className="cst-btn-magic full">Submit</button></>) : (<div className="cst-thankyou"><span>🎉</span><h3>Thank You!</h3></div>)}
          </div>
        </div>
      )}

      {/* ✅ HEADER - No logout door icon */}
      <header className="cst-header-magic">
        <div className="cst-header-user" onClick={()=>setShowProfile(!showProfile)}>
          <div className="cst-avatar-magic"><div className="cst-avatar-core">{userData?.name?.charAt(0)?.toUpperCase()||'C'}</div><div className={`cst-avatar-aura ${pulseAnim?'pulse':''}`}></div></div>
          <div><small className="cst-header-greeting">{timeEmoji} Good {timeText}</small><h2>{userData?.name?.split(' ')[0]||'Customer'}</h2></div>
        </div>
        <div className="cst-header-actions">
          <button className="cst-cart-magic" onClick={()=>setActiveTab('orders')}>🛒{cartCount>0&&<span className="cst-cart-dot-magic">{cartCount}</span>}</button>
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
          <div className="cst-hero-magic"><div className="cst-hero-content-magic"><span className="cst-hero-pill">🥛 Fresh Daily</span><h1>Pure Dairy.<br/>Pure Love.</h1><p>Farm fresh products delivered to your doorstep every morning</p><div className="cst-hero-stats"><span>🚀 Free Delivery</span><span>⭐ 4.8 Rating</span></div></div><div className="cst-hero-visual-magic"><span className="cst-hero-float-1">🥛</span><span className="cst-hero-float-2">🧀</span></div></div>
          {todayDelivered.length>0&&(<div className="cst-status-strip"><span>✅ Milk delivered today! ({todayDelivered.length} packet)</span><button onClick={()=>setShowFeedback(true)}>Rate</button></div>)}
          <div className="cst-section-header"><div><h3>🛍️ Our Products</h3><p>Tap to add to your cart</p></div></div>
          <div className="cst-magic-grid">{allProducts.length===0?(<div className="cst-empty-magic"><span>📦</span><p>No products available</p></div>):allProducts.map((product,i)=>{const color=getProductColor(product.name);const minPrice=product.packs.length>0?Math.min(...product.packs.map(p=>parseFloat(p.price)||0)):0;const maxPrice=product.packs.length>0?Math.max(...product.packs.map(p=>parseFloat(p.price)||0)):0;return(<div key={product.id} className={`cst-magic-card ${color}`} style={{animationDelay:`${i*0.05}s`}} onClick={()=>{setSelectedProduct(product);setSelectedPackSize('');setOrderQuantity(1);setShowProductModal(true);}}><div className="cst-magic-card-img">{product.imageUrl?(<img src={product.imageUrl} alt={product.name} loading="lazy" onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>):null}<span className="cst-magic-fallback" style={{display:product.imageUrl?'none':'flex'}}>📷</span><div className="cst-magic-price">{minPrice===maxPrice?`₹${minPrice}`:`₹${minPrice}-${maxPrice}`}</div><div className="cst-magic-rating">⭐ 4.8</div></div><div className="cst-magic-card-body"><h4>{product.name}</h4><p>{product.packs.map(p=>`${p.size}${p.unit}`).join(' · ')}</p><button className="cst-magic-add-btn"><span>+</span> Add</button></div></div>)})}</div>
        </>)}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="cst-section"><h3>🛒 Your Orders</h3>
            {extraOrders.length===0?(<div className="cst-empty-magic"><span>🛒</span><p>No orders yet</p><button onClick={()=>setActiveTab('home')} className="cst-btn-magic">Browse Products</button></div>):(<>
              <p className="cst-subtitle">📅 Today's Orders</p>
              {extraOrders.filter(o=>o.date===today).length===0?(<div className="cst-no-orders-today"><span>📭</span><p>No orders for today yet</p></div>):extraOrders.filter(o=>o.date===today).map(o=>{const delivered=isOrderDelivered(o);return(<div key={o.id} className={`cst-order-card ${delivered?'delivered-card':'pending-card'}`}><div className="cst-order-img">{o.imageUrl?<img src={o.imageUrl} alt={o.productName}/>:<span>📦</span>}</div><div className="cst-order-info"><h5>{o.productName}</h5><p>{o.packSize} × {o.quantity}</p></div><div className="cst-order-right"><strong>₹{o.price*o.quantity}</strong><span className={`cst-order-status-badge ${delivered?'delivered':'pending'}`}>{delivered?'✅ Delivered':'⏳ Pending'}</span></div>{!delivered&&<button onClick={()=>removeExtraOrder(o.id)} className="cst-order-del">×</button>}</div>)})}
              {extraOrders.filter(o=>o.date!==today).length>0&&(<><p className="cst-subtitle" style={{marginTop:'20px'}}>📜 Previous Orders</p>{extraOrders.filter(o=>o.date!==today).map(o=>{const delivered=isOrderDelivered(o);return(<div key={o.id} className={`cst-order-card past ${delivered?'was-delivered':''}`}><span className="cst-past-icon">{delivered?'✅':'📦'}</span><span className="cst-past-product">{o.productName} ({o.packSize}) ×{o.quantity}</span><span className="cst-past-date">{new Date(o.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span><span className={`cst-order-status-badge small ${delivered?'delivered':'pending'}`}>{delivered?'Delivered':'Pending'}</span><strong>₹{o.price*o.quantity}</strong></div>)})}</>)}
            </>)}
          </div>
        )}

        {/* BILL TAB */}
        {activeTab === 'bill' && (
          <div className="cst-section">
            <div className="cst-bill-innovative">
              <div className="cst-bill-glass-header"><div className="cst-bill-wave"></div><div className="cst-bill-amount-circle"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6"/><circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="6" strokeDasharray={`${(grandTotal/(grandTotal||1))*264} 264`} strokeLinecap="round" transform="rotate(-90 50 50)"/></svg><div className="cst-bill-amount-inner"><span className="cst-bill-total-label">Payable</span><strong className="cst-bill-total-amount">₹{grandTotal.toLocaleString()}</strong></div></div></div>
              <div className="cst-bill-details">
                <div className="cst-bill-detail-card milk"><div className="cst-bill-card-icon">🥛</div><div className="cst-bill-card-info"><h4>Daily Milk</h4><p>{preferences.quantity || 2} × {preferences.packSize || '500ml'} • {thisMonthDeliveries.length} deliveries</p><span className="cst-bill-card-status">{preferences.wantMilk ? '🟢 Active' : '🔴 Paused'}</span></div><strong className="cst-bill-card-amount">₹{milkTotal.toLocaleString()}</strong></div>
                <div className="cst-bill-detail-card extra"><div className="cst-bill-card-icon">📦</div><div className="cst-bill-card-info"><h4>Extra Products</h4><p>{extraOrders.length} items ordered</p><div className="cst-bill-mini-items">{extraOrders.slice(0,3).map((o,i)=>(<span key={i} className="cst-bill-mini-tag">{o.productName} ×{o.quantity}</span>))}{extraOrders.length>3&&<span className="cst-bill-mini-more">+{extraOrders.length-3}</span>}</div></div><strong className="cst-bill-card-amount">₹{extraOrdersTotal.toLocaleString()}</strong></div>
              </div>
              <div className="cst-bill-total-bar"><div className="cst-bill-total-bar-row"><span>Milk Charges</span><span>₹{milkTotal.toLocaleString()}</span></div><div className="cst-bill-total-bar-row"><span>Extra Products</span><span>₹{extraOrdersTotal.toLocaleString()}</span></div><div className="cst-bill-total-bar-divider"></div><div className="cst-bill-total-bar-row grand"><span>Total Payable</span><strong>₹{grandTotal.toLocaleString()}</strong></div></div>
              <div className="cst-bill-thankyou"><span>🥛</span><p>Pure by Nature, Trusted by Families</p></div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (<div className="cst-section"><h3>📜 Delivery History</h3>{deliveries.length===0?(<div className="cst-empty-magic"><span>📭</span><p>No deliveries</p></div>):deliveries.map(d=>(<div key={d.id} className="cst-history-magic"><div className={`cst-history-dot-magic ${d.status}`}></div><div className="cst-history-content-magic"><span className="cst-history-date">{new Date(d.delivery_date).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span><span>{d.product_name} · {d.pack_size} × {d.quantity}</span><div className="cst-history-row-magic"><span className={`cst-badge-magic ${d.status}`}>{d.status==='delivered'?'Done':'Pending'}</span><strong>₹{d.total_amount}</strong></div></div></div>))}</div>)}

        {/* ✅ PREFERENCES TAB - Calendar with specific dates, no 250ml */}
        {activeTab === 'preferences' && (
          <div className="cst-section">
            <h3>🥛 Milk Settings</h3>
            
            <div className="cst-pref-magic">
              <div className="cst-pref-row-magic">
                <span>Daily Delivery</span>
                <label className="cst-toggle-magic">
                  <input type="checkbox" checked={preferences.wantMilk} onChange={e=>savePreferences({...preferences,wantMilk:e.target.checked})}/>
                  <span></span>
                </label>
              </div>
              {!preferences.wantMilk && <p style={{color:'#ef4444',fontSize:'11px',textAlign:'center',marginTop:'8px'}}>⏸️ Milk delivery is paused</p>}
            </div>

            <div className="cst-pref-magic">
              <p>Quantity per day</p>
              <div className="cst-chips-glass">{[1,2,3,4,5].map(q=>(<button key={q} className={`cst-chip-glass ${preferences.quantity===q?'active':''}`} onClick={()=>savePreferences({...preferences,quantity:q})}>{q} pkt</button>))}</div>
            </div>

            {/* ✅ Only 500ml and 1L */}
            <div className="cst-pref-magic">
              <p>Pack Size</p>
              <div className="cst-chips-glass">{['500ml','1L'].map(s=>(<button key={s} className={`cst-chip-glass ${preferences.packSize===s?'active':''}`} onClick={()=>savePreferences({...preferences,packSize:s})}>{s}</button>))}</div>
            </div>

            {/* ✅ CALENDAR - Skip specific dates */}
            <div className="cst-pref-magic">
              <p>📅 Skip Specific Dates</p>
              <p style={{fontSize:'10px',color:'#888',marginBottom:'8px'}}>Tap dates you want to skip delivery</p>
              
              <div className="cst-calendar">
                <div className="cst-calendar-header">
                  <button onClick={() => changeMonth(-1)} className="cst-calendar-nav">◀</button>
                  <span className="cst-calendar-month">{getMonthName(calendarMonth)} {calendarYear}</span>
                  <button onClick={() => changeMonth(1)} className="cst-calendar-nav">▶</button>
                </div>

                <div className="cst-calendar-day-headers">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (<span key={d} className="cst-calendar-day-header">{d}</span>))}
                </div>

                <div className="cst-calendar-grid">
                  {calendarDays.map((day, i) => {
                    if (day === null) return <div key={`empty-${i}`} className="cst-calendar-day empty"></div>;
                    const skipped = isDateSkipped(day, calendarMonth, calendarYear);
                    const isToday = day === new Date().getDate() && calendarMonth === new Date().getMonth() && calendarYear === new Date().getFullYear();
                    const isPast = new Date(calendarYear, calendarMonth, day) < new Date(new Date().toDateString());
                    
                    return (
                      <button
                        key={day}
                        className={`cst-calendar-day ${skipped ? 'skipped' : ''} ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}`}
                        onClick={() => !isPast && toggleCalendarDate(day, calendarMonth, calendarYear)}
                        disabled={isPast}
                      >
                        <span className="cst-calendar-day-num">{day}</span>
                        {skipped && <span className="cst-calendar-skip-dot">✕</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected skip dates */}
              {preferences.skipDays?.length > 0 && (
                <div style={{marginTop:'12px'}}>
                  <p style={{fontSize:'10px',color:'#888',marginBottom:'6px'}}>Skipped dates:</p>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'4px'}}>
                    {preferences.skipDays.map(dateStr => {
                      const [y, m, d] = dateStr.split('-');
                      return (
                        <span key={dateStr} className="cst-bill-skip-chip" style={{cursor:'pointer'}}
                          onClick={() => {
                            const newSkip = preferences.skipDays.filter(d => d !== dateStr);
                            savePreferences({ ...preferences, skipDays: newSkip });
                          }}>
                          {`${d}/${m}`} ✕
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button onClick={()=>showMessage('success','✅ Saved!')} className="cst-btn-magic full" disabled={saving}>
              {saving?'⏳ Saving...':'💾 Save Settings'}
            </button>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (<div className="cst-section"><h3>⚙️ More</h3><button onClick={handleChangePassword} className="cst-setting-magic"><span>🔒</span>Change Password<span>→</span></button><button onClick={()=>setShowFeedback(true)} className="cst-setting-magic"><span>💬</span>Feedback<span>→</span></button><div className="cst-setting-magic"><span>📞</span>9398263810</div><button onClick={handleLogout} className="cst-setting-magic logout"><span>🚪</span>Logout</button></div>)}
      </main>

      <nav className="cst-nav-magic">
        {[{id:'home',icon:'🏪',label:'Shop'},{id:'orders',icon:'🛒',label:'Orders'},{id:'bill',icon:'🧾',label:'Bill'},{id:'history',icon:'📜',label:'History'},{id:'preferences',icon:'🥛',label:'Milk'}].map(item=>(<button key={item.id} className={`cst-nav-item-magic ${activeTab===item.id?'active':''}`} onClick={()=>setActiveTab(item.id)}><span className="cst-nav-icon-magic">{item.icon}</span><span className="cst-nav-label-magic">{item.label}</span>{activeTab===item.id&&<span className="cst-nav-active-dot"></span>}</button>))}
      </nav>
    </div>
  );
};

export default CustomerDashboard;