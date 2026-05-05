const router = require('express').Router();
const ctrl = require('../controllers/productController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, ctrl.getAll);
router.post('/', verifyToken, ctrl.uploadImage, ctrl.create);
router.put('/:id', verifyToken, ctrl.uploadImage, ctrl.update);
router.delete('/:id', verifyToken, ctrl.remove);

module.exports = router;