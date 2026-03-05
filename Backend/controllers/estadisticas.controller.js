const {
  GetEstadisticasInventarioUseCase,
} = require('../../../application/usecases/estadisticas.usecases');

let usecases = {};

exports.init = (estadisticasRepository) => {
  usecases = {
    getEstadisticasInventario: new GetEstadisticasInventarioUseCase(estadisticasRepository),
  };
};

// GET /api/v1/estadisticas/inventario
exports.getEstadisticasInventario = async (req, res, next) => {
  try {
    const estadisticas = await usecases.getEstadisticasInventario.execute();
    res.json(estadisticas);
  } catch (error) {
    next(error);
  }
};
