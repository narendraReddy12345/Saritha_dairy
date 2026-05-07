// routes/nonDairyItemsRoutes.js
const express = require('express');
const router = express.Router();
const nonDairyItemsController = require('../controllers/nonDairyItemsController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// All routes require authentication and admin access
router.use(verifyToken);
router.use(isAdmin);

// Product routes with image upload
router.get('/non-dairy-items', nonDairyItemsController.getAllItems);
router.post('/non-dairy-items', nonDairyItemsController.uploadImage, nonDairyItemsController.addProduct);
router.put('/non-dairy-items/:id', nonDairyItemsController.updateProduct);
router.delete('/non-dairy-items/:id', nonDairyItemsController.deleteProduct);

// Stock purchase
router.post('/non-dairy-items/purchase', nonDairyItemsController.addStock);

// History routes
router.get('/non-dairy-purchase-history', nonDairyItemsController.getPurchaseHistory);
router.delete('/non-dairy-purchase-history/:id', nonDairyItemsController.deletePurchaseRecord);

module.exports = router;