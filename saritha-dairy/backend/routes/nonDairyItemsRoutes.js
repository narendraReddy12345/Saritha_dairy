// routes/nonDairyItemsRoutes.js
const express = require('express');
const router = express.Router();
const nonDairyItemsController = require('../controllers/nonDairyItemsController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Product management
router.get('/non-dairy-items', nonDairyItemsController.getAllItems);
router.post('/non-dairy-items', nonDairyItemsController.addProduct);
router.put('/non-dairy-items/:id', nonDairyItemsController.updateProduct);
router.delete('/non-dairy-items/:id', nonDairyItemsController.deleteProduct);

// Stock management
router.post('/non-dairy-items/purchase', nonDairyItemsController.addStock);

// History/reports
router.get('/non-dairy-purchase-history', nonDairyItemsController.getAllPurchaseHistory);
router.get('/non-dairy-purchase-history/:productId', nonDairyItemsController.getPurchaseHistory);

module.exports = router;