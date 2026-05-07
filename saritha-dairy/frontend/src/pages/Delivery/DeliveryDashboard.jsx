// src/pages/Delivery/DeliveryDashboard.jsx

import React, { useState, useEffect } from 'react';
import './DeliveryDashboard.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const DeliveryDashboard = () => {

  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayStats, setTodayStats] = useState({
    deliveries: 0,
    collected: 0,
    pending: 0
  });

  const [deliveringId, setDeliveringId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [expandedApt, setExpandedApt] = useState(null);

  const getUserData = () => {
    try {
      return JSON.parse(
        sessionStorage.getItem('userData')
      );
    } catch {
      return null;
    }
  };

  const getToken = () =>
    sessionStorage.getItem('authToken');

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`
  });

  const userData = getUserData();

  useEffect(() => {

    if (!userData?.id) {
      window.location.href = '/login';
      return;
    }

    loadCustomers();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);

  }, []);

  const loadCustomers = async () => {

    setLoading(true);

    try {

      const res = await fetch(
        `${API_URL}/delivery-boys/${userData.id}/customers`,
        {
          headers: getAuthHeaders()
        }
      );

      const data = await res.json();

      if (data.success) {

        const customersData = data.data || [];

        setCustomers(customersData);

        setTodayStats({
          deliveries: customersData.filter(
            c => c.delivered
          ).length,

          collected: customersData
            .filter(c => c.delivered)
            .reduce(
              (sum, c) =>
                sum +
                (parseFloat(
                  c.deliveryData?.total_amount
                ) || 0),
              0
            ),

          pending: customersData.filter(
            c => !c.delivered
          ).length
        });
      }

    } catch (e) {

      showMessage(
        'error',
        'Failed to load customers'
      );

    }

    setLoading(false);
  };

  const showMessage = (type, text) => {

    setMessage({ type, text });

    setTimeout(() => {
      setMessage(null);
    }, 2500);
  };

  const markDelivered = async (customerId) => {

    if (deliveringId) return;

    setDeliveringId(customerId);

    setCustomers(prev =>
      prev.map(c =>
        c.id === customerId
          ? { ...c, delivered: true }
          : c
      )
    );

    setTodayStats(prev => ({
      ...prev,
      deliveries: prev.deliveries + 1,
      pending: prev.pending - 1
    }));

    setDeliveringId(null);

    showMessage(
      'success',
      '✅ Delivery completed'
    );
  };

  const undoDelivery = (customerId) => {

    setCustomers(prev =>
      prev.map(c =>
        c.id === customerId
          ? { ...c, delivered: false }
          : c
      )
    );

    setTodayStats(prev => ({
      ...prev,
      deliveries: prev.deliveries - 1,
      pending: prev.pending + 1
    }));

    showMessage(
      'success',
      '↩ Delivery undone'
    );
  };

  const handleLogout = () => {

    sessionStorage.clear();

    window.location.href = '/login';
  };

  const getGreeting = () => {

    const hour = currentTime.getHours();

    if (hour < 12) {
      return {
        text: 'Good Morning',
        icon: '🌅'
      };
    }

    if (hour < 17) {
      return {
        text: 'Good Afternoon',
        icon: '☀️'
      };
    }

    return {
      text: 'Good Evening',
      icon: '🌙'
    };
  };

  const greeting = getGreeting();

  const filteredCustomers = customers.filter(
    c =>
      (c.name || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||

      (c.phone || '')
        .includes(searchTerm)
  );

  const pendingCustomers =
    filteredCustomers.filter(
      c => !c.delivered
    );

  const completedCustomers =
    filteredCustomers.filter(
      c => c.delivered
    );

  if (loading) {

    return (

      <div className="dd-load">

        <div className="dd-load-scooter">
          🛵
        </div>

        <p>Loading deliveries...</p>

      </div>
    );
  }

  return (

    <div className="dd-app">

      {/* TOAST */}

      {message && (

        <div className="dd-toast">

          <span>{message.text}</span>

          <button
            onClick={() => setMessage(null)}
          >
            ×
          </button>

        </div>

      )}

      {/* HEADER */}

      <header className="dd-hdr">

        <div
          className="dd-hdr-user"
          onClick={() =>
            setShowProfile(!showProfile)
          }
        >

          <div className="dd-hdr-avatar-ring">

            <div className="dd-hdr-avatar">

              {userData?.name
                ?.charAt(0)
                ?.toUpperCase() || 'D'}

            </div>

            <div className="dd-hdr-pulse"></div>

          </div>

          <div>

            <small>
              {greeting.icon} {greeting.text}
            </small>

            <h2>
              {userData?.name ||
                'Delivery Partner'}
            </h2>

          </div>

        </div>

        <button className="dd-hdr-notif">

          🔔

          {todayStats.pending > 0 && (

            <span className="dd-hdr-badge">

              {todayStats.pending}

            </span>

          )}

        </button>

      </header>

      {/* PROFILE */}

      {showProfile && (

        <div className="dd-prof">

          <div className="dd-prof-avatar">

            {userData?.name?.charAt(0)}

          </div>

          <h3>{userData?.name}</h3>

          <p>
            🛵 Delivery Partner
          </p>

          <div className="dd-prof-grid">

            <div>
              <span>📱</span>
              <span>{userData?.phone}</span>
            </div>

            <div>
              <span>📍</span>
              <span>
                {userData?.area || 'Hyderabad'}
              </span>
            </div>

          </div>

          <button
            className="dd-prof-logout"
            onClick={handleLogout}
          >
            🚪 Logout
          </button>

        </div>

      )}

      {/* STATS */}

      <div className="dd-stats">

        <div className="dd-stat">

          <span>📦</span>

          <strong>
            {customers.length}
          </strong>

          <small>Total Orders</small>

        </div>

        <div className="dd-stat">

          <span>⏳</span>

          <strong>
            {todayStats.pending}
          </strong>

          <small>Pending</small>

        </div>

        <div className="dd-stat">

          <span>✅</span>

          <strong>
            {todayStats.deliveries}
          </strong>

          <small>Completed</small>

        </div>

        <div className="dd-stat">

          <span>💰</span>

          <strong>
            ₹{todayStats.collected}
          </strong>

          <small>Collected</small>

        </div>

      </div>

      {/* QUICK ACTIONS */}

      <div className="dd-quick">

        <button
          onClick={() =>
            setActiveTab('pending')
          }
        >
          🚀 Start Delivery
        </button>

        <button
          onClick={() =>
            window.open(
              'https://maps.google.com',
              '_blank'
            )
          }
        >
          🗺️ Open Maps
        </button>

      </div>

      {/* SEARCH */}

      <div className="dd-srch">

        <span>🔍</span>

        <input
          placeholder="Search customer..."
          value={searchTerm}
          onChange={(e) =>
            setSearchTerm(e.target.value)
          }
        />

      </div>

      {/* TABS */}

      <div className="dd-tabs">

        <button
          className={
            activeTab === 'home'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('home')
          }
        >
          📦 Pending
        </button>

        <button
          className={
            activeTab === 'history'
              ? 'active'
              : ''
          }
          onClick={() =>
            setActiveTab('history')
          }
        >
          ✅ Completed
        </button>

      </div>

      {/* LIST */}

      <div className="dd-list">

        {(activeTab === 'home'
          ? pendingCustomers
          : completedCustomers
        ).map(c => {

          const total =
            (c.products || []).reduce(
              (sum, p) =>
                sum +
                (
                  (p.price || 0) *
                  (p.quantity || 1)
                ),
              0
            );

          return (

            <div
              key={c.id}
              className="dd-crow"
            >

              <div
                className="dd-crow-avatar"
                style={{
                  background:
                    c.delivered
                      ? '#22c55e'
                      : '#667eea'
                }}
              >

                {c.name?.charAt(0)}

              </div>

              <div className="dd-crow-info">

                <strong>
                  {c.name}
                </strong>

                <p>
                  📱 {c.phone}
                </p>

                <span className="dd-crow-milk">

                  🥛 Milk Delivery

                </span>

              </div>

              <div className="dd-crow-right">

                <strong>
                  ₹{total}
                </strong>

                <div className="dd-crow-acts">

                  <a
                    href={`tel:${c.phone}`}
                    className="dd-crow-btn"
                  >
                    📞
                  </a>

                  {!c.delivered ? (

                    <button
                      className="dd-crow-done"
                      onClick={() =>
                        markDelivered(c.id)
                      }
                    >

                      {deliveringId === c.id
                        ? '⏳'
                        : '✓'}

                    </button>

                  ) : (

                    <button
                      className="dd-crow-undo"
                      onClick={() =>
                        undoDelivery(c.id)
                      }
                    >
                      ↩
                    </button>

                  )}

                </div>

              </div>

            </div>
          );
        })}

      </div>

      {/* BOTTOM NAV */}

      <nav className="dd-nav">

        <button
          className={`dd-nav-item ${
            activeTab === 'home'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            setActiveTab('home')
          }
        >

          <span className="dd-nav-icon">
            🏠
          </span>

          <span className="dd-nav-label">
            Home
          </span>

        </button>

        <button
          className={`dd-nav-item ${
            activeTab === 'history'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            setActiveTab('history')
          }
        >

          <span className="dd-nav-icon">
            📜
          </span>

          <span className="dd-nav-label">
            History
          </span>

        </button>

        <button
          className="dd-nav-item"
          onClick={() =>
            setShowProfile(true)
          }
        >

          <span className="dd-nav-icon">
            👤
          </span>

          <span className="dd-nav-label">
            Profile
          </span>

        </button>

      </nav>

    </div>
  );
};

export default DeliveryDashboard;