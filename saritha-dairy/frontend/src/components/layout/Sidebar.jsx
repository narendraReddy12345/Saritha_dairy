// Your Sidebar component with direct logout fallback
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const menuItems = [
    { icon: '🏠', label: 'Dashboard', path: '/dashboard', color: '#3b82f6' },
    { icon: '📦', label: 'Inventory', path: '/inventory', color: '#10b981' },
    { icon: '🛒', label: 'Sales', path: '/sales', color: '#8b5cf6' },
    { icon: '🚚', label: 'Delivery', path: '/delivery', color: '#f59e0b' },
    { icon: '👥', label: 'Customers', path: '/admin/customers', color: '#06b6d4' },
    { icon: '👨‍💼', label: 'Delivery Boys', path: '/delivery-boys', color: '#ef4444' },
    { icon: '📒', label: 'Credit', path: '/credit-management', color: '#f59e0b' },
    { icon: '📊', label: 'Reports', path: '/reports', color: '#ec4899' },
    { icon: '🔔', label: 'Reminders', path: '/reminders', color: '#f97316' },
    
    
    // In Sidebar.jsx menuItems array, add:

  ];

  // ✅ FIXED: Direct logout that ALWAYS works
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    
    console.log('🚪 Logout clicked');
    
    try {
      // Try context logout first
      if (logout) {
        await logout();
      }
    } catch (error) {
      console.log('Context logout error:', error);
    }
    
    // ✅ ALWAYS do direct cleanup (fallback)
    try {
      await signOut(auth);
      console.log('✅ Firebase signed out directly');
    } catch (error) {
      console.log('Firebase signout error:', error.message);
    }
    
    // Clear EVERYTHING
    sessionStorage.clear();
    localStorage.removeItem('adminSession');
    localStorage.removeItem('adminPassword');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userData');
    
    console.log('✅ All storage cleared, redirecting to login');
    
    // ✅ Force redirect to login
    window.location.href = '/login';
  };

  return (
    <>
      <aside className={`sidebar-innovative ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header-innovative">
          <div className="sidebar-logo-innovative">
            <span className="logo-text-innovative">Saritha Dairy</span>
          </div>
          <button className="sidebar-close-innovative" onClick={onClose}>✕</button>
        </div>

        <nav className="sidebar-nav-innovative">
          {menuItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item-innovative ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => {
                navigate(item.path);
                onClose();
              }}
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{ '--hover-color': item.color }}
            >
              <span className="nav-icon-innovative">{item.icon}</span>
              <span className="nav-label-innovative">{item.label}</span>
              {hoveredItem === item.path && <span className="nav-tooltip">{item.label}</span>}
            </button>
          ))}
        </nav>

        <button 
          onClick={handleLogout} 
          className="logout-btn-innovative"
          disabled={loggingOut}
        >
          <span className="nav-icon-innovative">{loggingOut ? '⏳' : '🚪'}</span>
          <span className="nav-label-innovative">{loggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </aside>
      {isOpen && <div className="sidebar-overlay-innovative" onClick={onClose}></div>}
    </>
  );
};

export default Sidebar;