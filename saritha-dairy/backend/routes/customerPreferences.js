const express = require('express');
const router = express.Router();
const controller = require('../controllers/customerPreferences');

// Get all preferences (for admin/delivery)
router.get('/all/list', controller.getAllPreferences);

// Get all extra orders (for admin/delivery)
router.get('/extra-orders/all', controller.getAllExtraOrders);

// Get single customer preferences
router.get('/:customerId', controller.getPreferences);

// Save/Update customer preferences
router.post('/:customerId', controller.savePreferences);

module.exports = router;