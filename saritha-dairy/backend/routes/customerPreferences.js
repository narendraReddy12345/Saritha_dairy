// routes/customerPreferences.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/customerPreferences');
const { verifyToken, isAdmin, isAdminOrSelf } = require('../middleware/auth');

// Admin only routes
router.get('/all/list', verifyToken, isAdmin, controller.getAllPreferences);
router.get('/extra-orders/all', verifyToken, isAdmin, controller.getAllExtraOrders);

// Customer self-access routes (can access their own data)
router.get('/:customerId', verifyToken, isAdminOrSelf, controller.getPreferences);
router.post('/:customerId', verifyToken, isAdminOrSelf, controller.savePreferences);

// Delivery boy routes
router.get('/delivery-boy/:delivery_boy_id/extra-orders', verifyToken, controller.getDeliveryBoyExtraOrders);
router.get('/delivery-boy/:delivery_boy_id/assigned', verifyToken, controller.getDeliveryBoyAssignedPreferences);

// Mark specific extra order as delivered
router.patch('/:customerId/extra-order/:orderId/deliver', verifyToken, controller.markExtraOrderDelivered);

module.exports = router;