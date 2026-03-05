const {
  GetProductosUseCase,
  CreateProductoUseCase,
  UpdateProductoUseCase,
  DeleteProductoUseCase,
  SuspenderProductoUseCase,
  ReactivarProductoUseCase,
  PrevisualizarCambiosMasivosUseCase,
  AplicarCambiosMasivosUseCase,
} = require('../../../application/usecases/productos.usecases');

// Los usecases se inicializan con el repositorio inyectado desde app.js
let usecases = {};

exports.init = (productosRepository) => {
  usecases = {
    getProductos:               new GetProductosUseCase(productosRepository),
    createProducto:             new CreateProductoUseCase(productosRepository),
    updateProducto:             new UpdateProductoUseCase(productosRepository),
    deleteProducto:             new DeleteProductoUseCase(productosRepository),
    suspenderProducto:          new SuspenderProductoUseCase(productosRepository),
    reactivarProducto:          new ReactivarProductoUseCase(productosRepository),
    previsualizarCambiosMasivos:new PrevisualizarCambiosMasivosUseCase(productosRepository),
    aplicarCambiosMasivos:      new AplicarCambiosMasivosUseCase(productosRepository),
  };
};

// GET /api/v1/productos
exports.getProductos = async (req, res, next) => {
  try {
    const productos = await usecases.getProductos.execute();
    res.json(productos);
  } catch (error) {
    next(error); // El error handler global convierte DomainError -> HTTP status
  }
};

// POST /api/v1/productos
// El schema Zod valida req.body ANTES de llegar aquí (ver ruta).
exports.createProducto = async (req, res, next) => {
  try {
    const result = await usecases.createProducto.execute(req.body);
    res.status(201).json({ message: 'Producto creado', id: result.id });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/productos/:id
exports.updateProducto = async (req, res, next) => {
  try {
    await usecases.updateProducto.execute(req.params.id, req.body);
    res.json({ message: 'Producto actualizado' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/productos/:id
exports.deleteProducto = async (req, res, next) => {
  try {
    await usecases.deleteProducto.execute(req.params.id);
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/productos/:id/suspender
exports.suspenderProducto = async (req, res, next) => {
  try {
    // req.user.id proviene del JWT middleware (obligatorio en esta ruta)
    const actorId = req.user.id;
    const result = await usecases.suspenderProducto.execute(req.params.id, {
      reason: req.body.reason,
      actorId,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/productos/:id/reactivar
exports.reactivarProducto = async (req, res, next) => {
  try {
    const actorId = req.user.id;
    const result = await usecases.reactivarProducto.execute(req.params.id, {
      reason: req.body.reason,
      actorId,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/productos/masivo/previsualizar
exports.previsualizarCambiosMasivos = async (req, res, next) => {
  try {
    const result = await usecases.previsualizarCambiosMasivos.execute(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/productos/masivo/aplicar
exports.aplicarCambiosMasivos = async (req, res, next) => {
  try {
    const result = await usecases.aplicarCambiosMasivos.execute(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
