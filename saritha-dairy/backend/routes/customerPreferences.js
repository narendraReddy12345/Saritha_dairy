const express = require('express');
const router = express.Router();
const controller = require('../controllers/customerPreferences');

router.get('/all/list', controller.getAllPreferences);
router.get('/extra-orders/all', controller.getAllExtraOrders);
router.get('/:customerId', controller.getPreferences);
router.post('/:customerId', controller.savePreferences);

module.exports = router;