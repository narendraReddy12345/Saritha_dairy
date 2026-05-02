// src/api/auth.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const loginAdmin = async (phone, password) => {
  try {
    const res = await fetch(`${API_URL}/auth/admin-login-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();
    
    if (data.success) {
      sessionStorage.setItem('authToken', data.token);
      sessionStorage.setItem('userRole', 'admin');
      sessionStorage.setItem('userData', JSON.stringify(data.user));
    }
    return data;
  } catch (error) {
    return { success: false, error: 'Server connection failed' };
  }
};

export const loginDeliveryBoy = async (phone, password) => {
  try {
    const res = await fetch(`${API_URL}/auth/delivery-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();
    
    if (data.success) {
      sessionStorage.setItem('authToken', data.token);
      sessionStorage.setItem('userRole', 'delivery');
      sessionStorage.setItem('userData', JSON.stringify(data.user));
    }
    return data;
  } catch (error) {
    return { success: false, error: 'Server connection failed' };
  }
};

// ✅ Customer Login
export const loginCustomer = async (phone, password) => {
  try {
    const res = await fetch(`${API_URL}/auth/customer-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();
    
    if (data.success) {
      sessionStorage.setItem('authToken', data.token);
      sessionStorage.setItem('userRole', 'customer');
      sessionStorage.setItem('userData', JSON.stringify(data.user));
    }
    return data;
  } catch (error) {
    return { success: false, error: 'Server connection failed' };
  }
};

// ✅ Change customer password
export const changeCustomerPassword = async (phone, currentPassword, newPassword) => {
  try {
    const token = sessionStorage.getItem('authToken');
    const res = await fetch(`${API_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ phone, currentPassword, newPassword })
    });
    return await res.json();
  } catch (error) {
    return { success: false, error: 'Server connection failed' };
  }
};

export const logoutUser = () => {
  sessionStorage.clear();
};

export const getCurrentUser = () => {
  try {
    const role = sessionStorage.getItem('userRole');
    const dataStr = sessionStorage.getItem('userData');
    if (role && dataStr) {
      return { role, ...JSON.parse(dataStr) };
    }
    return null;
  } catch (error) {
    return null;
  }
};