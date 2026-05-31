// backend/controllers/paymentController.js
const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = './uploads/payments';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ==================== PAYMENT REQUESTS ====================

// Get all payment requests (Admin)
const getAllPayments = async (req, res) => {
  try {
    const [payments] = await db.query(`
      SELECT 
        p.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email
      FROM payment_requests p
      JOIN customers c ON p.customer_id = c.id
      ORDER BY p.created_at DESC
    `);
    
    res.json({ success: true, payments });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payments' });
  }
};

// Get customer payments (Customer)
const getCustomerPayments = async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const [payments] = await db.query(`
      SELECT * FROM payment_requests 
      WHERE customer_id = ? 
      ORDER BY created_at DESC
    `, [customerId]);
    
    // Get wallet balance
    const [wallet] = await db.query(`
      SELECT COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as balance
      FROM payment_requests 
      WHERE customer_id = ? AND status = 'approved'
    `, [customerId]);
    
    const [pendingPayments] = await db.query(`
      SELECT * FROM payment_requests 
      WHERE customer_id = ? AND status = 'pending'
      ORDER BY created_at DESC
    `, [customerId]);
    
    res.json({ 
      success: true, 
      payments, 
      wallet_balance: wallet[0]?.balance || 0,
      pending_payments: pendingPayments
    });
  } catch (error) {
    console.error('Error fetching customer payments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payments' });
  }
};

// Submit payment request (Customer)
const submitPaymentRequest = async (req, res) => {
  try {
    const { customer_id, amount, payment_method } = req.body;
    const screenshot_url = req.file ? `/uploads/payments/${req.file.filename}` : null;
    
    if (!screenshot_url) {
      return res.status(400).json({ success: false, error: 'Screenshot is required' });
    }
    
    const [result] = await db.query(`
      INSERT INTO payment_requests (customer_id, amount, payment_method, screenshot_url, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', NOW())
    `, [customer_id, amount, payment_method, screenshot_url]);
    
    res.json({ success: true, payment_id: result.insertId });
  } catch (error) {
    console.error('Error submitting payment:', error);
    res.status(500).json({ success: false, error: 'Failed to submit payment' });
  }
};

// Approve payment (Admin)
const approvePayment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const { paymentId } = req.params;
    
    const [payments] = await connection.query(
      'SELECT * FROM payment_requests WHERE id = ?',
      [paymentId]
    );
    
    if (payments.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    
    const payment = payments[0];
    
    await connection.query(
      'UPDATE payment_requests SET status = "approved", updated_at = NOW() WHERE id = ?',
      [paymentId]
    );
    
    await connection.query(`
      INSERT INTO wallet_transactions (customer_id, amount, type, reference_id, description, created_at)
      VALUES (?, ?, 'credit', ?, CONCAT('Payment approved - ID: ', ?), NOW())
    `, [payment.customer_id, payment.amount, paymentId, paymentId]);
    
    await connection.commit();
    
    res.json({ success: true, message: 'Payment approved and wallet credited' });
  } catch (error) {
    await connection.rollback();
    console.error('Error approving payment:', error);
    res.status(500).json({ success: false, error: 'Failed to approve payment' });
  } finally {
    connection.release();
  }
};

// Reject payment (Admin)
const rejectPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    await db.query(
      'UPDATE payment_requests SET status = "rejected", updated_at = NOW() WHERE id = ?',
      [paymentId]
    );
    
    res.json({ success: true, message: 'Payment rejected' });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({ success: false, error: 'Failed to reject payment' });
  }
};

// ==================== CUSTOMER BILLS ====================

