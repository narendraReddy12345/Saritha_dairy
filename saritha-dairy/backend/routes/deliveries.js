const router = require('express').Router();
const ctrl = require('../controllers/deliveryController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Record a delivery
router.post('/record', verifyToken, ctrl.record);

// ✅ Update delivery status (mark as delivered/undelivered)
router.patch('/:id/status', verifyToken, ctrl.updateStatus);

// Get today's deliveries for a boy
router.get('/today/:boyId', verifyToken, ctrl.getToday);

// Admin only - all deliveries
router.get('/all', verifyToken, isAdmin, ctrl.getAll);

// Admin only - delete single delivery
router.delete('/:id', verifyToken, isAdmin, ctrl.remove);

// Admin only - bulk delete deliveries
router.post('/bulk-delete', verifyToken, isAdmin, ctrl.bulkRemove);

module.exports = router;