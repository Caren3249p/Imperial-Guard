const express = require('express');
const router = express.Router();
const estadisticasController = require('../controllers/estadisticas.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/authorization.middleware');


router.get(
  '/inventario',
  authMiddleware,
  requireRole('ADMIN'),
  estadisticasController.getEstadisticasInventario
);

module.exports = router;