// Get all customer bills (Admin)
const getAllCustomerBills = async (req, res) => {
  try {
    const [bills] = await db.query(`
      SELECT 
        c.id as customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        COALESCE((
          SELECT SUM(total_amount) FROM deliveries 
          WHERE customer_id = c.id 
          AND product_name = 'Milk' 
          AND status = 'delivered'
          AND MONTH(delivery_date) = MONTH(CURRENT_DATE())
          AND YEAR(delivery_date) = YEAR(CURRENT_DATE())
        ), 0) as milk_charges,
        COALESCE((
          SELECT SUM(total_amount) FROM deliveries 
          WHERE customer_id = c.id 
          AND product_name != 'Milk' 
          AND status = 'delivered'
          AND MONTH(delivery_date) = MONTH(CURRENT_DATE())
          AND YEAR(delivery_date) = YEAR(CURRENT_DATE())
        ), 0) as extra_charges,
        COALESCE((
          SELECT SUM(total_amount) FROM deliveries 
          WHERE customer_id = c.id 
          AND status = 'delivered'
          AND MONTH(delivery_date) = MONTH(CURRENT_DATE())
          AND YEAR(delivery_date) = YEAR(CURRENT_DATE())
        ), 0) as total_bill,
        COALESCE((
          SELECT SUM(amount) FROM payment_requests 
          WHERE customer_id = c.id AND status = 'approved'
        ), 0) as paid_amount,
        GREATEST(0, COALESCE((
          SELECT SUM(total_amount) FROM deliveries 
          WHERE customer_id = c.id 
          AND status = 'delivered'
          AND MONTH(delivery_date) = MONTH(CURRENT_DATE())
          AND YEAR(delivery_date) = YEAR(CURRENT_DATE())
        ), 0) - COALESCE((
          SELECT SUM(amount) FROM payment_requests 
          WHERE customer_id = c.id AND status = 'approved'
        ), 0)) as pending_amount,
        COALESCE((
          SELECT SUM(amount) FROM wallet_transactions 
          WHERE customer_id = c.id AND type = 'credit'
        ), 0) - COALESCE((
          SELECT SUM(amount) FROM wallet_transactions 
          WHERE customer_id = c.id AND type = 'debit'
        ), 0) as wallet_balance
      FROM customers c
      ORDER BY c.name
    `);
    
    res.json({ success: true, bills });
  } catch (error) {
    console.error('Error fetching customer bills:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bills' });
  }
};

// ==================== MANUAL PAYMENT ADJUSTMENT ====================

// Manual payment adjustment (Admin)
const manualPaymentAdjustment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const { customer_id, amount, reason, payment_date } = req.body;
    
    const [result] = await connection.query(`
      INSERT INTO payment_requests (customer_id, amount, payment_method, status, reference, created_at)
      VALUES (?, ?, 'manual', 'approved', ?, ?)
    `, [customer_id, amount, reason || 'Manual adjustment', payment_date]);
    
    await connection.query(`
      INSERT INTO wallet_transactions (customer_id, amount, type, reference_id, description, created_at)
      VALUES (?, ?, 'credit', ?, ?, ?)
    `, [customer_id, amount, result.insertId, reason || 'Manual payment adjustment', payment_date]);
    
    await connection.commit();
    
    res.json({ success: true, message: 'Manual payment adjustment completed' });
  } catch (error) {
    await connection.rollback();
    console.error('Error processing manual payment:', error);
    res.status(500).json({ success: false, error: 'Failed to process manual payment' });
  } finally {
    connection.release();
  }
};

// ==================== PAYMENT SETTINGS ====================

