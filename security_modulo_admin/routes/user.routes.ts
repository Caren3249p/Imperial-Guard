import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middlewares/authentication.middleware';
import { authorize } from '../middlewares/authorization.middleware';
import { isOwnerOrAuthorized } from '../middlewares/ownership.middleware';
import { Role } from '../models/role.model';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ── Rutas del usuario autenticado ──────────────────────────────

/** GET /users/profile — Perfil propio (shortcut sin :id) */
router.get('/profile', UserController.getProfile);

// ── Auditoría (solo ADMIN) ─────────────────────────────────────

/** GET /users/logs — Historial completo de accesos */
router.get(
  '/logs',
  authorize([Role.ADMIN]),
  UserController.getLogs
);

/** GET /users/logs/sensitive — Solo accesos a datos sensibles — HU-6 */
router.get(
  '/logs/sensitive',
  authorize([Role.ADMIN]),
  UserController.getSensitiveAccessLogs
);

// ── Gestión de usuarios (solo ADMIN) ───────────────────────────

/** GET /users — Listar todos los usuarios */
router.get(
  '/',
  authorize([Role.ADMIN]),
  UserController.getAll
);

/** PATCH /users/:id/roles — Cambiar roles */
router.patch(
  '/:id/roles',
  authorize([Role.ADMIN]),
  UserController.updateRoles
);

/** PATCH /users/:id/deactivate — Desactivar cuenta */
router.patch(
  '/:id/deactivate',
  authorize([Role.ADMIN]),
  UserController.deactivate
);

// ── Perfiles por ID ────────────────────────────────────────────

/**
 * GET /users/:id/player-profile — HU-5
 * Visible para cualquier usuario autenticado.
 * Solo expone id y createdAt, nunca email ni roles.
 */
router.get(
  '/:id/player-profile',
  UserController.getPlayerProfile
);

/**
 * GET /users/:id/profile — HU-5
 * Solo el propio usuario, ADMIN o MODERATOR pueden verlo.
 * Otros jugadores reciben 403.
 */
router.get(
  '/:id/profile',
  isOwnerOrAuthorized([Role.ADMIN, Role.MODERATOR]),
  UserController.getOwnProfile
);

/**
 * GET /users/:id/sensitive — HU-6
 * Datos sensibles: solo ADMIN. Queda registrado en auditoría.
 */
router.get(
  '/:id/sensitive',
  authorize([Role.ADMIN]),
  UserController.getSensitiveData
);

export default router;