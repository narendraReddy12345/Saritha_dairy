// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import payment controller
const paymentController = require('../controllers/paymentController');

// Check if controller loaded correctly
console.log('✅ Payment controller loaded. Available functions:', Object.keys(paymentController));

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
const safeHandler = (fn) => {
  return async (req, res) => {
    try {
      if (typeof fn !== 'function') {
        console.error(`Handler is not a function: ${fn}`);
        return res.status(500).json({ success: false, error: 'Endpoint not properly configured' });
      }
      await fn(req, res);
    } catch (error) {
      console.error('Route error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
};

// ==================== PAYMENT REQUESTS ====================
router.get('/admin/payments', safeHandler(paymentController.getAllPayments));
router.get('/customer/payments/:customerId', safeHandler(paymentController.getCustomerPayments));
router.post('/customer/payment-request', upload.single('screenshot'), safeHandler(paymentController.submitPaymentRequest));
router.put('/admin/payments/:paymentId/approve', safeHandler(paymentController.approvePayment));
router.put('/admin/payments/:paymentId/reject', safeHandler(paymentController.rejectPayment));
router.get('/admin/customer-bills', safeHandler(paymentController.getAllCustomerBills));
router.post('/admin/manual-payment-adjustment', safeHandler(paymentController.manualPaymentAdjustment));
router.get('/admin/payment-settings', safeHandler(paymentController.getPaymentSettings));
router.post('/admin/payment-settings', safeHandler(paymentController.updatePaymentSettings));
router.post('/admin/upload-qr-code', upload.single('qr_code'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    res.json({ success: true, url: `/uploads/payments/${req.file.filename}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get('/admin/skip-records', safeHandler(paymentController.getSkipRecords));
router.post('/admin/manual-skip', safeHandler(paymentController.addManualSkip));
router.put('/admin/skips/:skipId/cancel', safeHandler(paymentController.cancelSkip));

console.log('✅ Payment routes registered successfully');
module.exports = router;