// routes/customerPreferences.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/customerPreferences');
const { verifyToken, isAdmin, isAdminOrSelf } = require('../middleware/auth');

// Admin only routes
router.get('/all/list', verifyToken, isAdmin, controller.getAllPreferences);
router.get('/extra-orders/all', verifyToken, isAdmin, controller.getAllExtraOrders);

// Routes accessible by admin OR the customer themselves
router.get('/:customerId', verifyToken, isAdminOrSelf, controller.getPreferences);
router.post('/:customerId', verifyToken, isAdminOrSelf, controller.savePreferences);

// ✅ NEW: Get extra orders for delivery boy's assigned customers only
router.get('/delivery-boy/:delivery_boy_id/extra-orders', verifyToken, controller.getDeliveryBoyExtraOrders);

// ✅ NEW: Get preferences for delivery boy's assigned customers
router.get('/delivery-boy/:delivery_boy_id/assigned', verifyToken, controller.getDeliveryBoyAssignedPreferences);

module.exports = router;