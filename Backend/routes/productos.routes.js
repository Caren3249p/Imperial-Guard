const express = require('express');
const router = express.Router();
const { z } = require('zod');
const controller = require('../controllers/productos.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/authorization.middleware');
const { validate } = require('../middlewares/validate.middleware');

// ─── Schemas Zod ────────────────────────────────────────────────────────────

const createProductoSchema = z.object({
  nombre:      z.string().min(1).max(255),
  descripcion: z.string().max(1000).optional(),
  precio:      z.number().positive(),
  categoria:   z.string().min(1).max(100),
  tiraje:      z.number().int().positive().optional(),
  premium:     z.boolean().optional().default(false),
});

const updateProductoSchema = z.object({
  nombre:      z.string().min(1).max(255).optional(),
  descripcion: z.string().max(1000).optional(), 
  precio:      z.number().positive().optional(),
  categoria:   z.string().min(1).max(100).optional(),
  tiraje:      z.number().int().positive().optional(),
  estado:      z.enum(['activo', 'suspendido']).optional(),
});

const suspenderReactivarSchema = z.object({
  reason: z.string().max(500).optional(),
});

const previsualizarMasivoSchema = z.object({
  product_ids: z.array(z.number().int().positive()).min(1),
  cambios: z.object({
    categoria:         z.string().max(100).optional(),
    estado:            z.enum(['activo', 'suspendido']).optional(),
    precio_porcentaje: z.number().optional(),
    precio_fijo:       z.number().positive().optional(),
    tiraje:            z.number().int().positive().optional(),
    premium:           z.boolean().optional(),
  }).refine(
    (c) => Object.keys(c).length > 0,
    { message: 'Debe especificar al menos un cambio' }
  ),
});

const aplicarMasivoSchema = previsualizarMasivoSchema.extend({
  confirmado: z.boolean().default(false),
});

// ─── Rutas ───────────────────────────────────────────────────────────────────

// GET /api/v1/productos — Público (lectura de catálogo)
router.get('/', controller.getProductos);

// POST /api/v1/productos — ADMIN requerido
router.post(
  '/',
  authMiddleware,
  requireRole('ADMIN'),
  validate(createProductoSchema),
  controller.createProducto
);

// PUT /api/v1/productos/:id — ADMIN requerido
router.put(
  '/:id',
  authMiddleware,
  requireRole('ADMIN'),
  validate(updateProductoSchema),
  controller.updateProducto
);

// DELETE /api/v1/productos/:id — ADMIN requerido
router.delete(
  '/:id',
  authMiddleware,
  requireRole('ADMIN'),
  controller.deleteProducto
);

// PATCH /api/v1/productos/:id/suspender — ADMIN requerido
router.patch(
  '/:id/suspender',
  authMiddleware,
  requireRole('ADMIN'),
  validate(suspenderReactivarSchema),
  controller.suspenderProducto
);

// PATCH /api/v1/productos/:id/reactivar — ADMIN requerido
router.patch(
  '/:id/reactivar',
  authMiddleware,
  requireRole('ADMIN'),
  validate(suspenderReactivarSchema),
  controller.reactivarProducto
);

// POST /api/v1/productos/masivo/previsualizar — ADMIN requerido
// NOTA: Esta ruta debe ir ANTES de /:id para evitar conflicto de parámetros.
router.post(
  '/masivo/previsualizar',
  authMiddleware,
  requireRole('ADMIN'),
  validate(previsualizarMasivoSchema),
  controller.previsualizarCambiosMasivos
);

// POST /api/v1/productos/masivo/aplicar — ADMIN requerido
router.post(
  '/masivo/aplicar',
  authMiddleware,
  requireRole('ADMIN'),
  validate(aplicarMasivoSchema),
  controller.aplicarCambiosMasivos
);

module.exports = router;
