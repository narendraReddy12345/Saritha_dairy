// routes/customerRoutes.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken } = require('../middleware/auth');

// Make sure verifyToken is defined
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// Customer routes
router.get('/admin/customers', verifyToken, customerController.getAll);
router.post('/admin/customers', verifyToken, customerController.create);
router.put('/admin/customers/:id', verifyToken, customerController.update);
router.delete('/admin/customers/:id', verifyToken, customerController.remove);
router.get('/admin/customer-deliveries/:customerId', verifyToken, customerController.getDeliveries);
router.post('/admin/daily-delivery', verifyToken, customerController.recordDelivery);

// Delivery routes
router.post('/delivery/record', verifyToken, customerController.recordDelivery);
router.get('/delivery/today/:delivery_boy_id', verifyToken, customerController.getTodayDeliveries);
router.delete('/delivery/:id', verifyToken, customerController.deleteDelivery);

module.exports = router;