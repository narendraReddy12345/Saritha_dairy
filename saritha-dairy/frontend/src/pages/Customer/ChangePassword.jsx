// src/pages/Customer/ChangePassword.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeCustomerPassword } from '../../api/auth';
import './ChangePassword.css';

const ChangePassword = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!currentPassword) {
      setError('Please enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setLoading(true);
    const result = await changeCustomerPassword(userData.phone, currentPassword, newPassword);
    setLoading(false);

    if (result.success) {
      setMessage('✅ Password changed successfully! Redirecting...');
      setTimeout(() => {
        navigate('/customer/dashboard');
      }, 2000);
    } else {
      setError(result.error || 'Failed to change password');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-section">
          <div className="logo">🥛</div>
          <h1>SARITHA DAIRY</h1>
          <p>Change Your Password</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-icon-wrapper">
            <span className="input-icon">🔒</span>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Current Password" 
              value={currentPassword} 
              onChange={(e) => setCurrentPassword(e.target.value)} 
              required 
            />
          </div>
          <div className="input-icon-wrapper">
            <span className="input-icon">🔑</span>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="New Password (min 6 chars)" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              required 
              minLength={6}
            />
          </div>
          <div className="input-icon-wrapper">
            <span className="input-icon">🔑</span>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Confirm New Password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
            />
          </div>
          <button 
            type="button" 
            className="toggle-password-btn" 
            onClick={() => setShowPassword(!showPassword)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', marginBottom: '10px' }}
          >
            {showPassword ? '🙈 Hide Passwords' : '👁️ Show Passwords'}
          </button>
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Changing...' : '🔐 Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;