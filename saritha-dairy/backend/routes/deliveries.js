// routes/deliveries.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken, isAdminOrSelf } = require('../middleware/auth');

router.post('/record', verifyToken, customerController.recordDelivery);
router.get('/today/:delivery_boy_id', verifyToken, isAdminOrSelf, customerController.getTodayDeliveries);
router.delete('/:id', verifyToken, customerController.deleteDelivery);

module.exports = router;