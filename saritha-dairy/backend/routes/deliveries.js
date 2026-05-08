// routes/deliveries.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken, isAdmin } = require('../middleware/auth');
const pool = require('../config/db');

// Delivery routes
router.post('/record', verifyToken, customerController.recordDelivery);
router.get('/today/:delivery_boy_id', verifyToken, customerController.getTodayDeliveries);
router.delete('/:id', verifyToken, customerController.deleteDelivery);

// ✅ Customer route - get their own deliveries
router.get('/customer/:customerId', verifyToken, async (req, res) => {
  const { customerId } = req.params;
  
  // Security: Customer can only access their own deliveries
  if (req.user.role !== 'admin' && req.user.id !== parseInt(customerId)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const result = await pool.query(`
      SELECT * FROM daily_delivery 
      WHERE customer_id = $1 
      ORDER BY delivery_date DESC, created_at DESC
    `, [customerId]);
    
    res.json({ success: true, deliveries: result.rows });
  } catch (error) {
    console.error('Error fetching customer deliveries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin only routes
router.get('/all', verifyToken, isAdmin, customerController.getAllDeliveries);
router.get('/by-date', verifyToken, isAdmin, customerController.getDeliveriesByDateRange);
router.get('/summary', verifyToken, isAdmin, customerController.getDeliverySummary);

module.exports = router;