// src/pages/auth/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading) {
      if (isAdminUser) {
        navigate('/dashboard', { replace: true });
      } else if (isDeliveryBoy) {
        navigate('/delivery/dashboard', { replace: true });
      } else if (isCustomer) {
        navigate('/customer/dashboard', { replace: true });
      }
    }
  }, [authLoading, isAdminUser, isDeliveryBoy, isCustomer, navigate]);

  if (authLoading) {
    return (
      <div className="login-page">
        <div className="login-wrapper" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="login-logo">🥛</div>
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
      console.log('Admin login result:', result);
      if (result.success) {
        navigate('/dashboard', { replace: true });
        return;
      } else {
        setError(result.error || 'Invalid admin credentials');
        setLoading(false);
        return;
      }
    }
    
    const deliveryResult = await loginDeliveryBoy(phone, password);
    console.log('Delivery login result:', deliveryResult);
    if (deliveryResult.success) {
      navigate('/delivery/dashboard', { replace: true });
      return;
    }
    
    const customerResult = await loginCustomer(phone, password);
    console.log('Customer login result:', customerResult);
    if (customerResult.success) {
      navigate('/customer/dashboard', { replace: true });
      return;
    }
    
    setError(customerResult.error || 'Invalid phone number or password');
    setLoading(false);
  };

  const quickLogin = (phoneNum, pass) => {
    setPhone(phoneNum);
    setPassword(pass);
  };

  return (
    <div className="login-page">
      <div className="login-wrapper">
        {/* Logo & Brand */}
        <div className="login-brand">
          <div className="login-logo">🥛</div>
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