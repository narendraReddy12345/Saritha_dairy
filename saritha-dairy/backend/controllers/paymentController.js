// backend/controllers/paymentController.js
const pool = require('../config/db');

console.log('💰 Payment Controller Initializing...');

// Helper function to ensure tables exist
const ensurePaymentTables = async () => {
  try {
    // Check if payment_settings table exists
    const [tables] = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'payment_settings'
      ) as exists
    `);
    
    if (!tables[0].exists) {
      console.log('Creating payment_settings table...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS payment_settings (
          id INT PRIMARY KEY DEFAULT 1,
          bank_name VARCHAR(100),
          account_name VARCHAR(100),
          account_number VARCHAR(50),
          ifsc_code VARCHAR(20),
          upi_id VARCHAR(100),
          qr_code_url VARCHAR(500),
          contact_number VARCHAR(20),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Insert default settings
      await pool.query(`
        INSERT INTO payment_settings (id, bank_name, account_name, account_number, ifsc_code, upi_id, contact_number)
        VALUES (1, 'Your Bank Name', 'Saritha Dairy', 'XXXXXXXXXXXXXX', 'IFSC0001234', 'sarithadairy@okhdfcbank', '9398263810')
        ON CONFLICT (id) DO NOTHING
      `);
    }
  } catch (error) {
    console.error('Error ensuring payment tables:', error.message);
  }
};

// Call this on module load
ensurePaymentTables();

// ==================== PAYMENT REQUESTS ====================

// Get all payment requests (Admin)
const getAllPayments = async (req, res) => {
  try {
    const [payments] = await pool.query(`
      SELECT 
        p.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email
      FROM payment_requests p
      JOIN customers c ON p.customer_id = c.id
      ORDER BY p.created_at DESC
    `);
    
    res.json({ success: true, payments: payments || [] });
  } catch (error) {
    console.error('Error fetching payments:', error.message);
    res.json({ success: true, payments: [] });
  }
};

// Get customer payments (Customer)
const getCustomerPayments = async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const [payments] = await pool.query(`
      SELECT * FROM payment_requests 
      WHERE customer_id = ? 
      ORDER BY created_at DESC
    `, [customerId]);
    
    const [wallet] = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as balance
      FROM payment_requests 
      WHERE customer_id = ? AND status = 'approved'
    `, [customerId]);
    
    const [pendingPayments] = await pool.query(`
      SELECT * FROM payment_requests 
      WHERE customer_id = ? AND status = 'pending'
      ORDER BY created_at DESC
    `, [customerId]);
    
    res.json({ 
      success: true, 
      payments: payments || [], 
      wallet_balance: wallet[0]?.balance || 0,
      pending_payments: pendingPayments || []
    });
  } catch (error) {
    console.error('Error fetching customer payments:', error.message);
    res.json({ success: true, payments: [], wallet_balance: 0, pending_payments: [] });
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
    
    const [result] = await pool.query(`
      INSERT INTO payment_requests (customer_id, amount, payment_method, screenshot_url, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', NOW())
    `, [customer_id, amount, payment_method, screenshot_url]);
    
    res.json({ success: true, payment_id: result.insertId });
  } catch (error) {
    console.error('Error submitting payment:', error.message);
    res.status(500).json({ success: false, error: 'Failed to submit payment' });
  }
};

// Approve payment (Admin)
const approvePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const [payments] = await pool.query('SELECT * FROM payment_requests WHERE id = ?', [paymentId]);
    
    if (payments.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    
    const payment = payments[0];
    
    await pool.query('UPDATE payment_requests SET status = "approved", updated_at = NOW() WHERE id = ?', [paymentId]);
    
    await pool.query(`
      INSERT INTO wallet_transactions (customer_id, amount, type, reference_id, description, created_at)
      VALUES (?, ?, 'credit', ?, CONCAT('Payment approved - ID: ', ?), NOW())
    `, [payment.customer_id, payment.amount, paymentId, paymentId]);
    
    res.json({ success: true, message: 'Payment approved and wallet credited' });
  } catch (error) {
    console.error('Error approving payment:', error.message);
    res.status(500).json({ success: false, error: 'Failed to approve payment' });
  }
};

// Reject payment (Admin)
const rejectPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    await pool.query('UPDATE payment_requests SET status = "rejected", updated_at = NOW() WHERE id = ?', [paymentId]);
    
    res.json({ success: true, message: 'Payment rejected' });
  } catch (error) {
    console.error('Error rejecting payment:', error.message);
    res.status(500).json({ success: false, error: 'Failed to reject payment' });
  }
};

