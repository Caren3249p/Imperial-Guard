'use strict';
const Joi = require('joi');

const createOrderSchema = Joi.object({
  productId:      Joi.string().uuid().required(),
  currency:       Joi.string().length(3).uppercase().required(),
  promoCode:      Joi.string().alphanum().max(32).optional(),
  countryCode:    Joi.string().length(2).uppercase().required(),
  idempotencyKey: Joi.string().min(16).max(128).required(),
  buyerInfo: Joi.object({
    email:      Joi.string().email().required(),
    name:       Joi.string().min(2).max(100).required(),
    documentId: Joi.string().max(50).optional(),
  }).required(),
});

const refundSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
  amount:  Joi.number().integer().positive().optional(), // null = reembolso total
  reason:  Joi.string().max(255).required(),
});

const webhookQuerySchema = Joi.object({
  gateway: Joi.string().valid('mercadopago', 'stripe', 'mock').required(),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({
      success: false,
      error:   'VALIDATION_ERROR',
      details: error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
    });
  }
  next();
};

module.exports = { createOrderSchema, refundSchema, webhookQuerySchema, validate };


