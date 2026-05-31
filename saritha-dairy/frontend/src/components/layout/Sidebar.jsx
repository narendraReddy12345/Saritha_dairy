import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose, isMobile, isTablet }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const menuItems = [
    { icon: '🏠', label: 'Dashboard', path: '/dashboard', color: '#3b82f6' },
    { icon: '📦', label: 'Inventory', path: '/inventory', color: '#10b981' },
    { icon: '🛍️', label: 'Non-Dairy Products', path: '/non-dairy-purchase', color: '#10b981' }, // Changed path to match route
    { icon: '🛒', label: 'Sales', path: '/sales', color: '#8b5cf6' },
    { icon: '🚚', label: 'Delivery History', path: '/delivery', color: '#f59e0b' },
    { icon: '👥', label: 'Customers', path: '/admin/customers', color: '#06b6d4' },
     { icon: '📋', label: 'Customer Updates', path: '/customer-updates', color: '#8b5cf6' },
    { icon: '👨‍💼', label: 'Delivery Boys', path: '/delivery-boys', color: '#ef4444' },
    // Add to menuItems array in Sidebar.jsx
{ icon: '💰', label: 'Payments', path: '/payment-management', color: '#10b981' },
    { icon: '📒', label: 'Credit', path: '/credit-management', color: '#f59e0b' },
    { icon: '🔔', label: 'Reminders', path: '/reminders', color: '#f97316' },
  ];

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    
    try {
      if (logout) await logout();
    } catch (error) {
      console.log('Logout error:', error);
    }
    
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = '/login';
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile || isTablet) {
      onClose();
    }
  };

  // Close sidebar on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Log current path for debugging
  useEffect(() => {
    console.log('Current location:', location.pathname);
  }, [location]);

  return (
    <>
      <aside className={`sidebar-innovative ${isOpen ? 'open' : ''} ${isTablet ? 'collapsed' : ''}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header-innovative">
          <div className="sidebar-logo-innovative">
            <span className="logo-icon">🥛</span>
            <span className="logo-text-innovative">Saritha Dairy</span>
          </div>
          {isMobile && (
            <button className="sidebar-close-innovative" onClick={onClose} aria-label="Close menu">
              ✕
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav-innovative">
          {menuItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item-innovative ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => handleNavigation(item.path)}
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{ '--hover-color': item.color }}
              title={isTablet ? item.label : ''}
            >
              <span className="nav-icon-innovative">{item.icon}</span>
              <span className="nav-label-innovative">{item.label}</span>
              {hoveredItem === item.path && isTablet && (
                <span className="nav-tooltip">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="sidebar-footer-innovative">
          <button 
            onClick={handleLogout} 
            className="logout-btn-innovative"
            disabled={loggingOut}
          >
            <span className="nav-icon-innovative">{loggingOut ? '⏳' : '🚪'}</span>
            <span className="nav-label-innovative">{loggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;