// Get all customer bills (Admin)
const getAllCustomerBills = async (req, res) => {
  try {
    const [bills] = await pool.query(`
      SELECT 
        c.id as customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        COALESCE((
          SELECT SUM(total_amount) FROM daily_delivery 
          WHERE customer_id = c.id 
          AND status = 'delivered'
          AND DATE_FORMAT(delivery_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m')
        ), 0) as total_bill,
        COALESCE((
          SELECT SUM(amount) FROM payment_requests 
          WHERE customer_id = c.id AND status = 'approved'
        ), 0) as paid_amount,
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
    
    res.json({ success: true, bills: bills || [] });
  } catch (error) {
    console.error('Error fetching customer bills:', error.message);
    res.json({ success: true, bills: [] });
  }
};

// Manual payment adjustment (Admin)
const manualPaymentAdjustment = async (req, res) => {
  try {
    const { customer_id, amount, reason, payment_date } = req.body;
    
    const [result] = await pool.query(`
      INSERT INTO payment_requests (customer_id, amount, payment_method, status, reference, created_at)
      VALUES (?, ?, 'manual', 'approved', ?, ?)
    `, [customer_id, amount, reason || 'Manual adjustment', payment_date]);
    
    await pool.query(`
      INSERT INTO wallet_transactions (customer_id, amount, type, reference_id, description, created_at)
      VALUES (?, ?, 'credit', ?, ?, ?)
    `, [customer_id, amount, result.insertId, reason || 'Manual payment adjustment', payment_date]);
    
    res.json({ success: true, message: 'Manual payment adjustment completed' });
  } catch (error) {
    console.error('Error processing manual payment:', error.message);
    res.status(500).json({ success: false, error: 'Failed to process manual payment' });
  }
};

// Get payment settings - FIXED
const getPaymentSettings = async (req, res) => {
  try {
    // First ensure table exists
    await ensurePaymentTables();
    
    const [settings] = await pool.query(`SELECT * FROM payment_settings WHERE id = 1`);
    
    if (!settings || settings.length === 0) {
      return res.json({ 
        success: true, 
        settings: {
          bank_name: 'Your Bank Name',
          account_name: 'Saritha Dairy',
          account_number: 'XXXXXXXXXXXXXX',
          ifsc_code: 'IFSC0001234',
          upi_id: 'sarithadairy@okhdfcbank',
          qr_code_url: '',
          contact_number: '9398263810'
        }
      });
    }
    
    res.json({ success: true, settings: settings[0] });
  } catch (error) {
    console.error('Error fetching payment settings:', error.message);
    // Return default settings on error
    res.json({ 
      success: true, 
      settings: {
        bank_name: 'Your Bank Name',
        account_name: 'Saritha Dairy',
        account_number: 'XXXXXXXXXXXXXX',
        ifsc_code: 'IFSC0001234',
        upi_id: 'sarithadairy@okhdfcbank',
        qr_code_url: '',
        contact_number: '9398263810'
      }
    });
  }
};

// Update payment settings - FIXED
const updatePaymentSettings = async (req, res) => {
  try {
    const { bank_name, account_name, account_number, ifsc_code, upi_id, qr_code_url, contact_number } = req.body;
    
    console.log('Updating payment settings:', { bank_name, account_name, account_number, ifsc_code, upi_id });
    
    // First ensure table exists
    await ensurePaymentTables();
    
    // Check if record exists
    const [existing] = await pool.query(`SELECT * FROM payment_settings WHERE id = 1`);
    
    if (!existing || existing.length === 0) {
      // Insert new record
      await pool.query(`
        INSERT INTO payment_settings (id, bank_name, account_name, account_number, ifsc_code, upi_id, qr_code_url, contact_number, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [bank_name || '', account_name || '', account_number || '', ifsc_code || '', upi_id || '', qr_code_url || '', contact_number || '']);
    } else {
      // Update existing record
      await pool.query(`
        UPDATE payment_settings 
        SET bank_name = ?, account_name = ?, account_number = ?, ifsc_code = ?, 
            upi_id = ?, qr_code_url = ?, contact_number = ?, updated_at = NOW()
        WHERE id = 1
      `, [bank_name || '', account_name || '', account_number || '', ifsc_code || '', upi_id || '', qr_code_url || '', contact_number || '']);
    }
    
    res.json({ success: true, message: 'Payment settings updated successfully' });
  } catch (error) {
    console.error('Error updating payment settings:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get skip records
const getSkipRecords = async (req, res) => {
  try {
    const [skips] = await pool.query(`
      SELECT s.*, c.name as customer_name, c.phone as customer_phone
      FROM customer_skips s
      JOIN customers c ON s.customer_id = c.id
      ORDER BY s.created_at DESC
    `);
    res.json({ success: true, records: skips || [] });
  } catch (error) {
    console.error('Error fetching skip records:', error.message);
    res.json({ success: true, records: [] });
  }
};

// Add manual skip
const addManualSkip = async (req, res) => {
  try {
    const { customer_id, start_date, end_date, reason, skip_type } = req.body;
    
    const [result] = await pool.query(`
      INSERT INTO customer_skips (customer_id, start_date, end_date, reason, skip_type, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', NOW())
    `, [customer_id, start_date, end_date || start_date, reason, skip_type]);
    
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error adding manual skip:', error.message);
    res.status(500).json({ success: false, error: 'Failed to add skip' });
  }
};

// Cancel skip
const cancelSkip = async (req, res) => {
  try {
    const { skipId } = req.params;
    await pool.query(`UPDATE customer_skips SET status = 'cancelled', updated_at = NOW() WHERE id = ?`, [skipId]);
    res.json({ success: true, message: 'Skip cancelled' });
  } catch (error) {
    console.error('Error cancelling skip:', error.message);
    res.status(500).json({ success: false, error: 'Failed to cancel skip' });
  }
};

// Export all functions
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