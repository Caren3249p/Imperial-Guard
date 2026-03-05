const {
  GetHeroesUseCase,
  GetEstadisticasHeroeUseCase,
  GetComparativaHeroesUseCase,
  EquiparProductoUseCase,
} = require('../../../application/usecases/estadisticasHeroe.usecases');

let usecases = {};

exports.init = (heroesRepository) => {
  usecases = {
    getHeroes:              new GetHeroesUseCase(heroesRepository),
    getEstadisticasHeroe:   new GetEstadisticasHeroeUseCase(heroesRepository),
    getComparativaHeroes:   new GetComparativaHeroesUseCase(heroesRepository),
    equiparProducto:        new EquiparProductoUseCase(heroesRepository),
  };
};

// GET /api/v1/estadisticas/heroes
exports.getHeroes = async (req, res, next) => {
  try {
    const heroes = await usecases.getHeroes.execute();
    res.json(heroes);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/estadisticas/heroe/:heroeId
exports.getEstadisticasHeroe = async (req, res, next) => {
  try {
    const estadisticas = await usecases.getEstadisticasHeroe.execute(req.params.heroeId);
    res.json(estadisticas);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/estadisticas/comparativa
exports.getComparativaHeroes = async (req, res, next) => {
  try {
    const comparativa = await usecases.getComparativaHeroes.execute();
    res.json(comparativa);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/estadisticas/equipar
// req.body ya viene validado por Zod (ver ruta).
exports.equiparProducto = async (req, res, next) => {
  try {
    const result = await usecases.equiparProducto.execute(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
