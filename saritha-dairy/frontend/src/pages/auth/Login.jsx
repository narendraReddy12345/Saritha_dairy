// src/pages/auth/Login.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/contexts/AuthContext';
import {
  loginAdmin,
  loginDeliveryBoy,
  loginCustomer
} from '../../api/auth';

import './Login.css';

const Login = () => {

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    isAdminUser,
    isDeliveryBoy,
    isCustomer,
    loading: authLoading
  } = useAuth();

  const navigate = useNavigate();

  useEffect(() => {

    if (!authLoading) {

      if (isAdminUser) {
        navigate('/dashboard', { replace: true });
      }

      else if (isDeliveryBoy) {
        navigate('/delivery/dashboard', { replace: true });
      }

      else if (isCustomer) {
        navigate('/customer/dashboard', { replace: true });
      }
    }

  }, [
    authLoading,
    isAdminUser,
    isDeliveryBoy,
    isCustomer,
    navigate
  ]);

  if (authLoading) {

    return (
      <div className="login-page">

        <div className="login-right">

          <div className="login-wrapper loading-wrapper">

            <div className="login-logo">
              <img
                src="https://res.cloudinary.com/dzuixvh7w/image/upload/q_auto/f_auto/v1777819969/63d14490-2acb-4845-84ea-8136800f7fc0_krgt7a.jpg"
                alt="logo"
                className="logo-img"
              />
            </div>

            <p className="loading-text">Loading...</p>

          </div>

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
      setError('Please enter valid 10-digit phone number');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Please enter password');
      setLoading(false);
      return;
    }

    const ADMIN_PHONE = '9666966811';

    if (phone === ADMIN_PHONE) {

      const result = await loginAdmin(phone, password);

      if (result.success) {
        window.location.href = '/dashboard';
        return;
      }

      setError(result.error || 'Invalid admin credentials');
      setLoading(false);
      return;
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

    setError(customerResult.error || 'Invalid phone or password');

    setLoading(false);
  };

  return (

    <div className="login-page">

      {/* LEFT SIDE */}

      <div className="login-left">

        <div className="slider">

          <div className="slide">
            <img
              src="https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=1974&auto=format&fit=crop"
              alt=""
            />
          </div>

          <div className="slide">
            <img
              src="https://images.unsplash.com/photo-1628088062854-d1870b4553da?q=80&w=1974&auto=format&fit=crop"
              alt=""
            />
          </div>

          <div className="slide">
            <img
              src="https://images.unsplash.com/photo-1517448931760-9bf4414148c5?q=80&w=1974&auto=format&fit=crop"
              alt=""
            />
          </div>

        </div>

        <div className="overlay">

          <h1>SARITHA DAIRY</h1>

          <p>
            Fresh Milk • Pure Products • Fast Delivery
          </p>

        </div>

      </div>

      {/* RIGHT SIDE */}

      <div className="login-right">

        <div className="login-wrapper">

          <div className="login-brand">

            <div className="login-logo">

              <img
                src="https://res.cloudinary.com/dzuixvh7w/image/upload/q_auto/f_auto/v1777819969/63d14490-2acb-4845-84ea-8136800f7fc0_krgt7a.jpg"
                alt="logo"
                className="logo-img"
              />

            </div>

            <h2>Welcome Back</h2>

            <p>Login to continue</p>

          </div>

          {error && (
            <div className="login-error">
              ⚠️ {error}
            </div>
          )}

          <form
            onSubmit={handleLogin}
            className="login-form"
          >

            <div className="login-input-group">

              <span className="login-input-icon">
                📱
              </span>

              <input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value
                      .replace(/\D/g, '')
                      .slice(0, 10)
                  )
                }
                required
                maxLength={10}
                className="login-input"
              />

            </div>

            <div className="login-input-group">

              <span className="login-input-icon">
                🔒
              </span>

              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
                className="login-input"
              />

              <button
                type="button"
                className="login-toggle-pwd"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
              >
                {showPassword ? '🙈' : '👁️'}
              </button>

            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-submit-btn"
            >

              {loading
                ? <span className="login-spinner"></span>
                : 'Login'
              }

            </button>

          </form>

          

        </div>

      </div>

    </div>
  );
};

export default Login;