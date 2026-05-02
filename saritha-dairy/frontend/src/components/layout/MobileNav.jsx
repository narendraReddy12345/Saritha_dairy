import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './MobileNav.css';

const MobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: '🏠', label: 'Home', path: '/dashboard' },
    { icon: '📦', label: 'Stock', path: '/inventory' },
    { icon: '🛒', label: 'Sales', path: '/sales' },
    { icon: '🚚', label: 'Delivery', path: '/delivery' },
    { icon: '📊', label: 'Reports', path: '/reports' },
  ];

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => (
        <button
          key={item.path}
          className={`mobile-nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span className="mobile-nav-icon">{item.icon}</span>
          <span className="mobile-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default MobileNav;