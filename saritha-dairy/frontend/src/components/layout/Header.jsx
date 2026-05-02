import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

const Header = ({ onMenuClick }) => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const hour = currentTime.getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, [currentTime]);

  const formatDate = () => {
    return currentTime.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short'
    });
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getGreetingIcon = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return '🌅';
    if (hour < 18) return '☀️';
    return '🌙';
  };

  const userName = user?.email?.split('@')[0] || 'Admin';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="user-friendly-header">
      

      {/* Greeting Section */}
      <div className="greeting-section">
        <span className="greeting-icon">{getGreetingIcon()}</span>
        <div>
          <div className="greeting-text">{greeting},</div>
          <div className="user-name">{userName}</div>
        </div>
      </div>

      {/* Date & Time */}
      <div className="datetime-section">
        <div className="time-card">
          <span className="time-icon">⏰</span>
          <span className="time-value">{formatTime()}</span>
        </div>
        <div className="date-card">
          <span className="date-icon">📅</span>
          <span className="date-value">{formatDate()}</span>
        </div>
      </div>

      {/* User Section */}
      <div className="user-section">
        <button 
          className="notify-btn"
          onClick={() => alert('Notifications coming soon!')}
        >
          <span className="notify-icon">🔔</span>
          <span className="notify-badge">3</span>
        </button>
        
        <div className="user-profile" onClick={() => setShowUserMenu(!showUserMenu)}>
          <div className="user-avatar">
            <span className="avatar-initial">{userInitial}</span>
            <span className="avatar-status"></span>
          </div>
          <div className="user-details">
            <span className="user-fullname">{userName}</span>
            <span className="user-role">Admin</span>
          </div>
          <span className="dropdown-arrow">▼</span>
        </div>

        {/* Dropdown Menu */}
        {showUserMenu && (
          <div className="user-dropdown">
            <div className="dropdown-header">
              <div className="dropdown-avatar">{userInitial}</div>
              <div>
                <div className="dropdown-name">{userName}</div>
                <div className="dropdown-email">{user?.email || 'admin@saritha.com'}</div>
              </div>
            </div>
            <div className="dropdown-divider"></div>
            <button className="dropdown-item">
              <span>👤</span> Profile
            </button>
            <button className="dropdown-item">
              <span>⚙️</span> Settings
            </button>
            <div className="dropdown-divider"></div>
            <button className="dropdown-item logout">
              <span>🚪</span> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;