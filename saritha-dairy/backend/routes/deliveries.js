// routes/deliveries.js
const router = require('express').Router();
const ctrl = require('../controllers/deliveryController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Anyone authenticated can record a delivery
router.post('/record', verifyToken, ctrl.record);

// Anyone authenticated can view today's deliveries
router.get('/today/:boyId', verifyToken, ctrl.getToday);

// ✅ Admin only - all deliveries
router.get('/all', verifyToken, isAdmin, ctrl.getAll);

module.exports = router;