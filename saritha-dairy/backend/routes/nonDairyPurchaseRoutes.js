// routes/nonDairyPurchaseRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllNonDairyPurchases,
  getNonDairyPurchaseById,
  createNonDairyPurchase,
  updateNonDairyPurchase,
  deleteNonDairyPurchase,
  getNonDairyStock
} = require('../controllers/nonDairyPurchaseController');

const { authenticateToken } = require('../middleware/auth'); // Your auth middleware

// All routes require authentication
router.use(authenticateToken);

// Purchase routes
router.get('/non-dairy-purchases', getAllNonDairyPurchases);
router.get('/non-dairy-purchases/:id', getNonDairyPurchaseById);
router.post('/non-dairy-purchases', createNonDairyPurchase);
router.put('/non-dairy-purchases/:id', updateNonDairyPurchase);
router.delete('/non-dairy-purchases/:id', deleteNonDairyPurchase);

// Stock routes
router.get('/non-dairy-stock', getNonDairyStock);

module.exports = router;