// src/pages/Customer/CustomerDashboard.jsx
import React, { useState, useEffect } from 'react';
import './CustomerDashboard.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';
const BASE_URL = 'https://saritha-dairy-api.onrender.com';

// ✅ Helper function to get correct image URL (same as Sales page)
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
  
  const [preferences, setPreferences] = useState({
    wantMilk: true, skipDays: [], quantity: 2, packSize: '500ml'
  });

  const [extraOrders, setExtraOrders] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedPackSize, setSelectedPackSize] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);

  const [viewMode, setViewMode] = useState('grid');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickView, setShowQuickView] = useState(null);

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

  // ✅ FIXED: Same image logic as Sales page
  const fetchAllProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        const productsWithPacks = (data.data || []).map(p => {
          let packs = [];
          try {
            packs = typeof p.packs === 'string' ? JSON.parse(p.packs) : (p.packs || []);
          } catch (e) { packs = []; }
          
          return { 
            ...p, 
            packs, 
            imageUrl: getImageUrl(p.image_url) // ✅ Use same helper
          };
        });
        setAllProducts(productsWithPacks);
      }
    } catch (e) { console.error('Error fetching products:', e); }
  };

  const loadCustomerData = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/customer-deliveries/${userData.id}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setDeliveries(data.deliveries || []);
      
      try {
        const prefRes = await fetch(`${API_URL}/customer-preferences/${userData.id}`, { headers: getAuthHeaders() });
        const prefData = await prefRes.json();
        if (prefData.success && prefData.data) {
          setPreferences({
            wantMilk: prefData.data.want_milk ?? true,
            quantity: prefData.data.quantity ?? 2,
            packSize: prefData.data.pack_size ?? '500ml',
            skipDays: typeof prefData.data.skip_days === 'string' ? JSON.parse(prefData.data.skip_days) : (prefData.data.skip_days || [])
          });
          if (prefData.data.extra_orders) {
            setExtraOrders(typeof prefData.data.extra_orders === 'string' ? JSON.parse(prefData.data.extra_orders) : prefData.data.extra_orders);
          }
        }
      } catch (e) {
        const savedPrefs = localStorage.getItem(`milkPrefs_${userData.id}`);
        if (savedPrefs) setPreferences(JSON.parse(savedPrefs));
        const savedOrders = localStorage.getItem(`extraOrders_${userData.id}`);
        if (savedOrders) setExtraOrders(JSON.parse(savedOrders));
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
    } catch (error) {}
    setSaving(false);
    showMessage('success', '✅ Saved!');
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

  const addProductWithQuantity = () => {
    if (!selectedProduct || !selectedPackSize) { showMessage('error', 'Select product & pack size'); return; }
    const pack = selectedProduct.packs.find(p => `${p.size}${p.unit}` === selectedPackSize);
    const today = new Date().toISOString().split('T')[0];
    const newOrder = { 
      id: Date.now(), 
      productName: selectedProduct.name, 
      packSize: selectedPackSize, 
      quantity: orderQuantity, 
      price: pack?.price || 0, 
      date: today, 
      imageUrl: selectedProduct.imageUrl // ✅ Already fixed by getImageUrl
    };
    saveExtraOrders([...extraOrders, newOrder]);
    setSelectedProduct(null); setSelectedPackSize(''); setOrderQuantity(1); setShowProductModal(false);
    showMessage('success', '✅ Added!');
  };

  const removeExtraOrder = (id) => { saveExtraOrders(extraOrders.filter(o => o.id !== id)); };
  const showMessage = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage(null), 2500); };
  const handleLogout = () => { sessionStorage.clear(); window.location.href = '/login'; };
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

  const categories = ['all', 'Milk', 'Curd', 'Paneer', 'Ghee', 'Butter', 'Other'];

  const filteredProducts = allProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedCategory === 'all') return matchesSearch;
    const n = p.name.toLowerCase();
    if (selectedCategory === 'Milk' && n.includes('milk')) return matchesSearch;
    if (selectedCategory === 'Curd' && n.includes('curd')) return matchesSearch;
    if (selectedCategory === 'Paneer' && n.includes('paneer')) return matchesSearch;
    if (selectedCategory === 'Ghee' && n.includes('ghee')) return matchesSearch;
    if (selectedCategory === 'Butter' && n.includes('butter')) return matchesSearch;
    return selectedCategory === 'Other' && !['milk','curd','paneer','ghee','butter'].some(k => n.includes(k)) && matchesSearch;
  });

  const today = new Date().toISOString().split('T')[0];
  const todayDelivered = deliveries.filter(d => d.delivery_date?.startsWith(today) && d.status === 'delivered');
  const hour = currentTime.getHours();
  const timeEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';
  const timeText = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  if (loading) {
    return (
      <div className="cst-loading-screen">
        <div className="cst-loader">
          <div className="cst-milk-drop">💧</div>
          <div className="cst-milk-glass">🥛</div>
        </div>
        <p>Loading fresh products...</p>
      </div>
    );
  }

  return (
    <div className="cst-app-container">
      {/* Toast */}
      {message && (
        <div className={`cst-toast ${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && selectedProduct && (
        <div className="cst-modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="cst-modal-slide" onClick={e => e.stopPropagation()}>
            <div className="cst-modal-bar"></div>
            <div className="cst-modal-product-header">
              <div className="cst-modal-img-wrap">
                {selectedProduct.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} />
                ) : (
                  <span>📷</span>
                )}
              </div>
              <div>
                <h3>{selectedProduct.name}</h3>
                <p>Fresh & Pure</p>
              </div>
            </div>
            <div className="cst-form-group">
              <label>Pack Size</label>
              <div className="cst-chips">
                {selectedProduct.packs.map((p, i) => (
                  <button key={i} className={`cst-chip ${selectedPackSize === `${p.size}${p.unit}` ? 'active' : ''}`}
                    onClick={() => setSelectedPackSize(`${p.size}${p.unit}`)}>{p.size}{p.unit} ₹{p.price}</button>
                ))}
              </div>
            </div>
            {selectedPackSize && (
              <div className="cst-form-group">
                <label>Quantity</label>
                <div className="cst-chips">
                  {[1,2,3,4,5].map(q => <button key={q} className={`cst-chip ${orderQuantity === q ? 'active' : ''}`} onClick={() => setOrderQuantity(q)}>{q}</button>)}
                </div>
              </div>
            )}
            <div className="cst-modal-btns">
              <button onClick={() => setShowProductModal(false)} className="cst-btn-outline">Cancel</button>
              <button onClick={addProductWithQuantity} className="cst-btn-fill" disabled={!selectedPackSize}>🛒 Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      {showQuickView && (
        <div className="cst-quickview-overlay" onClick={() => setShowQuickView(null)}>
          <div className="cst-quickview-card" onClick={e => e.stopPropagation()}>
            <button className="cst-qv-close" onClick={() => setShowQuickView(null)}>×</button>
            <div className="cst-qv-image">
              {showQuickView.imageUrl ? (
                <img src={showQuickView.imageUrl} alt={showQuickView.name} />
              ) : (
                <span>📷</span>
              )}
            </div>
            <h3>{showQuickView.name}</h3>
            <div className="cst-qv-packs">
              {showQuickView.packs.map((p, i) => (
                <span key={i} className="cst-qv-pack">{p.size}{p.unit} - ₹{p.price}</span>
              ))}
            </div>
            <button className="cst-btn-fill" onClick={() => {
              setShowQuickView(null);
              setSelectedProduct(showQuickView);
              setSelectedPackSize('');
              setOrderQuantity(1);
              setShowProductModal(true);
            }}>🛒 Order Now</button>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="cst-modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="cst-modal-slide" onClick={e => e.stopPropagation()}>
            <div className="cst-modal-bar"></div>
            {!feedbackSubmitted ? (
              <>
                <h3>💬 Rate Experience</h3>
                <div className="cst-stars-row">
                  {[1,2,3,4,5].map(s => <button key={s} className={`cst-star-btn ${feedbackRating >= s ? 'active' : ''}`} onClick={() => setFeedbackRating(s)}>{feedbackRating >= s ? '⭐' : '☆'}</button>)}
                </div>
                <textarea placeholder="Tell us more..." value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={2} />
                <button onClick={submitFeedback} className="cst-btn-fill full">Submit</button>
              </>
            ) : (
              <div className="cst-success-msg"><span>🎉</span><h3>Thank You!</h3></div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="cst-main-header">
        <div className="cst-header-left" onClick={() => setShowProfile(!showProfile)}>
          <div className="cst-avatar-wrap">
            <div className="cst-avatar">{userData?.name?.charAt(0)?.toUpperCase() || 'C'}</div>
            <div className={`cst-avatar-glow ${pulseAnim ? 'active' : ''}`}></div>
          </div>
          <div>
            <small>{timeEmoji} Good {timeText}</small>
            <h2>{userData?.name?.split(' ')[0] || 'Customer'}</h2>
          </div>
        </div>
        <div className="cst-header-actions">
          <button className="cst-cart-icon" onClick={() => setActiveTab('orders')}>
            🛒{cartCount > 0 && <span className="cst-cart-dot">{cartCount}</span>}
          </button>
        </div>
      </header>

      {/* Profile Dropdown */}
      {showProfile && (
        <div className="cst-profile-drop">
          <div className="cst-profile-avatar-lg">{userData?.name?.charAt(0)?.toUpperCase()}</div>
          <h3>{userData?.name}</h3>
          <p>📱 {userData?.phone}</p>
          <div className="cst-profile-meta">
            <span>🏢 {userData?.apartment || 'N/A'}</span>
            <span>🚪 {userData?.flat_no || 'N/A'}</span>
          </div>
          <button onClick={() => setShowProfile(false)} className="cst-btn-outline">Close</button>
        </div>
      )}

      {/* Main Content */}
      <main className="cst-main-content">
        {/* ==================== HOME / SHOP TAB ==================== */}
        {activeTab === 'home' && (
          <>
            {/* Hero Card */}
            <div className="cst-hero">
              <div className="cst-hero-text">
                <span className="cst-hero-tag">🥛 Fresh Daily</span>
                <h2>Pure Dairy</h2>
                <p>Delivered to your doorstep</p>
              </div>
              <div className="cst-hero-visual">
                <span>🥛</span><span>🧀</span><span>🫕</span>
              </div>
            </div>

            {/* Today's Status */}
            {todayDelivered.length > 0 && (
              <div className="cst-today-status">
                <span>✅</span>
                <span>Milk delivered today! ({todayDelivered.length} packet)</span>
                <button onClick={() => setShowFeedback(true)}>⭐ Rate</button>
              </div>
            )}

            {/* Search & View Toggle */}
            <div className="cst-toolbar">
              <div className="cst-search-wrap">
                <span>🔍</span>
                <input placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {searchQuery && <button onClick={() => setSearchQuery('')}>×</button>}
              </div>
              <div className="cst-view-toggles">
                <button className={`cst-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>⊞</button>
                <button className={`cst-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>☰</button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="cst-categories">
              {categories.map(cat => (
                <button key={cat} className={`cst-cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}>{cat === 'all' ? 'All' : cat}</button>
              ))}
            </div>

            {/* ==================== GRID VIEW ==================== */}
            {viewMode === 'grid' && (
              <div className="cst-product-grid">
                {filteredProducts.length === 0 ? (
                  <div className="cst-empty-state"><span>📦</span><p>No products found</p></div>
                ) : (
                  filteredProducts.map((product, i) => {
                    const color = getProductColor(product.name);
                    const minPrice = product.packs.length > 0 ? Math.min(...product.packs.map(p => parseFloat(p.price)||0)) : 0;
                    
                    return (
                      <div key={product.id} className={`cst-prod-card ${color}`} style={{animationDelay:`${i*0.04}s`}}
                        onClick={() => {
                          setSelectedProduct(product);
                          setSelectedPackSize('');
                          setOrderQuantity(1);
                          setShowProductModal(true);
                        }}>
                        <div className="cst-prod-img">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} loading="lazy"
                              onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                          ) : null}
                          <span className="cst-prod-fallback" style={{display: product.imageUrl ? 'none' : 'flex'}}>📷</span>
                          <button className="cst-prod-quickview" onClick={e => { e.stopPropagation(); setShowQuickView(product); }}>👁</button>
                        </div>
                        <div className="cst-prod-body">
                          <h4>{product.name}</h4>
                          <p className="cst-prod-sizes">{product.packs.map(p => `${p.size}${p.unit}`).join(' · ')}</p>
                          <div className="cst-prod-footer">
                            <span className="cst-prod-price">From ₹{minPrice}</span>
                            <button className="cst-prod-add">+</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ==================== LIST VIEW ==================== */}
            {viewMode === 'list' && (
              <div className="cst-product-list">
                {filteredProducts.length === 0 ? (
                  <div className="cst-empty-state"><span>📦</span><p>No products</p></div>
                ) : (
                  filteredProducts.map((product, i) => {
                    const minPrice = product.packs.length > 0 ? Math.min(...product.packs.map(p => parseFloat(p.price)||0)) : 0;
                    
                    return (
                      <div key={product.id} className="cst-list-card" style={{animationDelay:`${i*0.03}s`}}
                        onClick={() => { setSelectedProduct(product); setSelectedPackSize(''); setOrderQuantity(1); setShowProductModal(true); }}>
                        <div className="cst-list-img">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                          ) : null}
                          <span style={{display: product.imageUrl ? 'none' : 'flex'}}>📷</span>
                        </div>
                        <div className="cst-list-info">
                          <h4>{product.name}</h4>
                          <p>{product.packs.map(p => `${p.size}${p.unit} ₹${p.price}`).join(' · ')}</p>
                          <span className="cst-list-price">From ₹{minPrice}</span>
                        </div>
                        <span className="cst-list-arrow">→</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

        {/* ==================== ORDERS TAB ==================== */}
        {activeTab === 'orders' && (
          <div className="cst-section">
            <h3>🛒 Your Orders</h3>
            {extraOrders.length === 0 ? (
              <div className="cst-empty-state">
                <span>🛒</span><p>No orders yet</p>
                <button onClick={() => setActiveTab('home')} className="cst-btn-fill">Browse Products</button>
              </div>
            ) : (
              <>
                {extraOrders.filter(o => o.date === today).length > 0 && (
                  <>
                    <p className="cst-section-sub">Today</p>
                    {extraOrders.filter(o => o.date === today).map(o => (
                      <div key={o.id} className="cst-order-item">
                        <div className="cst-order-img">
                          {o.imageUrl ? <img src={o.imageUrl} alt={o.productName} /> : <span>📦</span>}
                        </div>
                        <div className="cst-order-info">
                          <h5>{o.productName}</h5>
                          <p>{o.packSize} × {o.quantity}</p>
                        </div>
                        <strong>₹{o.price * o.quantity}</strong>
                        <button onClick={() => removeExtraOrder(o.id)} className="cst-order-remove">×</button>
                      </div>
                    ))}
                  </>
                )}
                {extraOrders.filter(o => o.date !== today).length > 0 && (
                  <>
                    <p className="cst-section-sub">Previous</p>
                    {extraOrders.filter(o => o.date !== today).map(o => (
                      <div key={o.id} className="cst-order-item past">
                        <span>{o.productName} ({o.packSize}) ×{o.quantity}</span>
                        <span>{new Date(o.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
                        <strong>₹{o.price * o.quantity}</strong>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* History, Preferences, Settings tabs - KEEP EXISTING CODE */}
        {/* ... same as before ... */}
      </main>

      {/* Bottom Navigation */}
      <nav className="cst-bottom-nav">
        {[
          { id: 'home', icon: '🏪', label: 'Shop' },
          { id: 'orders', icon: '🛒', label: 'Orders' },
          { id: 'history', icon: '📜', label: 'History' },
          { id: 'preferences', icon: '🥛', label: 'Milk' },
        ].map(item => (
          <button key={item.id} className={`cst-nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
            <span className="cst-nav-icon">{item.icon}</span>
            <span className="cst-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default CustomerDashboard;