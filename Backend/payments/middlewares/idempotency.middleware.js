'use strict';

function idempotencyRequired(req, res, next) {
  const key = req.headers['x-idempotency-key'] || req.body?.idempotencyKey;
  if (!key || key.length < 16) {
    return res.status(400).json({
      success: false,
      error:   'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Se requiere el header X-Idempotency-Key (mín. 16 caracteres)',
    });
  }
  req.body.idempotencyKey = key;
  next();
}

module.exports = { idempotencyRequired };