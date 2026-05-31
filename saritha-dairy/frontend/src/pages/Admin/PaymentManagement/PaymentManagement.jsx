// src/pages/Admin/PaymentManagement/PaymentManagement.jsx
import React, { useState, useEffect } from 'react';
import './PaymentManagement.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const PaymentManagement = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [message, setMessage] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const getToken = () => sessionStorage.getItem('authToken');
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/payments`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setPayments(data.payments || []);
      }
    } catch (error) {
      console.error('Error:', error);
      showMessage('error', 'Failed to load payments');
    }
    setLoading(false);
  };

  const handleApprovePayment = async (paymentId) => {
    if (!window.confirm('Approve this payment? This will credit the amount to customer wallet.')) return;
    
    try {
      const response = await fetch(`${API_URL}/admin/payments/${paymentId}/approve`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Payment approved and wallet updated!');
        fetchPayments();
      } else {
        showMessage('error', data.error || 'Failed to approve');
      }
    } catch (error) {
      showMessage('error', 'Failed to connect');
    }
  };

  const handleRejectPayment = async (paymentId) => {
    if (!window.confirm('Reject this payment?')) return;
    
    try {
      const response = await fetch(`${API_URL}/admin/payments/${paymentId}/reject`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Payment rejected');
        fetchPayments();
      } else {
        showMessage('error', data.error || 'Failed to reject');
      }
    } catch (error) {
      showMessage('error', 'Failed to connect');
    }
  };

  const filteredPayments = payments.filter(payment => {
    if (filterStatus !== 'all' && payment.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return payment.customer_name?.toLowerCase().includes(term) ||
             payment.customer_phone?.includes(term);
    }
    return true;
  });

  const stats = {
    total: payments.length,
    pending: payments.filter(p => p.status === 'pending').length,
    approved: payments.filter(p => p.status === 'approved').length,
    rejected: payments.filter(p => p.status === 'rejected').length,
    totalAmount: payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0)
  };

  return (
    <div className="pm-container">
      {message && (
        <div className={`pm-toast ${message.type}`}>
          <span>{message.type === 'success' ? '✅' : '❌'} {message.text}</span>
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="pm-header">
        <div>
          <h1>💰 Payment Management</h1>
          <p>Review and approve customer payment requests</p>
        </div>
        <button className="pm-refresh-btn" onClick={fetchPayments}>🔄 Refresh</button>
      </div>

      <div className="pm-stats-grid">
        <div className="pm-stat-card"><span className="pm-stat-icon">📊</span><div><h3>{stats.total}</h3><p>Total Requests</p></div></div>
        <div className="pm-stat-card pending"><span className="pm-stat-icon">⏳</span><div><h3>{stats.pending}</h3><p>Pending</p></div></div>
        <div className="pm-stat-card approved"><span className="pm-stat-icon">✅</span><div><h3>{stats.approved}</h3><p>Approved</p></div></div>
        <div className="pm-stat-card rejected"><span className="pm-stat-icon">❌</span><div><h3>{stats.rejected}</h3><p>Rejected</p></div></div>
        <div className="pm-stat-card"><span className="pm-stat-icon">💰</span><div><h3>₹{stats.totalAmount.toLocaleString()}</h3><p>Total Amount</p></div></div>
      </div>

      <div className="pm-filters">
        <div className="pm-search-box">
          <span>🔍</span>
          <input type="text" placeholder="Search by customer name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {searchTerm && <button onClick={() => setSearchTerm('')}>✕</button>}
        </div>
        <select className="pm-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="pm-loading">Loading payments...</div>
      ) : filteredPayments.length === 0 ? (
        <div className="pm-empty">No payment requests found</div>
      ) : (
        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Screenshot</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(payment => (
                <tr key={payment.id} className={`pm-row ${payment.status}`}>
                  <td>{new Date(payment.created_at).toLocaleDateString()}</td>
                  <td>
                    <strong>{payment.customer_name}</strong>
                    <br />
                    <small>{payment.customer_phone}</small>
                  </td>
                  <td className="pm-amount">₹{payment.amount.toLocaleString()}</td>
                  <td>
                    <span className="pm-method-badge">
                      {payment.payment_method === 'qr' ? '📱 QR Code' : 
                       payment.payment_method === 'bank' ? '🏦 Bank' : '📲 UPI'}
                    </span>
                  </td>
                  <td>
                    <button className="pm-view-screenshot" onClick={() => { setSelectedPayment(payment); setShowModal(true); }}>📸 View</button>
                  </td>
                  <td>
                    <span className={`pm-status-badge ${payment.status}`}>
                      {payment.status === 'pending' ? '⏳ Pending' : 
                       payment.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                    </span>
                  </td>
                  <td>
                    {payment.status === 'pending' && (
                      <div className="pm-actions">
                        <button className="pm-approve-btn" onClick={() => handleApprovePayment(payment.id)}>Approve</button>
                        <button className="pm-reject-btn" onClick={() => handleRejectPayment(payment.id)}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Screenshot Modal */}
      {showModal && selectedPayment && (
        <div className="pm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="pm-modal" onClick={e => e.stopPropagation()}>
            <div className="pm-modal-header">
              <h3>Payment Screenshot</h3>
              <button onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="pm-modal-body">
              <p><strong>Customer:</strong> {selectedPayment.customer_name}</p>
              <p><strong>Amount:</strong> ₹{selectedPayment.amount}</p>
              <p><strong>Date:</strong> {new Date(selectedPayment.created_at).toLocaleString()}</p>
              <div className="pm-screenshot">
                <img src={selectedPayment.screenshot_url} alt="Payment Screenshot" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentManagement;