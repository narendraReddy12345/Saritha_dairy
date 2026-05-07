// routes/deliveries.js
const router = require('express').Router();
const ctrl = require('../controllers/deliveryController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Make sure all these functions exist in your deliveryController
router.post('/record', verifyToken, ctrl.record);
router.get('/today/:boyId', verifyToken, ctrl.getToday);
router.get('/all', verifyToken, isAdmin, ctrl.getAll);
router.delete('/:id', verifyToken, isAdmin, ctrl.remove);
router.post('/bulk-delete', verifyToken, isAdmin, ctrl.bulkRemove);
router.patch('/:id/status', verifyToken, ctrl.updateStatus); // Add this if you have it

module.exports = router;