const express = require('express');
const router = express.Router();
const controller = require('../../Imperial-Guard/Backend/controllers/productos.controller');

// Rutas existentes
router.get('/', controller.getProductos);
router.post('/', controller.createProducto);
router.put('/:id', controller.updateProducto);
router.delete('/:id', controller.deleteProducto);

// Nuevas rutas para gestión de estado (suspender/reactivar)
router.patch('/:id/suspender', controller.suspenderProducto);
router.patch('/:id/reactivar', controller.reactivarProducto);

// Nuevas rutas para gestión masiva
router.post('/masivo/previsualizar', controller.previsualizarCambiosMasivos);
router.post('/masivo/aplicar', controller.aplicarCambiosMasivos);

module.exports = router;
