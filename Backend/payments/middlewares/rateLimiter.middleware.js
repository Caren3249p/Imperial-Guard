'use strict';

const { PAYMENT_LIMITS } = require('../payments.constants');

// Rate limiter en memoria (para producción usa Redis)
const store = new Map();

function rateLimiter(options = {}) {
  const windowMs = options.windowMs || PAYMENT_LIMITS.RATE_LIMIT_WINDOW_MS;
  const maxReq   = options.max      || PAYMENT_LIMITS.RATE_LIMIT_MAX_REQ;

  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now  = Date.now();

    let record = store.get(key);
    if (!record || now - record.windowStart > windowMs) {
      record = { count: 1, windowStart: now };
    } else {
      record.count++;
    }
    store.set(key, record);

    res.set('X-RateLimit-Limit', maxReq);
    res.set('X-RateLimit-Remaining', Math.max(0, maxReq - record.count));

    if (record.count > maxReq) {
      log('warn', 'RateLimiter: limit exceeded', { ip: req.ip, path: req.path });
      return res.status(429).json({
        success: false,
        error:   'RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas solicitudes. Intenta más tarde.',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    }
    next();
  };
}

module.exports = rateLimiter;