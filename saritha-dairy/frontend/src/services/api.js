// src/services/api.js

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
// ============ HELPER FUNCTION ============
const handleResponse = async (response) => {
  try {
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: 'Failed to parse response' };
  }
};

// ============ PRODUCTS API ============
export const getAllProducts = async () => {
  try {
    const response = await fetch(`${API_URL}/products`);
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getProduct = async (id) => {
  try {
    const response = await fetch(`${API_URL}/products/${id}`);
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const addProduct = async (productData) => {
  try {
    const response = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateProduct = async (id, productData) => {
  try {
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteProduct = async (id) => {
  try {
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
    });
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ FARM PURCHASES API ============
export const addFarmPurchase = async (purchaseData) => {
  try {
    const response = await fetch(`${API_URL}/farm-purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getAllFarmPurchases = async () => {
  try {
    const response = await fetch(`${API_URL}/farm-purchases`);
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteFarmPurchase = async (id) => {
  try {
    const response = await fetch(`${API_URL}/farm-purchases/${id}`, {
      method: 'DELETE',
    });
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ STORE STOCK API ============
export const getStoreStock = async () => {
  try {
    const response = await fetch(`${API_URL}/store-stock`);
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ PACK PRODUCTS API ============
export const packProduct = async (packData) => {
  try {
    const response = await fetch(`${API_URL}/pack-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(packData)
    });
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ CUSTOMERS API ============
export const getCustomers = async () => {
  try {
    const response = await fetch(`${API_URL}/customers`);
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const addCustomer = async (customerData) => {
  try {
    const response = await fetch(`${API_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerData)
    });
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ SALES API ============
export const addSale = async (saleData) => {
  try {
    const response = await fetch(`${API_URL}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getSales = async (startDate, endDate) => {
  try {
    let url = `${API_URL}/sales`;
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const response = await fetch(url);
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ DASHBOARD API ============
export const getDashboardStats = async () => {
  try {
    const response = await fetch(`${API_URL}/dashboard/stats`);
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ TEST API ============
export const testConnection = async () => {
  try {
    const response = await fetch(`${API_URL}/test`);
    return await handleResponse(response);
  } catch (error) {
    return { success: false, error: error.message };
  }
};