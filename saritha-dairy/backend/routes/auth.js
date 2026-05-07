// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Public routes
router.post('/admin/login', authController.adminLogin);
router.post('/admin/login-phone', authController.adminLoginPhone);
router.post('/delivery/login', authController.deliveryBoyLogin);
router.post('/customer/login', authController.customerLogin);
router.post('/change-password', authController.changePassword);

// Protected routes
router.get('/verify', verifyToken, authController.verifyToken);

module.exports = router;