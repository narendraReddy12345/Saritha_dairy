import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleBasedRoute from './components/RoleBasedRoute/RoleBasedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/auth/Login';
import Dashboard from './pages/Admin/dashboard/Dashboard';
import Inventory from './pages/Admin/inventory/Inventory';
import AddPurchase from './pages/Admin/inventory/AddFarmPurchase';
import StoreStock from './pages/Admin/inventory/StoreStock';
import PackProducts from './pages/Admin/inventory/PackProducts';
import Products from './pages/Admin/inventory/Products';
import Sales from './pages/Admin/Sales/Sales';
import CustomerManagement from './pages/Admin/CustomerManagement/CustomerManagement';
import DeliveryDashboard from './pages/Delivery/DeliveryDashboard';
import DeliveryBoyManagement from './pages/Admin/Delivery/DeliveryBoyManagement';
import DeliveryHistory from './pages/Admin/Delivery/DeliveryHistory';
import CustomerDashboard from './pages/Customer/CustomerDashboard';
import ChangePassword from './pages/Customer/ChangePassword';
import CreditManagement from './pages/Admin/CreditManagement/CreditManagement';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Admin Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/inventory" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <Inventory />
                </AppLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/inventory/products" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <Products />
                </AppLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/purchases/add" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <AddPurchase />
                </AppLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/inventory/store-stock" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <StoreStock />
                </AppLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/inventory/pack-products" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <PackProducts />
                </AppLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/sales" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <Sales />
                </AppLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/delivery" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <DeliveryHistory />
                </AppLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/delivery-boys" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <DeliveryBoyManagement />
                </AppLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/admin/customers" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <CustomerManagement />
                </AppLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          {/* Delivery Boy Route */}
          <Route path="/delivery/dashboard" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['delivery']}>
                <DeliveryDashboard />
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          {/* Customer Routes */}
          <Route path="/customer/dashboard" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['customer']}>
                <CustomerDashboard />
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/customer/change-password" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['customer']}>
                <ChangePassword />
              </RoleBasedRoute>
            </ProtectedRoute>
          } />
          <Route path="/credit-management" element={
  <ProtectedRoute>
    <RoleBasedRoute allowedRoles={['admin']}>
      <AppLayout>
        <CreditManagement />
      </AppLayout>
    </RoleBasedRoute>
  </ProtectedRoute>
} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;