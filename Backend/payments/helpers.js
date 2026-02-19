'use strict';

/**
 * Crea errores de negocio estructurados.
 * isOperational = true → el errorHandler los trata como errores controlados.
 */
function createError(code, message, statusCode = 400, meta = null) {
  const err         = new Error(message);
  err.code          = code;
  err.statusCode    = statusCode;
  err.isOperational = true;
  if (meta) err.meta = meta;
  return err;
}

/**
 * Logger estructurado JSON.
 * En producción reemplazar con Winston/Pino.
 */
function log(level, message, data = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  }));
}

// Disponibles globalmente en el módulo de pagos
global.createError = createError;
global.log         = log;

module.exports = { createError, log };