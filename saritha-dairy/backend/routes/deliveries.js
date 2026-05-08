// routes/deliveries.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Existing routes
router.post('/record', verifyToken, customerController.recordDelivery);
router.get('/today/:delivery_boy_id', verifyToken, customerController.getTodayDeliveries);
router.delete('/:id', verifyToken, customerController.deleteDelivery);

// ✅ NEW: Get all deliveries for admin
router.get('/all', verifyToken, isAdmin, customerController.getAllDeliveries);

module.exports = router;