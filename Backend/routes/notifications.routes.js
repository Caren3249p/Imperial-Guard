const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
// TODO: Agregar schema Zod cuando se definan parámetros de entrada para este endpoint.

// GET /api/v1/notifications
// Auth: JWT requerido — las notificaciones son datos del usuario autenticado.
router.get('/', authMiddleware, notificationsController.getNotifications);

module.exports = router;