// Get payment settings
const getPaymentSettings = async (req, res) => {
  try {
    const [settings] = await db.query(`SELECT * FROM payment_settings WHERE id = 1`);
    
    if (settings.length === 0) {
      return res.json({ 
        success: true, 
        settings: {
          bank_name: '',
          account_name: '',
          account_number: '',
          ifsc_code: '',
          upi_id: '',
          qr_code_url: '',
          contact_number: ''
        }
      });
    }
    
    res.json({ success: true, settings: settings[0] });
  } catch (error) {
    console.error('Error fetching payment settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
};

// Update payment settings
const updatePaymentSettings = async (req, res) => {
  try {
    const { bank_name, account_name, account_number, ifsc_code, upi_id, qr_code_url, contact_number } = req.body;
    
    const [existing] = await db.query(`SELECT * FROM payment_settings WHERE id = 1`);
    
    if (existing.length === 0) {
      await db.query(`
        INSERT INTO payment_settings (id, bank_name, account_name, account_number, ifsc_code, upi_id, qr_code_url, contact_number)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      `, [bank_name, account_name, account_number, ifsc_code, upi_id, qr_code_url, contact_number]);
    } else {
      await db.query(`
        UPDATE payment_settings 
        SET bank_name = ?, account_name = ?, account_number = ?, ifsc_code = ?, 
            upi_id = ?, qr_code_url = ?, contact_number = ?, updated_at = NOW()
        WHERE id = 1
      `, [bank_name, account_name, account_number, ifsc_code, upi_id, qr_code_url, contact_number]);
    }
    
    res.json({ success: true, message: 'Payment settings updated' });
  } catch (error) {
    console.error('Error updating payment settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
};

// ==================== SKIP MANAGEMENT ====================

// Get skip records
const getSkipRecords = async (req, res) => {
  try {
    const [skips] = await db.query(`
      SELECT s.*, c.name as customer_name, c.phone as customer_phone
      FROM customer_skips s
      JOIN customers c ON s.customer_id = c.id
      ORDER BY s.created_at DESC
    `);
    res.json({ success: true, records: skips });
  } catch (error) {
    console.error('Error fetching skip records:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch skip records' });
  }
};

// Add manual skip
const addManualSkip = async (req, res) => {
  try {
    const { customer_id, start_date, end_date, reason, skip_type } = req.body;
    
    const [result] = await db.query(`
      INSERT INTO customer_skips (customer_id, start_date, end_date, reason, skip_type, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', NOW())
    `, [customer_id, start_date, end_date || start_date, reason, skip_type]);
    
    // Also update customer preferences
    const [prefExists] = await db.query(`SELECT * FROM customer_preferences WHERE customer_id = ?`, [customer_id]);
    
    if (prefExists.length > 0) {
      let currentSkips = prefExists[0].skip_days || [];
      if (typeof currentSkips === 'string') {
        try { currentSkips = JSON.parse(currentSkips); } catch(e) { currentSkips = []; }
      }
      
      const datesToAdd = [];
      let currentDate = new Date(start_date);
      const endDateObj = new Date(end_date || start_date);
      
      while (currentDate <= endDateObj) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (!currentSkips.includes(dateStr)) {
          datesToAdd.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      const updatedSkips = [...currentSkips, ...datesToAdd];
      
      await db.query(`
        UPDATE customer_preferences 
        SET skip_days = ? 
        WHERE customer_id = ?
      `, [JSON.stringify(updatedSkips), customer_id]);
    }
    
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error adding manual skip:', error);
    res.status(500).json({ success: false, error: 'Failed to add skip' });
  }
};

// Cancel skip
const cancelSkip = async (req, res) => {
  try {
    const { skipId } = req.params;
    
    // Get skip details first
    const [skip] = await db.query(`SELECT * FROM customer_skips WHERE id = ?`, [skipId]);
    
    if (skip.length > 0) {
      // Remove from customer preferences
      const [pref] = await db.query(`SELECT * FROM customer_preferences WHERE customer_id = ?`, [skip[0].customer_id]);
      
      if (pref.length > 0) {
        let currentSkips = pref[0].skip_days || [];
        if (typeof currentSkips === 'string') {
          try { currentSkips = JSON.parse(currentSkips); } catch(e) { currentSkips = []; }
        }
        
        const updatedSkips = currentSkips.filter(d => d !== skip[0].start_date);
        
        await db.query(`
          UPDATE customer_preferences 
          SET skip_days = ? 
          WHERE customer_id = ?
        `, [JSON.stringify(updatedSkips), skip[0].customer_id]);
      }
    }
    
    await db.query(`UPDATE customer_skips SET status = 'cancelled', updated_at = NOW() WHERE id = ?`, [skipId]);
    
    res.json({ success: true, message: 'Skip cancelled' });
  } catch (error) {
    console.error('Error cancelling skip:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel skip' });
  }
};

module.exports = {
  getAllPayments,
  getCustomerPayments,
  submitPaymentRequest,
  approvePayment,
  rejectPayment,
  getAllCustomerBills,
  manualPaymentAdjustment,
  getPaymentSettings,
  updatePaymentSettings,
  getSkipRecords,
  addManualSkip,
  cancelSkip
};