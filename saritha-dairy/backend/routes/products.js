const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/productController');
const { verifyToken } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.get('/', verifyToken, ctrl.getAll);
router.post('/', verifyToken, upload.single('image'), ctrl.create);
router.put('/:id', verifyToken, upload.single('image'), ctrl.update);
router.delete('/:id', verifyToken, ctrl.remove);

module.exports = router;