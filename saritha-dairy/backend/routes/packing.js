const router = require('express').Router();
const ctrl = require('../controllers/packingController');
const { verifyToken } = require('../middleware/auth');

router.post('/pack-products', verifyToken, ctrl.create);
router.get('/packing-history', verifyToken, ctrl.getHistory);
router.delete('/packing-history/:id', verifyToken, ctrl.remove);

module.exports = router;