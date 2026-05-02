// routes/credit.js
const router = require('express').Router();
const ctrl = require('../controllers/creditController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, ctrl.getAll);
router.post('/', verifyToken, isAdmin, ctrl.create);
router.put('/:id', verifyToken, isAdmin, ctrl.update);
router.delete('/:id', verifyToken, isAdmin, ctrl.remove);
router.post('/:id/settlement', verifyToken, isAdmin, ctrl.addSettlement);

module.exports = router;