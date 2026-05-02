// routes/auth.js
const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/admin-login', ctrl.adminLogin);
router.post('/admin-login-phone', ctrl.adminLoginPhone);
router.post('/delivery-login', ctrl.deliveryBoyLogin);
router.post('/customer-login', ctrl.customerLogin);           // ✅ Customer login
router.post('/change-password', verifyToken, ctrl.changePassword); // ✅ Change password
router.get('/verify-token', verifyToken, ctrl.verifyToken);

module.exports = router;