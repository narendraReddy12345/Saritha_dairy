// routes/deliveryBoys.js
const router = require('express').Router();
const ctrl = require('../controllers/deliveryBoyController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ✅ Admin only routes - make sure all these functions exist
router.get('/', verifyToken, isAdmin, ctrl.getAll);
router.post('/', verifyToken, isAdmin, ctrl.create);
router.put('/:id', verifyToken, isAdmin, ctrl.update);
router.delete('/:id', verifyToken, isAdmin, ctrl.remove);
router.patch('/:id/status', verifyToken, isAdmin, ctrl.toggleStatus);  // This should exist
router.post('/:id/assign-customers', verifyToken, isAdmin, ctrl.assignCustomers);

// ✅ DELIVERY BOYS ACCESS
router.get('/:id/customers', verifyToken, ctrl.getAssignedCustomers);  // This should exist

module.exports = router;