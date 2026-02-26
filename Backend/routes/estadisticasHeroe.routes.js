const express = require('express');
const router = express.Router();
const estadisticasHeroeController = require('../controllers/estadisticasHeroe.controller');

router.get('/heroes', estadisticasHeroeController.getHeroes);
router.get('/heroe/:heroeId', estadisticasHeroeController.getEstadisticasHeroe);
router.get('/comparativa', estadisticasHeroeController.getComparativaHeroes);
router.post('/equipar', estadisticasHeroeController.equiparProducto);

module.exports = router;