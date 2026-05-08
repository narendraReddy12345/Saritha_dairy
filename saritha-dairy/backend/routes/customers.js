const router = require('express').Router();
const ctrl = require('../controllers/customerController');
const { verifyToken } = require('../middleware/auth');
router.get('/customers', verifyToken, ctrl.getAll);
router.post('/customers', verifyToken, ctrl.create);
router.put('/customers/:id', verifyToken, ctrl.update);
router.delete('/customers/:id', verifyToken, ctrl.remove);
router.get('/customer-deliveries/:customerId', verifyToken, ctrl.getDeliveries);
router.post('/daily-delivery', verifyToken, ctrl.recordDelivery);
// Add these routes
router.get('/delivery/today/:delivery_boy_id', verifyToken, customerController.getTodayDeliveries);
router.delete('/delivery/:id', verifyToken, customerController.deleteDelivery);
module.exports = router;