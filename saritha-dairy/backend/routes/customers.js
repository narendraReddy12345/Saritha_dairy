const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken } = require('../middleware/auth');

// Customer routes
router.get('/customers', verifyToken, customerController.getAll);
router.post('/customers', verifyToken, customerController.create);
router.put('/customers/:id', verifyToken, customerController.update);
router.delete('/customers/:id', verifyToken, customerController.remove);
router.get('/admin/customer-deliveries/:customerId', verifyToken, customerController.getDeliveries);
router.post('/daily-delivery', verifyToken, customerController.recordDelivery);

// Delivery routes
router.post('/delivery/record', verifyToken, customerController.recordDelivery);
router.get('/delivery/today/:delivery_boy_id', verifyToken, customerController.getTodayDeliveries);
router.delete('/delivery/:id', verifyToken, customerController.deleteDelivery);

module.exports = router;