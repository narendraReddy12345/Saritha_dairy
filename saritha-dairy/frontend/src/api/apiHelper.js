// src/api/apiHelper.js
const API_URL = 'http://localhost:5000/api';

const getHeaders = () => {
  const token = sessionStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

export const apiGet = async (endpoint) => {
  const res = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
  if (res.status === 401) { sessionStorage.clear(); window.location.href = '/login'; return null; }
  return res.json();
};

export const apiPost = async (endpoint, body) => {
  const res = await fetch(`${API_URL}${endpoint}`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
  if (res.status === 401) { sessionStorage.clear(); window.location.href = '/login'; return null; }
  return res.json();
};

export const apiPut = async (endpoint, body) => {
  const res = await fetch(`${API_URL}${endpoint}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) });
  if (res.status === 401) { sessionStorage.clear(); window.location.href = '/login'; return null; }
  return res.json();
};

export const apiDelete = async (endpoint) => {
  const res = await fetch(`${API_URL}${endpoint}`, { method: 'DELETE', headers: getHeaders() });
  if (res.status === 401) { sessionStorage.clear(); window.location.href = '/login'; return null; }
  return res.json();
};

export const apiPatch = async (endpoint, body) => {
  const res = await fetch(`${API_URL}${endpoint}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify(body || {}) });
  if (res.status === 401) { sessionStorage.clear(); window.location.href = '/login'; return null; }
  return res.json();
};