// routes/customerRoutes.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken } = require('../middleware/auth'); // ✅ Import, don't redeclare

// Customer routes
router.get('/admin/customers', verifyToken, customerController.getAll);
router.post('/admin/customers', verifyToken, customerController.create);
router.put('/admin/customers/:id', verifyToken, customerController.update);
router.delete('/admin/customers/:id', verifyToken, customerController.remove);
router.get('/admin/customer-deliveries/:customerId', verifyToken, customerController.getDeliveries);
router.post('/admin/daily-delivery', verifyToken, customerController.recordDelivery);

// Delivery routes
router.post('/delivery/record', verifyToken, customerController.recordDelivery);
router.get('/delivery/today/:delivery_boy_id', verifyToken, customerController.getTodayDeliveries);
router.delete('/delivery/:id', verifyToken, customerController.deleteDelivery);

module.exports = router;