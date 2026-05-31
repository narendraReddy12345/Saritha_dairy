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
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Payment States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('qr');
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({
    bank_name: '',
    account_name: '',
    account_number: '',
    ifsc_code: '',
    upi_id: '',
    qr_code_url: '',
    contact_number: ''
  });
  
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
    if (!userData?.id) { 
      window.location.href = '/login'; 
      return; 
    }
    loadCustomerData();
    fetchAllProducts();
    fetchPaymentData();
    fetchPaymentSettings();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const pulseTimer = setInterval(() => setPulseAnim(p => !p), 3000);
    
    const autoRefreshTimer = setInterval(() => {
      console.log('🔄 Auto-refreshing customer data...');
      syncOrdersWithDeliveries();
    }, 15000);
    
    return () => { 
      clearInterval(timer); 
      clearInterval(pulseTimer);
      clearInterval(autoRefreshTimer);
    };
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setCartCount(extraOrders.filter(o => o.date === today && !o.delivered).length);
  }, [extraOrders]);

  useEffect(() => {
    if (confetti) { const t = setTimeout(() => setConfetti(false), 2000); return () => clearTimeout(t); }
  }, [confetti]);

  // Fetch payment settings
  const fetchPaymentSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/payment-settings`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success && data.settings) {
        setPaymentSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    }
  };

  // Fetch payment data
  const fetchPaymentData = async () => {
    try {
      const response = await fetch(`${API_URL}/customer/payments/${userData.id}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setPaymentHistory(data.payments || []);
        setWalletBalance(data.wallet_balance || 0);
        setPendingPayments(data.pending_payments || []);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  // Submit payment request
  const submitPaymentRequest = async () => {
    if (!paymentAmount || paymentAmount <= 0) {
      showMessage('error', 'Please enter a valid amount');
      return;
    }
    
    if (!paymentScreenshot) {
      showMessage('error', 'Please upload payment screenshot');
      return;
    }
    
    setSaving(true);
    
    try {
      const formData = new FormData();
      formData.append('screenshot', paymentScreenshot);
      formData.append('customer_id', userData.id);
      formData.append('amount', paymentAmount);
      formData.append('payment_method', paymentMethod);
      
      const response = await fetch(`${API_URL}/customer/payment-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });
      
      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Payment request submitted successfully!');
        setShowPaymentModal(false);
        resetPaymentForm();
        fetchPaymentData();
      } else {
        showMessage('error', data.error || 'Failed to submit payment');
      }
    } catch (error) {
      console.error('Error submitting payment:', error);
      showMessage('error', 'Failed to submit payment');
    }
    
    setSaving(false);
  };

  const resetPaymentForm = () => {
    setPaymentAmount('');
    setPaymentScreenshot(null);
    setPaymentScreenshotPreview('');
    setPaymentMethod('qr');
  };

  const handleScreenshotUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showMessage('error', 'File size should be less than 5MB');
        return;
      }
      setPaymentScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentScreenshotPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const syncOrdersWithDeliveries = async () => {
    try {
      console.log('🔄 Syncing orders with deliveries...');
      
      const deliveriesRes = await fetch(`${API_URL}/delivery/customer/${userData.id}`, { 
        headers: getAuthHeaders() 
      });
      const deliveriesData = await deliveriesRes.json();
      
      let deliveriesList = [];
      if (deliveriesData.success) {
        deliveriesList = deliveriesData.deliveries || deliveriesData.data || [];
        setDeliveries(deliveriesList);
      }
      
      const prefRes = await fetch(`${API_URL}/customer-preferences/${userData.id}`, { 
        headers: getAuthHeaders() 
      });
      const prefData = await prefRes.json();
      
      if (prefData.success && prefData.data) {
        let extraOrdersData = prefData.data.extra_orders;
        if (typeof extraOrdersData === 'string') {
          try { extraOrdersData = JSON.parse(extraOrdersData); } catch (e) { extraOrdersData = []; }
        }
        
        const pendingOrders = (Array.isArray(extraOrdersData) ? extraOrdersData : [])
          .map(order => {
            const isDelivered = deliveriesList.some(d => 
              d.delivery_date?.startsWith(order.date) && 
              d.product_name === order.productName && 
              (d.pack_size === order.packSize) &&
              d.status === 'delivered'
            ) || order.delivered === true;
            
            return {
              ...order,
              imageUrl: getImageUrl(order.imageUrl) || order.imageUrl,
              delivered: isDelivered
            };
          })
          .filter(order => !order.delivered);
        
        const removedCount = extraOrders.length - pendingOrders.length;
        if (removedCount > 0) {
          console.log(`✅ Removed ${removedCount} delivered orders from list`);
          showMessage('success', `🎉 ${removedCount} order(s) have been delivered!`);
        }
        
        setExtraOrders(pendingOrders);
      }
    } catch (error) {
      console.error('Error syncing orders:', error);
    }
  };

  const fetchAllProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setAllProducts((data.data || []).map(p => ({
          ...p, 
          packs: typeof p.packs === 'string' ? JSON.parse(p.packs) : (p.packs || []),
          imageUrl: getImageUrl(p.image_url)
        })));
      }
    } catch (e) { 
      console.error('Error fetching products:', e); 
    }
  };

  const loadCustomerData = async () => {
    setLoading(true);
    try {
      const deliveriesRes = await fetch(`${API_URL}/delivery/customer/${userData.id}`, { 
        headers: getAuthHeaders() 
      });
      const deliveriesData = await deliveriesRes.json();
      
      let deliveriesList = [];
      if (deliveriesData.success) {
        deliveriesList = deliveriesData.deliveries || deliveriesData.data || [];
        setDeliveries(deliveriesList);
        console.log('✅ Loaded deliveries:', deliveriesList.length);
      }
      
      const prefRes = await fetch(`${API_URL}/customer-preferences/${userData.id}`, { 
        headers: getAuthHeaders() 
      });
      const prefData = await prefRes.json();
      
      if (prefData.success && prefData.data) {
        let skipDays = prefData.data.skip_days;
        if (typeof skipDays === 'string') {
          try { skipDays = JSON.parse(skipDays); } catch (e) { skipDays = []; }
        }
        
        let extraOrdersData = prefData.data.extra_orders;
        if (typeof extraOrdersData === 'string') {
          try { extraOrdersData = JSON.parse(extraOrdersData); } catch (e) { extraOrdersData = []; }
        }
        
        setPreferences({
          wantMilk: prefData.data.want_milk ?? true,
          quantity: prefData.data.quantity ?? 2,
          packSize: prefData.data.pack_size ?? '500ml',
          skipDays: Array.isArray(skipDays) ? skipDays : []
        });
        
        const ordersWithStatus = (Array.isArray(extraOrdersData) ? extraOrdersData : [])
          .map(order => {
            const isDelivered = deliveriesList.some(d => 
              d.delivery_date?.startsWith(order.date) && 
              d.product_name === order.productName && 
              d.pack_size === order.packSize &&
              d.status === 'delivered'
            ) || order.delivered === true;
            
            return {
              ...order,
              imageUrl: getImageUrl(order.imageUrl) || order.imageUrl,
              delivered: isDelivered
            };
          })
          .filter(order => !order.delivered);
        
        setExtraOrders(ordersWithStatus);
        console.log('✅ Loaded extra orders (pending only):', ordersWithStatus.length);
      }
    } catch (error) { 
      console.error('Error loading customer data:', error);
      showMessage('error', 'Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    showMessage('info', '🔄 Refreshing data...');
    await loadCustomerData();
    await fetchPaymentData();
    showMessage('success', '✅ Data refreshed!');
    setIsRefreshing(false);
  };

  const savePreferences = async (newPrefs) => {
    setPreferences(newPrefs);
    setSaving(true);
    
    try {
      const response = await fetch(`${API_URL}/customer-preferences/${userData.id}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          wantMilk: newPrefs.wantMilk,
          quantity: newPrefs.quantity,
          packSize: newPrefs.packSize,
          skipDays: newPrefs.skipDays,
          extraOrders: extraOrders
        })
      });
      
      const data = await response.json();
      if (data.success) {
        showMessage('success', '✅ Saved to database!');
      } else {
        showMessage('error', 'Failed to save');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      showMessage('error', 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const saveExtraOrders = async (newOrders) => {
    setExtraOrders(newOrders);
    
    try {
      const response = await fetch(`${API_URL}/customer-preferences/${userData.id}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          wantMilk: preferences.wantMilk,
          quantity: preferences.quantity,
          packSize: preferences.packSize,
          skipDays: preferences.skipDays,
          extraOrders: newOrders
        })
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('✅ Extra orders saved');
        showMessage('success', '✅ Order saved!');
      }
    } catch (error) {
      console.error('Error:', error);
      showMessage('error', 'Network error');
    }
  };

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

  const increaseQuantity = () => setOrderQuantity(prev => prev + 1);
  const decreaseQuantity = () => setOrderQuantity(prev => (prev > 1 ? prev - 1 : 1));

  const addProductWithQuantity = async () => {
    if (!selectedProduct || !selectedPackSize) { 
      showMessage('error', 'Select product & size'); 
      return; 
    }
    
    const pack = selectedProduct.packs.find(p => `${p.size}${p.unit}` === selectedPackSize);
    const today = new Date().toISOString().split('T')[0];
    const newOrder = { 
      id: Date.now(), 
      productName: selectedProduct.name, 
      packSize: selectedPackSize, 
      quantity: orderQuantity, 
      price: pack?.price || 0, 
      date: today, 
      imageUrl: selectedProduct.imageUrl, 
      status: 'pending',
      delivered: false 
    };
    
    const updatedOrders = [...extraOrders, newOrder];
    await saveExtraOrders(updatedOrders);
    
    setSelectedProduct(null);
    setSelectedPackSize('');
    setOrderQuantity(1);
    setShowProductModal(false);
    setConfetti(true);
    showMessage('success', '🎉 Added to cart!');
  };

  const removeExtraOrder = async (id) => {
    const updatedOrders = extraOrders.filter(o => o.id !== id);
    await saveExtraOrders(updatedOrders);
    showMessage('success', '✅ Order removed');
  };
  
  const showMessage = (type, text) => { 
    setMessage({ type, text }); 
    setTimeout(() => setMessage(null), 2500); 
  };
  
  const handleLogout = () => { setShowLogoutConfirm(true); };
  const confirmLogout = () => { sessionStorage.clear(); window.location.href = '/login'; };
  const cancelLogout = () => { setShowLogoutConfirm(false); };
  const handleChangePassword = () => { window.location.href = '/customer/change-password'; };

  const submitFeedback = () => {
    if (feedbackRating === 0) { 
      showMessage('error', 'Rate please'); 
      return; 
    }
    const feedbacks = JSON.parse(localStorage.getItem('feedbacks') || '[]');
    feedbacks.push({ 
      customerId: userData.id, 
      customerName: userData.name, 
      rating: feedbackRating, 
      text: feedbackText, 
      date: new Date().toISOString() 
    });
    localStorage.setItem('feedbacks', JSON.stringify(feedbacks));
    setFeedbackSubmitted(true);
    showMessage('success', 'Thanks! 🎉');
    setTimeout(() => { 
      setShowFeedback(false); 
      setFeedbackRating(0); 
      setFeedbackText(''); 
      setFeedbackSubmitted(false); 
    }, 1500);
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
  
  const milkDeliveriesFromDb = deliveries.filter(d => 
    d.product_name === 'Milk' && 
    d.status === 'delivered'
  );
  
  const milkTotal = milkDeliveriesFromDb.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0);
  
  const deliveredExtraOrders = deliveries.filter(d => 
    d.product_name !== 'Milk' && 
    d.status === 'delivered'
  );
  const extraFromDeliveriesTotal = deliveredExtraOrders.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0);
  
  const grandTotal = milkTotal + extraFromDeliveriesTotal;
  
  const todaysMilkDelivery = deliveries.find(d => 
    d.delivery_date?.startsWith(today) && 
    d.product_name === 'Milk' && 
    d.status === 'delivered'
  );
  
  const todaysExtraDeliveries = deliveries.filter(d => 
    d.delivery_date?.startsWith(today) && 
    d.product_name !== 'Milk' && 
    d.status === 'delivered'
  );
  
  const todayDelivered = [...(todaysMilkDelivery ? [todaysMilkDelivery] : []), ...todaysExtraDeliveries];
  
  const getAllDeliveries = () => {
    const milkHistory = milkDeliveriesFromDb.map(d => ({
      id: d.id,
      date: d.delivery_date,
      product_name: d.product_name,
      pack_size: d.pack_size,
      quantity: d.quantity,
      price: d.price,
      total_amount: d.total_amount,
      status: d.status,
      type: 'milk'
    }));
    
    const extraProductHistory = deliveredExtraOrders.map(d => ({
      id: d.id,
      date: d.delivery_date,
      product_name: d.product_name,
      pack_size: d.pack_size,
      quantity: d.quantity,
      price: d.price,
      total_amount: d.total_amount,
      status: d.status,
      type: 'extra'
    }));
    
    return [...milkHistory, ...extraProductHistory]
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const hour = currentTime.getHours();
  const timeEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';
  const timeText = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  if (loading) {
    return (
      <div className="cst-loading-screen">
        <div className="cst-loader-container">
          <div className="cst-loader-ring"></div>
          <div className="cst-loader-center">🥛</div>
        </div>
        <p className="cst-loading-text">Pouring fresh goodness...</p>
      </div>
    );
  }

  return (
    <div className="cst-magic-app">
      {message && (
        <div className={`cst-toast-glass ${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}
      
      {showLogoutConfirm && (
        <div className="cst-modal-overlay" onClick={cancelLogout}>
          <div className="cst-modal-magic" onClick={e => e.stopPropagation()} style={{maxWidth:'320px',margin:'auto',borderRadius:'24px',padding:'24px'}}>
            <div className="cst-modal-handle"></div>
            <div style={{textAlign:'center',padding:'10px 0'}}>
              <span style={{fontSize:'50px',display:'block',marginBottom:'10px'}}>🚪</span>
              <h3 style={{margin:'0 0 6px',fontSize:'18px'}}>Logout?</h3>
              <p style={{color:'#94a3b8',fontSize:'13px',margin:'0 0 20px'}}>Are you sure?</p>
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={cancelLogout} className="cst-btn-ghost" style={{flex:1,padding:'12px',borderRadius:'14px',border:'none',background:'#f3f4f6',fontWeight:'600',cursor:'pointer'}}>Cancel</button>
                <button onClick={confirmLogout} className="cst-btn-magic" style={{flex:1,background:'#ef4444',padding:'12px',borderRadius:'14px',border:'none',color:'white',fontWeight:'700',cursor:'pointer'}}>Logout</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {confetti && (
        <div className="cst-confetti-container">
          {[...Array(20)].map((_, i) => (
            <span key={i} className="cst-confetti-piece" style={{
              left:`${Math.random()*100}%`,
              animationDelay:`${Math.random()*0.5}s`,
              backgroundColor:['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6'][i%5],
              width:`${6+Math.random()*8}px`,
              height:`${6+Math.random()*8}px`
            }}></span>
          ))}
        </div>
      )}
      
      {showProductModal && selectedProduct && (
        <div className="cst-modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="cst-modal-magic" onClick={e => e.stopPropagation()}>
            <div className="cst-modal-handle"></div>
            <div className="cst-modal-hero">
              <div className="cst-modal-hero-img">
                {selectedProduct.imageUrl ? 
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} /> : 
                  <span className="cst-modal-hero-emoji">📷</span>
                }
              </div>
              <div className="cst-modal-hero-info">
                <h2>{selectedProduct.name}</h2>
                <span className="cst-modal-badge">Fresh & Pure</span>
              </div>
            </div>
            <div className="cst-form-group">
              <label>📏 Choose Pack Size</label>
              <div className="cst-chips-glass">
                {selectedProduct.packs.map((p, i) => (
                  <button 
                    key={i} 
                    className={`cst-chip-glass ${selectedPackSize===`${p.size}${p.unit}`?'active':''}`} 
                    onClick={()=>setSelectedPackSize(`${p.size}${p.unit}`)}
                  >
                    <strong>{p.size}{p.unit}</strong>
                    <span>₹{p.price}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {selectedPackSize && (
              <div className="cst-form-group">
                <label>🔢 Quantity</label>
                <div className="cst-qty-simple">
                  <button className="cst-qty-simple-btn" onClick={decreaseQuantity}>−</button>
                  <span className="cst-qty-simple-value">{orderQuantity}</span>
                  <button className="cst-qty-simple-btn" onClick={increaseQuantity}>+</button>
                </div>
              </div>
            )}
            
            <div className="cst-modal-actions">
              <button onClick={()=>setShowProductModal(false)} className="cst-btn-ghost">Cancel</button>
              <button onClick={addProductWithQuantity} className="cst-btn-magic" disabled={!selectedPackSize}>
                ✨ Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showFeedback && (
        <div className="cst-modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="cst-modal-magic" onClick={e => e.stopPropagation()}>
            <div className="cst-modal-handle"></div>
            {!feedbackSubmitted ? (
              <>
                <h3 className="cst-modal-title">💬 Rate Experience</h3>
                <div className="cst-stars-magic">
                  {[1,2,3,4,5].map(s=>(
                    <button key={s} className={`cst-star-magic ${feedbackRating>=s?'active':''}`} onClick={()=>setFeedbackRating(s)}>
                      {feedbackRating>=s?'⭐':'☆'}
                    </button>
                  ))}
                </div>
                <textarea placeholder="Tell us more..." value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} rows={2}/>
                <button onClick={submitFeedback} className="cst-btn-magic full">Submit</button>
              </>
            ) : (
              <div className="cst-thankyou">
                <span>🎉</span>
                <h3>Thank You!</h3>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="cst-header-magic">
        <div className="cst-header-user" onClick={()=>setShowProfile(!showProfile)}>
          <div className="cst-avatar-magic">
            <div className="cst-avatar-core">{userData?.name?.charAt(0)?.toUpperCase()||'C'}</div>
            <div className={`cst-avatar-aura ${pulseAnim?'pulse':''}`}></div>
          </div>
          <div>
            <small className="cst-header-greeting">{timeEmoji} Good {timeText}</small>
            <h2>{userData?.name?.split(' ')[0]||'Customer'}</h2>
          </div>
        </div>
        <div className="cst-header-actions">
          <button className="cst-cart-magic" onClick={()=>setActiveTab('orders')}>
            🛒{cartCount>0&&<span className="cst-cart-dot-magic">{cartCount}</span>}
          </button>
        </div>
      </header>

      {showProfile && (
        <div className="cst-profile-panel">
          <div className="cst-profile-avatar-big">{userData?.name?.charAt(0)?.toUpperCase()}</div>
          <h3>{userData?.name}</h3>
          <p>📱 {userData?.phone}</p>
          <div className="cst-profile-grid-2">
            <span>🏢 {userData?.apartment||'N/A'}</span>
            <span>🚪 {userData?.flat_no||'N/A'}</span>
          </div>
          <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
            <button onClick={handleChangePassword} className="cst-btn-ghost" style={{flex:1,fontSize:'12px'}}>🔒 Password</button>
            <button onClick={handleLogout} className="cst-btn-magic" style={{flex:1,background:'#ef4444',fontSize:'12px'}}>🚪 Logout</button>
          </div>
        </div>
      )}

      <main className="cst-main-scroll">
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <>
            <div className="cst-hero-magic">
              <div className="cst-hero-content-magic">
                <span className="cst-hero-pill">🥛 Fresh Daily</span>
                <h1>Pure Dairy.<br/>Pure Love.</h1>
                <p>Farm fresh products delivered to your doorstep every morning</p>
                <div className="cst-hero-stats">
                  <span>🚀 Free Delivery</span>
                  <span>⭐ 4.8 Rating</span>
                </div>
              </div>
              <div className="cst-hero-visual-magic">
                <span className="cst-hero-float-1">🥛</span>
                <span className="cst-hero-float-2">🧀</span>
              </div>
            </div>
            {todayDelivered.length>0 && (
              <div className="cst-status-strip">
                <span>✅ {todayDelivered.length} item(s) delivered today!</span>
                <button onClick={()=>setShowFeedback(true)}>Rate</button>
              </div>
            )}
            <div className="cst-section-header">
              <div>
                <h3>🛍️ Our Products</h3>
                <p>Tap to add to your cart</p>
              </div>
            </div>
            <div className="cst-magic-grid">
              {allProducts.length===0 ? (
                <div className="cst-empty-magic">
                  <span>📦</span>
                  <p>No products available</p>
                </div>
              ) : (
                allProducts.map((product,i) => {
                  const color=getProductColor(product.name);
                  const minPrice=product.packs.length>0?Math.min(...product.packs.map(p=>parseFloat(p.price)||0)):0;
                  const maxPrice=product.packs.length>0?Math.max(...product.packs.map(p=>parseFloat(p.price)||0)):0;
                  return(
                    <div 
                      key={product.id} 
                      className={`cst-magic-card ${color}`} 
                      style={{animationDelay:`${i*0.05}s`}} 
                      onClick={()=>{
                        setSelectedProduct(product);
                        setSelectedPackSize('');
                        setOrderQuantity(1);
                        setShowProductModal(true);
                      }}
                    >
                      <div className="cst-magic-card-img">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} loading="lazy" onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
                        ) : null}
                        <span className="cst-magic-fallback" style={{display:product.imageUrl?'none':'flex'}}>📷</span>
                        <div className="cst-magic-price">{minPrice===maxPrice?`₹${minPrice}`:`₹${minPrice}-${maxPrice}`}</div>
                        <div className="cst-magic-rating">⭐ 4.8</div>
                      </div>
                      <div className="cst-magic-card-body">
                        <h4>{product.name}</h4>
                        <p>{product.packs.map(p=>`${p.size}${p.unit}`).join(' · ')}</p>
                        <button className="cst-magic-add-btn"><span>+</span> Add</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="cst-section">
            <h3>🛒 Your Extra Orders</h3>
            {extraOrders.length === 0 ? (
              <div className="cst-empty-magic">
                <span>🛒</span>
                <p>No pending orders</p>
                <button onClick={()=>setActiveTab('home')} className="cst-btn-magic">Order Now</button>
              </div>
            ) : (
              <>
                <p className="cst-subtitle">⏳ {extraOrders.length} pending order(s)</p>
                <div className="cst-orders-grid">
                  {extraOrders.map((order) => (
                    <div key={order.id} className="cst-order-grid-card">
                      <div className="cst-order-grid-img">
                        {order.imageUrl ? (
                          <img src={order.imageUrl} alt={order.productName} />
                        ) : (
                          <span className="cst-order-grid-fallback">📦</span>
                        )}
                      </div>
                      <div className="cst-order-grid-info">
                        <h4 className="cst-order-grid-name">{order.productName}</h4>
                        <div className="cst-order-grid-details">
                          <span className="cst-order-grid-size">{order.packSize}</span>
                          <span className="cst-order-grid-qty">× {order.quantity}</span>
                        </div>
                        <div className="cst-order-grid-price-row">
                          <strong className="cst-order-grid-price">₹{order.price * order.quantity}</strong>
                          <button onClick={() => removeExtraOrder(order.id)} className="cst-order-grid-cancel" title="Cancel order">✕</button>
                        </div>
                        <div className="cst-order-grid-date">📅 {new Date(order.date).toLocaleDateString()}</div>
                        <div className="cst-order-status-badge pending">⏳ Pending Delivery</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* BILL TAB WITH PAYMENT */}
        {activeTab === 'bill' && (
          <div className="cst-section">
            <div className="cst-bill-innovative">
              <div className="cst-bill-glass-header">
                <div className="cst-bill-wave"></div>
                <div className="cst-bill-amount-circle">
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6"/>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="6" strokeDasharray={`${(grandTotal/(grandTotal||1))*264} 264`} strokeLinecap="round" transform="rotate(-90 50 50)"/>
                  </svg>
                  <div className="cst-bill-amount-inner">
                    <span className="cst-bill-total-label">Payable</span>
                    <strong className="cst-bill-total-amount">₹{(grandTotal - walletBalance).toLocaleString()}</strong>
                  </div>
                </div>
              </div>
              
              {/* Wallet Balance */}
              <div className="cst-wallet-card">
                <div className="cst-wallet-icon">💰</div>
                <div className="cst-wallet-info">
                  <span>Wallet Balance</span>
                  <strong>₹{walletBalance.toLocaleString()}</strong>
                </div>
                <button className="cst-wallet-history-btn" onClick={() => setShowPaymentHistory(true)}>📜 History</button>
              </div>
              
              <div className="cst-bill-details">
                <div className="cst-bill-detail-card milk">
                  <div className="cst-bill-card-icon">🥛</div>
                  <div className="cst-bill-card-info">
                    <h4>Daily Milk</h4>
                    <p>{preferences.quantity || 2} × {preferences.packSize || '500ml'} • <strong>{milkDeliveriesFromDb.length} deliveries</strong></p>
                    <span className="cst-bill-card-status">{preferences.wantMilk ? '🟢 Active' : '🔴 Paused'}</span>
                  </div>
                  <strong className="cst-bill-card-amount">₹{milkTotal.toLocaleString()}</strong>
                </div>
                
                <div className="cst-bill-detail-card extra">
                  <div className="cst-bill-card-icon">📦</div>
                  <div className="cst-bill-card-info">
                    <h4>Extra Products</h4>
                    <p><strong>{deliveredExtraOrders.length} items delivered</strong></p>
                    <div className="cst-bill-product-list">
                      {deliveredExtraOrders.map((product, idx) => (
                        <div key={`extra-delivery-${idx}`} className="cst-bill-product-item">
                          <span className="product-name">{product.product_name}</span>
                          <span className="product-details">{product.pack_size} × {product.quantity}</span>
                          <span className="product-price">₹{product.total_amount}</span>
                        </div>
                      ))}
                      {deliveredExtraOrders.length === 0 && (
                        <div className="cst-bill-no-products">No extra products delivered yet</div>
                      )}
                    </div>
                  </div>
                  <strong className="cst-bill-card-amount">₹{extraFromDeliveriesTotal.toLocaleString()}</strong>
                </div>
              </div>
              
              <div className="cst-bill-total-bar">
                <div className="cst-bill-total-bar-row">
                  <span>🥛 Milk Charges</span>
                  <span>₹{milkTotal.toLocaleString()}</span>
                </div>
                <div className="cst-bill-total-bar-row">
                  <span>📦 Extra Products</span>
                  <span>₹{extraFromDeliveriesTotal.toLocaleString()}</span>
                </div>
                <div className="cst-bill-total-bar-divider"></div>
                <div className="cst-bill-total-bar-row">
                  <span>Total Bill</span>
                  <strong>₹{grandTotal.toLocaleString()}</strong>
                </div>
                {walletBalance > 0 && (
                  <div className="cst-bill-total-bar-row">
                    <span>💰 Wallet Credit</span>
                    <span>- ₹{walletBalance.toLocaleString()}</span>
                  </div>
                )}
                <div className="cst-bill-total-bar-row grand">
                  <span>Amount to Pay</span>
                  <strong>₹{(grandTotal - walletBalance).toLocaleString()}</strong>
                </div>
              </div>
              
              {(grandTotal - walletBalance) > 0 && (
                <button className="cst-pay-now-btn" onClick={() => setShowPaymentModal(true)}>💳 Pay Now</button>
              )}
              
              {walletBalance > 0 && (
                <div className="cst-wallet-notice">🎉 You have ₹{walletBalance} credit in your wallet!</div>
              )}
              
              <div className="cst-bill-thankyou">
                <span>🥛</span>
                <p>Pure by Nature, Trusted by Families</p>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="cst-section">
            <h3>📜 Delivery History</h3>
            {getAllDeliveries().length === 0 ? (
              <div className="cst-empty-magic">
                <span>📭</span>
                <p>No deliveries yet</p>
              </div>
            ) : (
              getAllDeliveries().map((delivery, index) => (
                <div key={`${delivery.id}-${index}`} className="cst-history-magic">
                  <div className={`cst-history-dot-magic ${delivery.status}`}></div>
                  <div className="cst-history-content-magic">
                    <span className="cst-history-date">
                      {new Date(delivery.date).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    <div className="cst-history-product">
                      <span className="cst-history-product-icon">{delivery.type === 'extra' ? '🛒' : '🥛'}</span>
                      <span className="cst-history-product-name">{delivery.product_name}</span>
                      <span className="cst-history-product-details">{delivery.pack_size} × {delivery.quantity}</span>
                    </div>
                    <div className="cst-history-row-magic">
                      <span className={`cst-badge-magic ${delivery.status}`}>
                        {delivery.status === 'delivered' ? '✅ Delivered' : '⏳ Pending'}
                      </span>
                      <strong className="cst-history-amount">
                        ₹{parseFloat(delivery.total_amount || delivery.price * delivery.quantity).toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PREFERENCES TAB */}
        {activeTab === 'preferences' && (
          <div className="cst-section">
            <h3>🥛 Milk Settings</h3>
            
            <div className="cst-pref-magic">
              <span>Daily Delivery</span>
              <label className="cst-toggle-magic">
                <input type="checkbox" checked={preferences.wantMilk} onChange={e=>savePreferences({...preferences,wantMilk:e.target.checked})}/>
                <span></span>
              </label>
            </div>
            {!preferences.wantMilk && <p style={{color:'#ef4444',fontSize:'11px',textAlign:'center',marginTop:'8px'}}>⏸️ Milk delivery is paused</p>}

            <div className="cst-pref-magic">
              <p>Quantity per day</p>
              <div className="cst-chips-glass">
                {[1,2,3,4,5].map(q=>(
                  <button key={q} className={`cst-chip-glass ${preferences.quantity===q?'active':''}`} onClick={()=>savePreferences({...preferences,quantity:q})}>
                    {q} pkt
                  </button>
                ))}
              </div>
            </div>

            <div className="cst-pref-magic">
              <p>Pack Size</p>
              <div className="cst-chips-glass">
                {['500ml','1L'].map(s=>(
                  <button key={s} className={`cst-chip-glass ${preferences.packSize===s?'active':''}`} onClick={()=>savePreferences({...preferences,packSize:s})}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

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
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <span key={d} className="cst-calendar-day-header">{d}</span>
                  ))}
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
            </div>

            <button onClick={()=>savePreferences(preferences)} className="cst-btn-magic full" disabled={saving}>
              {saving?'⏳ Saving...':'💾 Save Settings'}
            </button>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="cst-section">
            <h3>⚙️ More</h3>
            <button onClick={handleChangePassword} className="cst-setting-magic">
              <span>🔒</span>Change Password<span>→</span>
            </button>
            <button onClick={()=>setShowFeedback(true)} className="cst-setting-magic">
              <span>💬</span>Feedback<span>→</span>
            </button>
            <div className="cst-setting-magic">
              <span>📞</span>9398263810
            </div>
            <button onClick={handleLogout} className="cst-setting-magic logout">
              <span>🚪</span>Logout
            </button>
          </div>
        )}
      </main>

      <nav className="cst-nav-magic">
        {[
          {id:'home', icon:'🏪', label:'Shop'},
          {id:'orders', icon:'🛒', label:'Orders'},
          {id:'bill', icon:'🧾', label:'Bill'},
          {id:'history', icon:'📜', label:'History'},
          {id:'preferences', icon:'🥛', label:'Milk'},
          {id:'settings', icon:'⚙️', label:'More'},
        ].map(item => (
          <button 
            key={item.id} 
            className={`cst-nav-item-magic ${activeTab===item.id?'active':''}`} 
            onClick={()=>setActiveTab(item.id)}
          >
            <span className="cst-nav-icon-magic">{item.icon}</span>
            <span className="cst-nav-label-magic">{item.label}</span>
            {activeTab===item.id && <span className="cst-nav-active-dot"></span>}
          </button>
        ))}
      </nav>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="cst-modal-overlay" onClick={() => !saving && setShowPaymentModal(false)}>
          <div className="cst-payment-modal" onClick={e => e.stopPropagation()}>
            <div className="cst-payment-header">
              <h3>💳 Make Payment</h3>
              <button className="cst-modal-close" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>
            
            <div className="cst-payment-body">
              <div className="cst-payment-amount">
                <label>Amount to Pay</label>
                <div className="cst-amount-input">
                  <span>₹</span>
                  <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Enter amount" min="1" max={grandTotal - walletBalance} />
                </div>
                <small>Maximum: ₹{(grandTotal - walletBalance).toLocaleString()}</small>
              </div>
              
              <div className="cst-payment-method">
                <label>Payment Method</label>
                <div className="cst-method-options">
                  <button className={`cst-method-btn ${paymentMethod === 'qr' ? 'active' : ''}`} onClick={() => setPaymentMethod('qr')}>📱 QR Code</button>
                  <button className={`cst-method-btn ${paymentMethod === 'bank' ? 'active' : ''}`} onClick={() => setPaymentMethod('bank')}>🏦 Bank Transfer</button>
                  <button className={`cst-method-btn ${paymentMethod === 'upi' ? 'active' : ''}`} onClick={() => setPaymentMethod('upi')}>📲 UPI</button>
                </div>
              </div>
              
              <div className="cst-qr-section">
                <div className="cst-qr-code">
                  {paymentSettings.qr_code_url ? (
                    <img src={paymentSettings.qr_code_url} alt="QR Code" />
                  ) : (
                    <div className="cst-placeholder-qr">📱 QR Code</div>
                  )}
                  <p>Scan to Pay</p>
                </div>
                <div className="cst-bank-details">
                  <h4>Bank Details</h4>
                  <p><strong>Bank:</strong> {paymentSettings.bank_name || 'XYZ Bank'}</p>
                  <p><strong>Account Name:</strong> {paymentSettings.account_name || 'Saritha Dairy'}</p>
                  <p><strong>Account No:</strong> {paymentSettings.account_number || 'XXXXXXXXXXXXXX'}</p>
                  <p><strong>IFSC:</strong> {paymentSettings.ifsc_code || 'XYZB0001234'}</p>
                  <p><strong>UPI ID:</strong> {paymentSettings.upi_id || 'sarithadairy@okhdfcbank'}</p>
                  <p><strong>Contact:</strong> {paymentSettings.contact_number || '9398263810'}</p>
                </div>
              </div>
              
              <div className="cst-screenshot-upload">
                <label>Upload Payment Screenshot *</label>
                <div className="cst-upload-area">
                  {paymentScreenshotPreview ? (
                    <div className="cst-preview">
                      <img src={paymentScreenshotPreview} alt="Preview" />
                      <button onClick={() => { setPaymentScreenshot(null); setPaymentScreenshotPreview(''); }}>Remove</button>
                    </div>
                  ) : (
                    <label className="cst-upload-label">
                      <span>📸</span>
                      <span>Click to upload screenshot</span>
                      <input type="file" accept="image/*" onChange={handleScreenshotUpload} style={{display: 'none'}} />
                    </label>
                  )}
                </div>
                <small>Upload screenshot of payment confirmation</small>
              </div>
              
              <div className="cst-payment-footer">
                <button className="cst-btn-cancel" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button className="cst-btn-submit" onClick={submitPaymentRequest} disabled={saving || !paymentAmount || !paymentScreenshot}>
                  {saving ? 'Submitting...' : 'Submit Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {showPaymentHistory && (
        <div className="cst-modal-overlay" onClick={() => setShowPaymentHistory(false)}>
          <div className="cst-history-modal" onClick={e => e.stopPropagation()}>
            <div className="cst-payment-header">
              <h3>📜 Payment History</h3>
              <button className="cst-modal-close" onClick={() => setShowPaymentHistory(false)}>×</button>
            </div>
            
            <div className="cst-payment-history-list">
              {paymentHistory.length === 0 ? (
                <div className="cst-empty-history">
                  <span>📭</span>
                  <p>No payment history found</p>
                </div>
              ) : (
                paymentHistory.map((payment, idx) => (
                  <div key={idx} className={`cst-history-item ${payment.status}`}>
                    <div className="cst-history-left">
                      <span className="cst-history-date">{new Date(payment.created_at).toLocaleDateString()}</span>
                      <span className="cst-history-amount">₹{payment.amount}</span>
                    </div>
                    <div className="cst-history-right">
                      <span className={`cst-history-status ${payment.status}`}>
                        {payment.status === 'approved' ? '✅ Approved' : payment.status === 'pending' ? '⏳ Pending' : '❌ Rejected'}
                      </span>
                      {payment.status === 'approved' && <span className="cst-history-credit">+₹{payment.amount} credited</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;