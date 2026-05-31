// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/payments';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ==================== PAYMENT REQUESTS ====================

// Get all payment requests (Admin only)
router.get('/admin/payments', authenticateToken, isAdmin, paymentController.getAllPayments);

// Get customer payments (Customer only)
router.get('/customer/payments/:customerId', authenticateToken, paymentController.getCustomerPayments);

// Submit payment request (Customer only)
router.post('/customer/payment-request', authenticateToken, upload.single('screenshot'), paymentController.submitPaymentRequest);

// Approve payment (Admin only)
router.put('/admin/payments/:paymentId/approve', authenticateToken, isAdmin, paymentController.approvePayment);

// Reject payment (Admin only)
router.put('/admin/payments/:paymentId/reject', authenticateToken, isAdmin, paymentController.rejectPayment);

// ==================== CUSTOMER BILLS ====================

// Get all customer bills (Admin only)
router.get('/admin/customer-bills', authenticateToken, isAdmin, paymentController.getAllCustomerBills);

// ==================== MANUAL PAYMENT ADJUSTMENT ====================

// Manual payment adjustment (Admin only)
router.post('/admin/manual-payment-adjustment', authenticateToken, isAdmin, paymentController.manualPaymentAdjustment);

// ==================== PAYMENT SETTINGS ====================

// Get payment settings (Admin only)
router.get('/admin/payment-settings', authenticateToken, isAdmin, paymentController.getPaymentSettings);

// Update payment settings (Admin only)
router.post('/admin/payment-settings', authenticateToken, isAdmin, paymentController.updatePaymentSettings);

// Upload QR Code (Admin only)
router.post('/admin/upload-qr-code', authenticateToken, isAdmin, upload.single('qr_code'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const qrCodeUrl = `/uploads/payments/${req.file.filename}`;
    res.json({ success: true, url: qrCodeUrl });
  } catch (error) {
    console.error('Error uploading QR code:', error);
    res.status(500).json({ success: false, error: 'Failed to upload QR code' });
  }
});

// ==================== SKIP MANAGEMENT ====================

// Get skip records (Admin only)
router.get('/admin/skip-records', authenticateToken, isAdmin, paymentController.getSkipRecords);

// Add manual skip (Admin only)
router.post('/admin/manual-skip', authenticateToken, isAdmin, paymentController.addManualSkip);

// Cancel skip (Admin only)
router.put('/admin/skips/:skipId/cancel', authenticateToken, isAdmin, paymentController.cancelSkip);

module.exports = router;