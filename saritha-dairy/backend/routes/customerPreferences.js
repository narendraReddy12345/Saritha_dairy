const express = require('express');
const router = express.Router();
const controller = require('../controllers/customerPreferences');

router.get('/:customerId', controller.getPreferences);
router.post('/:customerId', controller.savePreferences);
router.get('/all/list', controller.getAllPreferences);

module.exports = router;