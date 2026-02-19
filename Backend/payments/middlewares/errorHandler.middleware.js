'use strict';

function paymentsErrorHandler(err, req, res, next) {
  // Errores de negocio controlados
  if (err.isOperational) {
    log('warn', 'PaymentsError', {
      code: err.code, message: err.message,
      statusCode: err.statusCode, path: req.path,
    });
    return res.status(err.statusCode).json({
      success: false,
      error:   err.code,
      message: err.message,
      ...(err.meta ? { meta: err.meta } : {}),
    });
  }

  // Errores de validación Joi
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false, error: 'VALIDATION_ERROR', message: err.message,
    });
  }

  // Errores de pasarela
  if (err.gatewayError) {
    log('error', 'GatewayError', { err: err.message, gatewayError: err.gatewayError });
    return res.status(502).json({
      success: false, error: 'GATEWAY_ERROR',
      message: 'Error en la pasarela de pago. Intenta más tarde.',
    });
  }

  // Error interno no controlado
  log('error', 'UnhandledPaymentError', {
    err: err.message, stack: err.stack, path: req.path,
  });
  return res.status(500).json({
    success: false, error: 'INTERNAL_ERROR',
    message: 'Error interno del servidor',
  });
}

module.exports = paymentsErrorHandler;