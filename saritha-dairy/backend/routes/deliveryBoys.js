// routes/deliveryBoys.js
const router = require('express').Router();
const ctrl = require('../controllers/deliveryBoyController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Get all delivery boys (admin only)
router.get('/', verifyToken, isAdmin, ctrl.getAll);
router.post('/', verifyToken, isAdmin, ctrl.create);
router.put('/:id', verifyToken, isAdmin, ctrl.update);
router.delete('/:id', verifyToken, isAdmin, ctrl.remove);
router.patch('/:id/status', verifyToken, isAdmin, ctrl.toggleStatus);
router.post('/:id/assign-customers', verifyToken, isAdmin, ctrl.assignCustomers);

// Get customers assigned to a specific delivery boy (delivery boy can access their own)
router.get('/:id/customers', verifyToken, ctrl.getAssignedCustomers);

module.exports = router;