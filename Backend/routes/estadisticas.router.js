// routes/estadisticasHeroe.routes.js
const express = require('express');
const router = express.Router();
const estadisticasHeroeController = require('../controllers/estadisticasHeroe.controller');

// Obtener lista de héroes
router.get('/heroes', estadisticasHeroeController.getHeroes);

// Obtener estadísticas detalladas de un héroe específico
router.get('/heroe/:heroeId', estadisticasHeroeController.getEstadisticasHeroe);

// Obtener comparativa entre todos los héroes
router.get('/comparativa', estadisticasHeroeController.getComparativaHeroes);

// Equipar/desequipar producto a héroe
router.post('/equipar', estadisticasHeroeController.equiparProducto);

module.exports = router;
