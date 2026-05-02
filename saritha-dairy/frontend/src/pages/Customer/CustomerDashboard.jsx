// src/pages/Customer/CustomerDashboard.jsx
import React, { useState, useEffect } from 'react';
import './CustomerDashboard.css';

const API_URL = 'http://localhost:5000/api';

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
  
  const [preferences, setPreferences] = useState({
    wantMilk: true,
    skipDays: [],
    quantity: 2,
    packSize: '500ml'
  });

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
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const loadCustomerData = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/customer-deliveries/${userData.id}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setDeliveries(data.deliveries || []);
      }
      
      const savedPrefs = localStorage.getItem(`milkPrefs_${userData.id}`);
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs));
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  const savePreferences = (newPrefs) => {
    setPreferences(newPrefs);
    localStorage.setItem(`milkPrefs_${userData.id}`, JSON.stringify(newPrefs));
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const handleChangePassword = () => {
    window.location.href = '/customer/change-password';
  };

  const submitFeedback = async () => {
    if (feedbackRating === 0) {
      showMessage('error', 'Please select a rating');
      return;
    }
    
    // Save feedback to localStorage
    const feedbacks = JSON.parse(localStorage.getItem(`feedbacks`) || '[]');
    feedbacks.push({
      customerId: userData.id,
      customerName: userData.name,
      rating: feedbackRating,
      text: feedbackText,
      date: new Date().toISOString()
    });
    localStorage.setItem('feedbacks', JSON.stringify(feedbacks));
    
    setFeedbackSubmitted(true);
    showMessage('success', 'Thank you for your feedback! 🎉');
    
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackRating(0);
      setFeedbackText('');
      setFeedbackSubmitted(false);
    }, 2000);
  };

  const totalDeliveries = deliveries.length;
  const today = new Date().toISOString().split('T')[0];
  const todayDelivered = deliveries.filter(d => d.delivery_date?.startsWith(today) && d.status === 'delivered');
  const thisMonth = deliveries.filter(d => {
    const dDate = new Date(d.delivery_date);
    const now = new Date();
    return dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
  });
  const totalSpent = deliveries.reduce((s, d) => s + (parseFloat(d.total_amount) || 0), 0);

  const getTimeOfDay = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return '☀️';
    if (hour < 17) return '🌤️';
    return '🌙';
  };

  const getMoodEmoji = () => {
    if (todayDelivered.length > 0) return '😊';
    if (preferences.wantMilk) return '⏳';
    return '😴';
  };

  if (loading) {
    return (
      <div className="cust-loading">
        <div className="cust-loading-animation">
          <span className="cust-loading-drop">💧</span>
          <span className="cust-loading-glass">🥛</span>
        </div>
        <p>Pouring fresh data...</p>
      </div>
    );
  }

  return (
    <div className="cust-app">
      {/* Toast */}
      {message && (
        <div className={`cust-toast ${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="cust-feedback-overlay" onClick={() => setShowFeedback(false)}>
          <div className="cust-feedback-modal" onClick={e => e.stopPropagation()}>
            {!feedbackSubmitted ? (
              <>
                <div className="cust-feedback-header">
                  <span className="cust-feedback-emoji">💬</span>
                  <h3>How was your experience?</h3>
                  <p>We'd love to hear from you!</p>
                </div>
                
                <div className="cust-stars">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      className={`cust-star ${feedbackRating >= star ? 'active' : ''}`}
                      onClick={() => setFeedbackRating(star)}
                    >
                      {feedbackRating >= star ? '⭐' : '☆'}
                    </button>
                  ))}
                </div>
                <p className="cust-rating-label">
                  {feedbackRating === 0 ? 'Tap to rate' :
                   feedbackRating === 1 ? 'Needs improvement' :
                   feedbackRating === 2 ? 'Could be better' :
                   feedbackRating === 3 ? 'Good' :
                   feedbackRating === 4 ? 'Very good!' :
                   'Excellent! 🎉'}
                </p>

                <textarea
                  className="cust-feedback-input"
                  placeholder="Tell us more about your experience... (optional)"
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  rows={3}
                />

                <div className="cust-feedback-actions">
                  <button onClick={() => setShowFeedback(false)} className="cust-btn-cancel">Cancel</button>
                  <button onClick={submitFeedback} className="cust-btn-submit">Submit Feedback</button>
                </div>
              </>
            ) : (
              <div className="cust-feedback-success">
                <span className="cust-success-emoji">🎉</span>
                <h3>Thank You!</h3>
                <p>Your feedback helps us serve you better!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="cust-header">
        <div className="cust-header-top">
          <div className="cust-user-info" onClick={() => setShowProfile(!showProfile)}>
            <div className="cust-avatar">
              {userData?.name?.charAt(0)?.toUpperCase() || 'C'}
              <span className="cust-online-dot"></span>
            </div>
            <div>
              <h2>{getGreeting()} Good {getTimeOfDay()}, {userData?.name?.split(' ')[0]}!</h2>
              <p>🥛 Saritha Dairy • Customer</p>
            </div>
          </div>
          <button onClick={handleLogout} className="cust-logout-btn">🚪</button>
        </div>

        {/* Profile Details */}
        {showProfile && (
          <div className="cust-profile-popup">
            <div className="cust-profile-row"><span>👤 Name</span><span>{userData?.name}</span></div>
            <div className="cust-profile-row"><span>📱 Phone</span><span>{userData?.phone}</span></div>
            <div className="cust-profile-row"><span>📧 Email</span><span>{userData?.email || 'N/A'}</span></div>
            <div className="cust-profile-row"><span>🏢 Apartment</span><span>{userData?.apartment || 'N/A'}</span></div>
            <div className="cust-profile-row"><span>🚪 Flat No</span><span>{userData?.flat_no || 'N/A'}</span></div>
            <div className="cust-profile-row"><span>📍 Area</span><span>{userData?.area || 'N/A'}</span></div>
            <button onClick={() => setShowProfile(false)} className="cust-close-profile">Close</button>
          </div>
        )}
      </div>

      {/* Today's Mood Card */}
      <div className="cust-mood-card">
        <div className="cust-mood-left">
          <span className="cust-mood-emoji">{getMoodEmoji()}</span>
          <div>
            <h3>
              {todayDelivered.length > 0 
                ? `Milk delivered today! 🎉` 
                : preferences.wantMilk 
                  ? 'Waiting for delivery...' 
                  : 'Milk is paused'}
            </h3>
            <p>
              {todayDelivered.length > 0 
                ? `${todayDelivered.length} packet${todayDelivered.length > 1 ? 's' : ''} delivered` 
                : 'Check your preferences'}
            </p>
          </div>
        </div>
        <button onClick={() => setShowFeedback(true)} className="cust-feedback-trigger">
          💬 Feedback
        </button>
      </div>

      {/* Quick Stats */}
      <div className="cust-stats-row">
        <div className="cust-stat">
          <span className="cust-stat-icon">📦</span>
          <span className="cust-stat-value">{totalDeliveries}</span>
          <span className="cust-stat-label">Total</span>
        </div>
        <div className="cust-stat today">
          <span className="cust-stat-icon">✅</span>
          <span className="cust-stat-value">{todayDelivered.length}</span>
          <span className="cust-stat-label">Today</span>
        </div>
        <div className="cust-stat month">
          <span className="cust-stat-icon">📅</span>
          <span className="cust-stat-value">{thisMonth.length}</span>
          <span className="cust-stat-label">Month</span>
        </div>
        <div className="cust-stat">
          <span className="cust-stat-icon">💰</span>
          <span className="cust-stat-value">₹{totalSpent}</span>
          <span className="cust-stat-label">Spent</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="cust-nav">
        <button className={`cust-nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          <span className="cust-nav-icon">🏠</span>
          <span>Home</span>
        </button>
        <button className={`cust-nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <span className="cust-nav-icon">📜</span>
          <span>History</span>
        </button>
        <button className={`cust-nav-btn ${activeTab === 'preferences' ? 'active' : ''}`} onClick={() => setActiveTab('preferences')}>
          <span className="cust-nav-icon">🥛</span>
          <span>Milk</span>
        </button>
        <button className={`cust-nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <span className="cust-nav-icon">⚙️</span>
          <span>More</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="cust-content">
        {/* Home Tab */}
        {activeTab === 'home' && (
          <>
            <div className="cust-home-banner">
              <div className="cust-home-banner-icon">🥛</div>
              <h3>Fresh Milk, Happy Life</h3>
              <p>Saritha Dairy delivers pure, fresh milk to your doorstep every morning!</p>
            </div>

            <div className="cust-quick-actions">
              <button onClick={() => setActiveTab('preferences')} className="cust-quick-btn">
                <span>🥛</span>
                <span>Milk Settings</span>
              </button>
              <button onClick={() => setShowFeedback(true)} className="cust-quick-btn">
                <span>💬</span>
                <span>Feedback</span>
              </button>
              <button onClick={handleChangePassword} className="cust-quick-btn">
                <span>🔒</span>
                <span>Password</span>
              </button>
              <button onClick={() => setActiveTab('history')} className="cust-quick-btn">
                <span>📜</span>
                <span>History</span>
              </button>
            </div>

            {deliveries.length > 0 && (
              <>
                <h4 className="cust-section-title">Recent Deliveries</h4>
                <div className="cust-recent-list">
                  {deliveries.slice(0, 3).map((d, i) => (
                    <div key={d.id} className="cust-recent-item">
                      <div className="cust-recent-date">
                        {new Date(d.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="cust-recent-info">
                        <span>{d.product_name} ({d.pack_size}) ×{d.quantity}</span>
                        <span className={`cust-recent-status ${d.status}`}>
                          {d.status === 'delivered' ? '✅' : '⏳'}
                        </span>
                      </div>
                      <span className="cust-recent-amount">₹{d.total_amount}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <>
            <h3 className="cust-section-title">📜 Delivery History</h3>
            {deliveries.length === 0 ? (
              <div className="cust-empty">
                <span className="cust-empty-icon">📭</span>
                <h4>No deliveries yet</h4>
                <p>Your delivery history will appear here</p>
              </div>
            ) : (
              <div className="cust-timeline">
                {deliveries.map((d, i) => (
                  <div key={d.id} className="cust-timeline-item">
                    <div className="cust-timeline-dot" style={{ background: d.status === 'delivered' ? '#4caf50' : '#ff9800' }}></div>
                    <div className="cust-timeline-content">
                      <div className="cust-timeline-header">
                        <span className="cust-timeline-date">
                          {new Date(d.delivery_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <span className={`cust-status-badge ${d.status}`}>
                          {d.status === 'delivered' ? '✅ Delivered' : '⏳ Pending'}
                        </span>
                      </div>
                      <div className="cust-timeline-body">
                        <div className="cust-product-info">
                          <span className="cust-product-icon">🥛</span>
                          <div>
                            <p className="cust-product-name">{d.product_name}</p>
                            <p className="cust-product-detail">{d.pack_size} × {d.quantity}</p>
                          </div>
                        </div>
                        <span className="cust-product-price">₹{d.total_amount}</span>
                      </div>
                      {d.delivery_boy_name && (
                        <p className="cust-delivery-boy">🛵 {d.delivery_boy_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <>
            <h3 className="cust-section-title">🥛 Milk Preferences</h3>
            
            <div className="cust-pref-card">
              <div className="cust-pref-header">
                <div>
                  <h4>Daily Milk Delivery</h4>
                  <p>Toggle to pause/resume</p>
                </div>
                <label className="cust-toggle">
                  <input type="checkbox" checked={preferences.wantMilk} onChange={(e) => savePreferences({...preferences, wantMilk: e.target.checked})} />
                  <span className="cust-toggle-slider"></span>
                </label>
              </div>
              {!preferences.wantMilk && (
                <div className="cust-paused-banner">⏸️ Milk delivery is paused</div>
              )}
            </div>

            <div className="cust-pref-card">
              <h4>Quantity per day</h4>
              <div className="cust-quantity-selector">
                {[1, 2, 3, 4, 5].map(qty => (
                  <button key={qty} className={`cust-qty-btn ${preferences.quantity === qty ? 'active' : ''}`} onClick={() => savePreferences({...preferences, quantity: qty})}>{qty}</button>
                ))}
              </div>
            </div>

            <div className="cust-pref-card">
              <h4>Pack Size</h4>
              <div className="cust-size-selector">
                {['250ml', '500ml', '1L'].map(size => (
                  <button key={size} className={`cust-size-btn ${preferences.packSize === size ? 'active' : ''}`} onClick={() => savePreferences({...preferences, packSize: size})}>{size}</button>
                ))}
              </div>
            </div>

            <div className="cust-pref-card">
              <h4>Skip Days</h4>
              <p style={{color: '#888', fontSize: '12px', marginBottom: '10px'}}>Select days to skip delivery</p>
              <div className="cust-days-selector">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <button key={day} className={`cust-day-btn ${preferences.skipDays.includes(day) ? 'active' : ''}`} onClick={() => {
                    const newSkip = preferences.skipDays.includes(day) ? preferences.skipDays.filter(d => d !== day) : [...preferences.skipDays, day];
                    savePreferences({...preferences, skipDays: newSkip});
                  }}>{day}</button>
                ))}
              </div>
              {preferences.skipDays.length > 0 && (
                <p style={{color: '#ef4444', fontSize: '11px', marginTop: '8px'}}>
                  Skipping: {preferences.skipDays.join(', ')}
                </p>
              )}
            </div>

            <button onClick={() => showMessage('success', '✅ Preferences saved!')} className="cust-save-btn">💾 Save Preferences</button>
          </>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <>
            <h3 className="cust-section-title">⚙️ More Options</h3>
            <div className="cust-settings-list">
              <button onClick={handleChangePassword} className="cust-setting-btn">
                <span className="cust-setting-icon">🔒</span>
                <div className="cust-setting-info"><h4>Change Password</h4><p>Update your account password</p></div>
                <span className="cust-setting-arrow">→</span>
              </button>
              <button onClick={() => setShowFeedback(true)} className="cust-setting-btn">
                <span className="cust-setting-icon">💬</span>
                <div className="cust-setting-info"><h4>Send Feedback</h4><p>Rate your experience</p></div>
                <span className="cust-setting-arrow">→</span>
              </button>
              <div className="cust-setting-btn">
                <span className="cust-setting-icon">📞</span>
                <div className="cust-setting-info"><h4>Contact</h4><p>📞 9398263810</p></div>
                <span className="cust-setting-arrow">→</span>
              </div>
              <div className="cust-setting-btn">
                <span className="cust-setting-icon">📍</span>
                <div className="cust-setting-info"><h4>Address</h4><p>{userData?.apartment || 'N/A'}, Flat {userData?.flat_no || 'N/A'}</p></div>
              </div>
              <button onClick={handleLogout} className="cust-logout-danger">🚪 Logout</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerDashboard;