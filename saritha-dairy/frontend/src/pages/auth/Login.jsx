// src/pages/auth/Login.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../components/contexts/AuthContext';
import { loginAdmin, loginDeliveryBoy, loginCustomer } from '../../api/auth';
import './Login.css';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { isAdminUser, isDeliveryBoy, isCustomer, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      if (isAdminUser) {
        window.location.href = '/dashboard';
      } else if (isDeliveryBoy) {
        window.location.href = '/delivery/dashboard';
      } else if (isCustomer) {
        window.location.href = '/customer/dashboard';
      }
    }
  }, [authLoading, isAdminUser, isDeliveryBoy, isCustomer]);

  // Clear any autofilled values on mount
  useEffect(() => {
    setPhone('');
    setPassword('');
  }, []);

  if (authLoading) {
    return (
      <div className="login-page">
        <div className="login-wrapper" style={{ textAlign: 'center', padding: '60px' }}>
          <img 
            src="https://res.cloudinary.com/dzuixvh7w/image/upload/v1/NjNkMTQ0OTAtMmFjYi00ODQ1LTg0ZWEtODEzNjgwMGY3ZmMwX2Z3cmZwdA==" 
            alt="Saritha Dairy" 
            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <p style={{ marginTop: '20px', color: '#666' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (isAdminUser || isDeliveryBoy || isCustomer) {
    return null;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      setLoading(false);
      return;
    }
    if (!password) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }
    
    const ADMIN_PHONE = '9347745435';
    
    if (phone === ADMIN_PHONE) {
      const result = await loginAdmin(phone, password);
      if (result.success) {
        window.location.href = '/dashboard';
        return;
      } else {
        setError(result.error || 'Invalid admin credentials');
        setLoading(false);
        return;
      }
    }
    
    const deliveryResult = await loginDeliveryBoy(phone, password);
    if (deliveryResult.success) {
      window.location.href = '/delivery/dashboard';
      return;
    }
    
    const customerResult = await loginCustomer(phone, password);
    if (customerResult.success) {
      window.location.href = '/customer/dashboard';
      return;
    }
    
    setError(customerResult.error || 'Invalid phone number or password');
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-wrapper">
        {/* Logo & Brand */}
        <div className="login-brand">
          <img 
            src="https://res.cloudinary.com/dzuixvh7w/image/upload/v1777714202/63d14490-2acb-4845-84ea-8136800f7fc0_fwrfpt.jpg" 
            alt="Saritha Dairy Logo" 
            className="login-logo-img"
          />
          <h1>SARITHA DAIRY</h1>
          <p>Pure by Nature, Trusted by Families</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="login-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="login-form">
          <div className="login-input-group">
            <span className="login-input-icon">📱</span>
            <input 
              type="tel" 
              placeholder="Enter phone number" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
              required 
              maxLength={10}
              className="login-input"
              autoFocus
              autoComplete="off"
              name="phone"
            />
          </div>
          
          <div className="login-input-group">
            <span className="login-input-icon">🔒</span>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Enter password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="login-input"
              autoComplete="new-password"
              name="password-new"
            />
            <button 
              type="button" 
              className="login-toggle-pwd"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          
          <button type="submit" disabled={loading} className="login-submit-btn">
            {loading ? (
              <span className="login-spinner"></span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <div className="login-footer-item">
            <span>📞</span>
            <span>9398263810</span>
          </div>
          <div className="login-footer-item">
            <span>📍</span>
            <span>JNTU, Hyderabad</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;