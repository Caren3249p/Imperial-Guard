// routes/estadisticas.routes.js
const express = require('express');
const router = express.Router();
const estadisticasController = require('../controllers/estadisticas.controller');

// Ruta para estadísticas del inventario
router.get('/inventario', estadisticasController.getEstadisticasInventario);

module.exports = router;