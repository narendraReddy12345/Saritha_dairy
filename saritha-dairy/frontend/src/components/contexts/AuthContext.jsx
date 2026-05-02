// src/components/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ Load user from session storage
    const loadUser = () => {
      try {
        const role = sessionStorage.getItem('userRole');
        const dataStr = sessionStorage.getItem('userData');
        
        console.log('🔍 AuthContext loading - Role:', role);
        console.log('🔍 AuthContext loading - Data:', dataStr);
        
        if (role && dataStr) {
          const data = JSON.parse(dataStr);
          setCurrentUser(data);
          setUserRole(role);
          setUserData(data);
          console.log('✅ User loaded:', data);
        } else {
          setCurrentUser(null);
          setUserRole(null);
          setUserData(null);
          console.log('❌ No user found in session');
        }
      } catch (error) {
        console.error('Error loading user:', error);
        setCurrentUser(null);
        setUserRole(null);
        setUserData(null);
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const logout = () => {
    sessionStorage.clear();
    setCurrentUser(null);
    setUserRole(null);
    setUserData(null);
  };

  const value = {
    currentUser,
    userRole,
    userData,
    loading,
    isAdminUser: userRole === 'admin',
    isDeliveryBoy: userRole === 'delivery',
    isCustomer: userRole === 'customer', // ✅ Added customer role
    isAuthenticated: !!userRole,
    logout
  };

  console.log('🔐 AuthContext state:', { userRole, userData, loading });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};