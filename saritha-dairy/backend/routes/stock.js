const router = require('express').Router();
const ctrl = require('../controllers/stockController');
const { verifyToken } = require('../middleware/auth');

router.get('/store-stock', verifyToken, ctrl.getAll);
router.post('/sell-product', verifyToken, ctrl.sell);

module.exports = router;