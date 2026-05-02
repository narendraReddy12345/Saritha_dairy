const router = require('express').Router();
const ctrl = require('../controllers/salesController');
const { verifyToken } = require('../middleware/auth');

router.post('/sales', verifyToken, ctrl.create);
router.get('/sales-history', verifyToken, ctrl.getHistory);
router.delete('/sales/:id', verifyToken, ctrl.remove);

module.exports = router;