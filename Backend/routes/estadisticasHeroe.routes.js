const express = require('express');
const router = express.Router();
const { z } = require('zod');
const estadisticasHeroeController = require('../controllers/estadisticasHeroe.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/authorization.middleware');
const { validate } = require('../middlewares/validate.middleware');


const equiparProductoSchema = z.object({
  heroeId:    z.string().uuid(),
  productoId: z.string().uuid(),
});

router.get('/heroes', estadisticasHeroeController.getHeroes);

router.get('/heroe/:heroeId', estadisticasHeroeController.getEstadisticasHeroe);

router.get('/comparativa', estadisticasHeroeController.getComparativaHeroes);

router.post(
  '/equipar',
  authMiddleware,
  requireRole('ADMIN'),
  validate(equiparProductoSchema),
  estadisticasHeroeController.equiparProducto
);

module.exports = router;
