'use strict';

require('../helpers');  // Carga createError y log globales

const express            = require('express');
const router             = express.Router();
const paymentsController = require('./payments.controller');
const webhookController  = require('./webhook.controller');
const rateLimiter        = require('../middlewares/rateLimiter.middleware');
const antiFraud          = require('../middlewares/antiFraud.middleware');
const { idempotencyRequired } = require('../middlewares/idempotency.middleware');
const paymentsErrorHandler    = require('../middlewares/errorHandler.middleware');
const { validate, createOrderSchema, refundSchema } = require('../payments.validators');

// ── Middleware: capturar rawBody para verificación HMAC en webhooks ───────────
const captureRawBody = (req, res, buf) => { req.rawBody = buf; };

// ── Auth middleware placeholder (usa tu middleware existente) ─────────────────
// Reemplaza con tu middleware real que setea req.user
const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  next();
};

// ── Webhook (sin auth, con rawBody) ──────────────────────────────────────────
router.post(
  '/webhook',
  express.raw({ type: '*/*', verify: captureRawBody }),
  antiFraud,
  webhookController.handle.bind(webhookController)
);

// ── Rutas protegidas ──────────────────────────────────────────────────────────
router.use(express.json());
router.use(requireAuth);
router.use(rateLimiter());
router.use(antiFraud);

router.post(
  '/orders',
  idempotencyRequired,
  validate(createOrderSchema),
  paymentsController.createOrder.bind(paymentsController)
);

router.post(
  '/orders/:orderId/pay',
  paymentsController.processPayment.bind(paymentsController)
);

router.get(
  '/orders/:orderId',
  paymentsController.getOrderStatus.bind(paymentsController)
);

router.post(
  '/orders/:orderId/refund',
  validate(refundSchema),
  paymentsController.refundPayment.bind(paymentsController)
);

// ── Error handler local del módulo ────────────────────────────────────────────
router.use(paymentsErrorHandler);

module.exports = router;