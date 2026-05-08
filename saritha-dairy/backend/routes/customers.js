// routes/customers.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, customerController.getAll);
router.post('/', verifyToken, isAdmin, customerController.create);
router.put('/:id', verifyToken, isAdmin, customerController.update);
router.delete('/:id', verifyToken, isAdmin, customerController.remove);
router.get('/:customerId/deliveries', verifyToken, isAdmin, customerController.getDeliveries);
router.post('/daily-delivery', verifyToken, isAdmin, customerController.recordDelivery);

module.exports = router;