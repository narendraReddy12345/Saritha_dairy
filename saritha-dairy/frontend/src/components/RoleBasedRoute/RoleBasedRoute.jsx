// src/components/RoleBasedRoute/RoleBasedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RoleBasedRoute = ({ children, allowedRoles }) => {
  const { userRole } = useAuth();
  
  if (!userRole) {
    return <Navigate to="/login" replace />;
  }
  
  if (!allowedRoles.includes(userRole)) {
    // Redirect based on actual role
    if (userRole === 'admin') return <Navigate to="/dashboard" replace />;
    if (userRole === 'delivery') return <Navigate to="/delivery/dashboard" replace />;
    if (userRole === 'customer') return <Navigate to="/customer/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export default RoleBasedRoute;