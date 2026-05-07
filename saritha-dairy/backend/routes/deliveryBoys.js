// routes/deliveryBoys.js
const router = require('express').Router();
const ctrl = require('../controllers/deliveryBoyController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ✅ Make sure all these functions exist in your controller
// Admin only routes
router.get('/', verifyToken, isAdmin, ctrl.getAll);
router.post('/', verifyToken, isAdmin, ctrl.create);
router.put('/:id', verifyToken, isAdmin, ctrl.update);
router.delete('/:id', verifyToken, isAdmin, ctrl.remove);
router.patch('/:id/status', verifyToken, isAdmin, ctrl.toggleStatus);
router.post('/:id/assign-customers', verifyToken, isAdmin, ctrl.assignCustomers);

// ✅ Delivery boy accessible route (no isAdmin)
router.get('/:id/customers', verifyToken, ctrl.getAssignedCustomers);

module.exports = router;