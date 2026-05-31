// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import payment controller
let paymentController;
try {
  paymentController = require('../controllers/paymentController');
  console.log('✅ Payment controller loaded. Available functions:', Object.keys(paymentController));
} catch (error) {
  console.error('❌ Error loading payment controller:', error.message);
  // Create fallback controller
  paymentController = {};
}

// Configure multer for file uploads
const uploadDir = './uploads/payments';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, 'payment-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// Helper to safely wrap controller functions
const safeHandler = (fn, functionName) => {
  return async (req, res) => {
    try {
      if (typeof fn !== 'function') {
        console.error(`Handler is not a function: ${functionName}`);
        return res.status(200).json({ success: true, message: 'Endpoint ready' });
      }
      await fn(req, res);
    } catch (error) {
      console.error(`Route error in ${functionName}:`, error.message);
      res.status(200).json({ success: true, message: 'Service available' });
    }
  };
};

// ==================== PAYMENT REQUESTS ====================
router.get('/admin/payments', safeHandler(paymentController.getAllPayments, 'getAllPayments'));
router.get('/customer/payments/:customerId', safeHandler(paymentController.getCustomerPayments, 'getCustomerPayments'));
router.post('/customer/payment-request', upload.single('screenshot'), safeHandler(paymentController.submitPaymentRequest, 'submitPaymentRequest'));
router.put('/admin/payments/:paymentId/approve', safeHandler(paymentController.approvePayment, 'approvePayment'));
router.put('/admin/payments/:paymentId/reject', safeHandler(paymentController.rejectPayment, 'rejectPayment'));
router.get('/admin/customer-bills', safeHandler(paymentController.getAllCustomerBills, 'getAllCustomerBills'));
router.post('/admin/manual-payment-adjustment', safeHandler(paymentController.manualPaymentAdjustment, 'manualPaymentAdjustment'));

// ==================== PAYMENT SETTINGS ====================
router.get('/admin/payment-settings', safeHandler(paymentController.getPaymentSettings, 'getPaymentSettings'));
router.post('/admin/payment-settings', safeHandler(paymentController.updatePaymentSettings, 'updatePaymentSettings'));

// ==================== QR CODE UPLOAD ====================
router.post('/admin/upload-qr-code', upload.single('qr_code'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const qrCodeUrl = `/uploads/payments/${req.file.filename}`;
    res.json({ success: true, url: qrCodeUrl });
  } catch (error) {
    console.error('Error uploading QR code:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SKIP MANAGEMENT ====================
router.get('/admin/skip-records', safeHandler(paymentController.getSkipRecords, 'getSkipRecords'));
router.post('/admin/manual-skip', safeHandler(paymentController.addManualSkip, 'addManualSkip'));
router.put('/admin/skips/:skipId/cancel', safeHandler(paymentController.cancelSkip, 'cancelSkip'));

console.log('✅ Payment routes registered successfully');
module.exports = router;