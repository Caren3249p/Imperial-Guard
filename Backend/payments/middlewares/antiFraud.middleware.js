'use strict';

// IPs bloqueadas (en producción: Redis/base de datos de fraude)
const BLOCKED_IPS = new Set((process.env.FRAUD_BLOCKED_IPS || '').split(',').filter(Boolean));
// Umbral: 3 órdenes FAILED desde misma IP en 10 minutos = posible fraude
const failureStore = new Map();

function antiFraud(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress;

  // ── 1. IP bloqueada ──────────────────────────────────────────────────────────
  if (BLOCKED_IPS.has(ip)) {
    log('warn', 'AntiFraud: blocked IP attempt', { ip, path: req.path });
    return res.status(403).json({ success: false, error: 'FRAUD_BLOCKED', message: 'Acceso denegado' });
  }

  // ── 2. Detección velocidad (velocity check) ──────────────────────────────────
  const now    = Date.now();
  const window = 10 * 60 * 1000; // 10 min
  let record   = failureStore.get(ip);
  if (!record || now - record.start > window) {
    record = { count: 0, start: now };
  }
  if (record.count >= 3) {
    log('warn', 'AntiFraud: velocity exceeded', { ip, failures: record.count });
    return res.status(429).json({
      success: false, error: 'FRAUD_VELOCITY_EXCEEDED',
      message: 'Actividad sospechosa detectada. Contacta soporte.',
    });
  }

  // Exponer función para registrar fallo desde el caso de uso
  req.registerPaymentFailure = () => {
    record.count++;
    failureStore.set(ip, record);
  };

  // Adjuntar IP a request para auditoría
  req.clientIp = ip;
  next();
}

module.exports = antiFraud;