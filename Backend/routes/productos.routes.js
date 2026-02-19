const express = require('express');
const router = express.Router();
const controller = require('../controllers/productos.controller');

router.get('/', controller.getProductos);
router.post('/', controller.createProducto);
router.put('/:id', controller.updateProducto);   // Actualizar producto por ID
router.delete('/:id', controller.deleteProducto);

module.exports = router;
