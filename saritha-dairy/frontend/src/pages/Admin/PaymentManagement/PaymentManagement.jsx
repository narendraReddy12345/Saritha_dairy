// src/pages/Admin/PaymentManagement/PaymentManagement.jsx
import React, { useState, useEffect } from 'react';
import './PaymentManagement.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const PaymentManagement = () => {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [message, setMessage] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
  const [selectedCustomerForManual, setSelectedCustomerForManual] = useState(null);
  const [activeTab, setActiveTab] = useState('requests');
  const [customerBills, setCustomerBills] = useState([]);
  const [paymentSettings, setPaymentSettings] = useState({
    bank_name: '',
    account_name: '',
    account_number: '',
    ifsc_code: '',
    upi_id: '',
    qr_code_url: '',
    contact_number: ''
  });

  const [manualPaymentData, setManualPaymentData] = useState({
    customer_id: '',
    amount: '',
    reason: '',
    payment_date: new Date().toISOString().split('T')[0]
  });

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
    fetchAllData();
    fetchPaymentSettings();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, customersRes, billsRes] = await Promise.all([
        fetch(`${API_URL}/admin/payments`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/customers`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/customer-bills`, { headers: getAuthHeaders() })
      ]);
      
      const paymentsData = await paymentsRes.json();
      const customersData = await customersRes.json();
      const billsData = await billsRes.json();
      
      if (paymentsData.success) setPayments(paymentsData.payments || []);
      if (customersData.success) setCustomers(customersData.customers || []);
      if (billsData.success) setCustomerBills(billsData.bills || []);
    } catch (error) {
      console.error('Error:', error);
      showMessage('error', 'Failed to load data');
    }
    setLoading(false);
  };

  const fetchPaymentSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/payment-settings`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success && data.settings) {
        setPaymentSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
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
        fetchAllData();
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
        fetchAllData();
      } else {
        showMessage('error', data.error || 'Failed to reject');
      }
    } catch (error) {
      showMessage('error', 'Failed to connect');
    }
  };

  const handleManualPaymentAdjustment = async (e) => {
    e.preventDefault();
    if (!manualPaymentData.customer_id || !manualPaymentData.amount) {
      showMessage('error', 'Please fill all required fields');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/admin/manual-payment-adjustment`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(manualPaymentData)
      });
      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Manual payment adjustment completed!');
        setShowManualPaymentModal(false);
        resetManualPaymentForm();
        fetchAllData();
      } else {
        showMessage('error', data.error || 'Failed to process');
      }
    } catch (error) {
      showMessage('error', 'Failed to connect');
    }
  };

  const handleUpdatePaymentSettings = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/admin/payment-settings`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(paymentSettings)
      });
      const data = await response.json();
      if (data.success) {
        showMessage('success', 'Payment settings updated!');
        setShowSettingsModal(false);
      } else {
        showMessage('error', data.error || 'Failed to update');
      }
    } catch (error) {
      showMessage('error', 'Failed to connect');
    }
  };

  const handleQrCodeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('qr_code', file);
    
    try {
      const response = await fetch(`${API_URL}/admin/upload-qr-code`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setPaymentSettings({ ...paymentSettings, qr_code_url: data.url });
        showMessage('success', 'QR Code uploaded successfully!');
      }
    } catch (error) {
      showMessage('error', 'Failed to upload QR code');
    }
  };

  const resetManualPaymentForm = () => {
    setManualPaymentData({
      customer_id: '',
      amount: '',
      reason: '',
      payment_date: new Date().toISOString().split('T')[0]
    });
    setSelectedCustomerForManual(null);
  };

  const getCustomerBillTotal = (customerId) => {
    const customerBill = customerBills.find(b => b.customer_id === customerId);
    return customerBill ? customerBill.total_amount : 0;
  };

  const filteredPayments = payments.filter(payment => {
    if (filterStatus !== 'all' && payment.status !== filterStatus) return false;
    if (filterType !== 'all' && payment.payment_type !== filterType) return false;
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
    totalAmount: payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0),
    totalPendingAmount: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)
  };

  if (loading) {
    return (
      <div className="pm-container">
        <div className="pm-loading-screen">
          <div className="pm-spinner">💰</div>
          <p>Loading payment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pm-container">
      {message && (
        <div className={`pm-toast ${message.type}`}>
          <span>{message.type === 'success' ? '✅' : '❌'} {message.text}</span>
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Header */}
      <div className="pm-header">
        <div>
          <h1>💰 Payment Management System</h1>
          <p>Manage customer payments, view bills, and configure payment methods</p>
        </div>
        <div className="pm-header-actions">
          <button className="pm-settings-btn" onClick={() => setShowSettingsModal(true)}>
            ⚙️ Payment Settings
          </button>
          <button className="pm-manual-btn" onClick={() => setShowManualPaymentModal(true)}>
            ✏️ Manual Adjustment
          </button>
          <button className="pm-refresh-btn" onClick={fetchAllData}>🔄 Refresh</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="pm-stats-grid">
        <div className="pm-stat-card"><span className="pm-stat-icon">📊</span><div><h3>{stats.total}</h3><p>Total Requests</p></div></div>
        <div className="pm-stat-card pending"><span className="pm-stat-icon">⏳</span><div><h3>{stats.pending}</h3><p>Pending</p><small>₹{stats.totalPendingAmount.toLocaleString()}</small></div></div>
        <div className="pm-stat-card approved"><span className="pm-stat-icon">✅</span><div><h3>{stats.approved}</h3><p>Approved</p></div></div>
        <div className="pm-stat-card rejected"><span className="pm-stat-icon">❌</span><div><h3>{stats.rejected}</h3><p>Rejected</p></div></div>
        <div className="pm-stat-card"><span className="pm-stat-icon">💰</span><div><h3>₹{stats.totalAmount.toLocaleString()}</h3><p>Total Amount</p></div></div>
      </div>

      {/* Tabs */}
      <div className="pm-tabs">
        <button className={`pm-tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
          📋 Payment Requests
        </button>
        <button className={`pm-tab ${activeTab === 'bills' ? 'active' : ''}`} onClick={() => setActiveTab('bills')}>
          🧾 Customer Bills
        </button>
        <button className={`pm-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          📜 Payment History
        </button>
      </div>

      {/* Filters */}
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
        <select className="pm-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="online">Online Payments</option>
          <option value="manual">Manual Adjustments</option>
        </select>
      </div>

      {activeTab === 'requests' && (
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
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="pm-empty-row">No payment requests found</td>
                </tr>
              ) : (
                filteredPayments.map(payment => (
                  <tr key={payment.id} className={`pm-row ${payment.status}`}>
                    <td className="pm-date">{new Date(payment.created_at).toLocaleDateString()}</td>
                    <td>
                      <strong>{payment.customer_name}</strong>
                      <br />
                      <small>{payment.customer_phone}</small>
                    </td>
                    <td className="pm-amount">₹{payment.amount.toLocaleString()}</td>
                    <td>
                      <span className="pm-method-badge">
                        {payment.payment_method === 'qr' ? '📱 QR' : 
                         payment.payment_method === 'bank' ? '🏦 Bank' : '📲 UPI'}
                      </span>
                    </td>
                    <td>
                      <button className="pm-view-screenshot" onClick={() => { setSelectedPayment(payment); setShowModal(true); }}>
                        📸 View
                      </button>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'bills' && (
        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Milk Charges</th>
                <th>Extra Products</th>
                <th>Total Bill</th>
                <th>Paid Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customerBills.length === 0 ? (
                <tr>
                  <td colSpan="7" className="pm-empty-row">No bill data found</td>
                </tr>
              ) : (
                customerBills.map(bill => (
                  <tr key={bill.customer_id}>
                    <td><strong>{bill.customer_name}</strong></td>
                    <td>{bill.customer_phone}</td>
                    <td className="pm-amount">₹{bill.milk_charges?.toLocaleString() || 0}</td>
                    <td className="pm-amount">₹{bill.extra_charges?.toLocaleString() || 0}</td>
                    <td className="pm-amount total">₹{bill.total_bill?.toLocaleString() || 0}</td>
                    <td className="pm-amount paid">₹{bill.paid_amount?.toLocaleString() || 0}</td>
                    <td>
                      <span className={`pm-bill-status ${bill.pending_amount > 0 ? 'pending' : 'paid'}`}>
                        {bill.pending_amount > 0 ? '⚠️ Pending' : '✅ Paid'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Method</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {payments.filter(p => p.status !== 'pending').length === 0 ? (
                <tr>
                  <td colSpan="7" className="pm-empty-row">No payment history found</td>
                </tr>
              ) : (
                payments.filter(p => p.status !== 'pending').map(payment => (
                  <tr key={payment.id} className={`pm-row ${payment.status}`}>
                    <td className="pm-date">{new Date(payment.created_at).toLocaleDateString()}</td>
                    <td><strong>{payment.customer_name}</strong><br /><small>{payment.customer_phone}</small></td>
                    <td className="pm-amount">₹{payment.amount.toLocaleString()}</td>
                    <td><span className="pm-type-badge">{payment.payment_type === 'manual' ? '✏️ Manual' : '💳 Online'}</span></td>
                    <td><span className="pm-method-badge">{payment.payment_method || 'N/A'}</span></td>
                    <td><span className={`pm-status-badge ${payment.status}`}>{payment.status === 'approved' ? '✅ Approved' : '❌ Rejected'}</span></td>
                    <td><small>{payment.reference || payment.id}</small></td>
                  </tr>
                ))
              )}
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
              <div className="pm-payment-details">
                <p><strong>Customer:</strong> {selectedPayment.customer_name}</p>
                <p><strong>Amount:</strong> ₹{selectedPayment.amount}</p>
                <p><strong>Date:</strong> {new Date(selectedPayment.created_at).toLocaleString()}</p>
                <p><strong>Method:</strong> {selectedPayment.payment_method}</p>
              </div>
              <div className="pm-screenshot">
                <img src={selectedPayment.screenshot_url} alt="Payment Screenshot" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Settings Modal */}
      {showSettingsModal && (
        <div className="pm-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="pm-modal pm-settings-modal" onClick={e => e.stopPropagation()}>
            <div className="pm-modal-header">
              <h3>⚙️ Payment Settings</h3>
              <button onClick={() => setShowSettingsModal(false)}>×</button>
            </div>
            <form onSubmit={handleUpdatePaymentSettings} className="pm-settings-form">
              <div className="pm-form-section">
                <h4>🏦 Bank Details</h4>
                <div className="pm-form-row">
                  <div className="pm-form-group">
                    <label>Bank Name</label>
                    <input type="text" value={paymentSettings.bank_name} onChange={e => setPaymentSettings({...paymentSettings, bank_name: e.target.value})} placeholder="Enter bank name" />
                  </div>
                  <div className="pm-form-group">
                    <label>Account Name</label>
                    <input type="text" value={paymentSettings.account_name} onChange={e => setPaymentSettings({...paymentSettings, account_name: e.target.value})} placeholder="Enter account name" />
                  </div>
                </div>
                <div className="pm-form-row">
                  <div className="pm-form-group">
                    <label>Account Number</label>
                    <input type="text" value={paymentSettings.account_number} onChange={e => setPaymentSettings({...paymentSettings, account_number: e.target.value})} placeholder="Enter account number" />
                  </div>
                  <div className="pm-form-group">
                    <label>IFSC Code</label>
                    <input type="text" value={paymentSettings.ifsc_code} onChange={e => setPaymentSettings({...paymentSettings, ifsc_code: e.target.value})} placeholder="Enter IFSC code" />
                  </div>
                </div>
              </div>

              <div className="pm-form-section">
                <h4>📱 UPI Details</h4>
                <div className="pm-form-row">
                  <div className="pm-form-group">
                    <label>UPI ID</label>
                    <input type="text" value={paymentSettings.upi_id} onChange={e => setPaymentSettings({...paymentSettings, upi_id: e.target.value})} placeholder="Enter UPI ID" />
                  </div>
                  <div className="pm-form-group">
                    <label>Contact Number</label>
                    <input type="text" value={paymentSettings.contact_number} onChange={e => setPaymentSettings({...paymentSettings, contact_number: e.target.value})} placeholder="Enter contact number" />
                  </div>
                </div>
              </div>

              <div className="pm-form-section">
                <h4>📸 QR Code</h4>
                <div className="pm-qr-upload">
                  {paymentSettings.qr_code_url && (
                    <div className="pm-qr-preview">
                      <img src={paymentSettings.qr_code_url} alt="QR Code" />
                      <button type="button" onClick={() => setPaymentSettings({...paymentSettings, qr_code_url: ''})}>Remove</button>
                    </div>
                  )}
                  <label className="pm-upload-btn">
                    📤 Upload QR Code
                    <input type="file" accept="image/*" onChange={handleQrCodeUpload} style={{display: 'none'}} />
                  </label>
                </div>
              </div>

              <div className="pm-form-footer">
                <button type="button" className="pm-cancel-btn" onClick={() => setShowSettingsModal(false)}>Cancel</button>
                <button type="submit" className="pm-save-btn">Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      {showManualPaymentModal && (
        <div className="pm-modal-overlay" onClick={() => setShowManualPaymentModal(false)}>
          <div className="pm-modal pm-manual-modal" onClick={e => e.stopPropagation()}>
            <div className="pm-modal-header">
              <h3>✏️ Manual Payment Adjustment</h3>
              <button onClick={() => setShowManualPaymentModal(false)}>×</button>
            </div>
            <form onSubmit={handleManualPaymentAdjustment} className="pm-manual-form">
              <div className="pm-form-group">
                <label>Select Customer *</label>
                <select value={manualPaymentData.customer_id} onChange={e => setManualPaymentData({...manualPaymentData, customer_id: e.target.value})} required>
                  <option value="">Select a customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone} (Due: ₹{getCustomerBillTotal(customer.id).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pm-form-row">
                <div className="pm-form-group">
                  <label>Amount *</label>
                  <input type="number" value={manualPaymentData.amount} onChange={e => setManualPaymentData({...manualPaymentData, amount: e.target.value})} placeholder="Enter amount" required min="1" />
                </div>
                <div className="pm-form-group">
                  <label>Payment Date *</label>
                  <input type="date" value={manualPaymentData.payment_date} onChange={e => setManualPaymentData({...manualPaymentData, payment_date: e.target.value})} required />
                </div>
              </div>

              <div className="pm-form-group">
                <label>Reason / Notes</label>
                <textarea value={manualPaymentData.reason} onChange={e => setManualPaymentData({...manualPaymentData, reason: e.target.value})} rows="3" placeholder="Enter reason for manual adjustment (e.g., Cash payment received, Discount, etc.)" />
              </div>

              <div className="pm-form-footer">
                <button type="button" className="pm-cancel-btn" onClick={() => setShowManualPaymentModal(false)}>Cancel</button>
                <button type="submit" className="pm-save-btn">Process Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentManagement;