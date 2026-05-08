// routes/customerPreferences.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/customerPreferences');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/all/list', verifyToken, isAdmin, controller.getAllPreferences);
router.get('/extra-orders/all', verifyToken, isAdmin, controller.getAllExtraOrders);
router.get('/:customerId', verifyToken, controller.getPreferences);
router.post('/:customerId', verifyToken, controller.savePreferences);

module.exports = router;