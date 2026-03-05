import { Request, Response } from 'express';
import { userRepository } from '../repositories/user.repository';
import { AccessLog } from '../models/accessLog.model';
import { Role } from '../models/role.model';
import { toPublicUser, toPlayerProfile, toSensitiveData } from '../models/user.model';

export class UserController {

  // ── Endpoints existentes ────────────────────────────────────

  /** GET /users — Lista todos los usuarios (solo ADMIN) */
  static async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const users = await userRepository.findAll();
      res.status(200).json(users.map(toPublicUser));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /** GET /users/profile — Perfil del usuario autenticado (propio) */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = await userRepository.findById(req.user!.id);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      res.status(200).json(toPublicUser(user));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /** PATCH /users/:id/roles — Actualiza roles (solo ADMIN) */
  static async updateRoles(req: Request, res: Response): Promise<void> {
    try {
      const { id }    = req.params;
      const { roles } = req.body;

      if (!Array.isArray(roles) || roles.length === 0) {
        res.status(400).json({ message: 'Se requiere un array de roles no vacío' });
        return;
      }

      const validRoles = Object.values(Role);
      const invalid = roles.filter((r: string) => !validRoles.includes(r as Role));
      if (invalid.length > 0) {
        res.status(400).json({ message: `Roles inválidos: ${invalid.join(', ')}` });
        return;
      }

      const updated = await userRepository.updateRoles(id, roles as Role[]);
      if (!updated) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      res.status(200).json(toPublicUser(updated));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /** PATCH /users/:id/deactivate — Desactiva cuenta (solo ADMIN) */
  static async deactivate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (id === req.user!.id) {
        res.status(400).json({ message: 'No puedes desactivar tu propia cuenta' });
        return;
      }

      const success = await userRepository.deactivate(id);
      if (!success) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      res.status(200).json({ message: 'Usuario desactivado exitosamente' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /** GET /users/logs — Historial de accesos (solo ADMIN) */
  static async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.query;
      const logs = email
        ? AccessLog.getByEmail(email as string)
        : AccessLog.getAll();
      res.status(200).json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  // ── Endpoints nuevos (HU-5 y HU-6) ─────────────────────────

  /**
   * GET /users/:id/profile — HU-5
   * Perfil propio completo (sin contraseña).
   * Acceso: el propio usuario O roles ADMIN/MODERATOR.
   * Otros jugadores NO pueden ver este endpoint.
   */
  static async getOwnProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = await userRepository.findById(req.params.id);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      // El middleware isOwnerOrAuthorized ya validó el acceso
      res.status(200).json(toPublicUser(user));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /users/:id/player-profile — HU-5
   * Perfil público mínimo visible para OTROS jugadores.
   * Solo expone id y fecha de creación; nunca email ni roles.
   */
  static async getPlayerProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = await userRepository.findById(req.params.id);
      if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      if (!user.isActive) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      // toPlayerProfile devuelve SOLO id y createdAt
      res.status(200).json(toPlayerProfile(user));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /users/:id/sensitive — HU-6
   * Datos sensibles completos del usuario.
   * Acceso: solo ADMIN. Queda registrado en el log de auditoría.
   */
  static async getSensitiveData(req: Request, res: Response): Promise<void> {
    const adminEmail = req.user!.email;
    const targetId   = req.params.id;

    try {
      const user = await userRepository.findById(targetId);
      if (!user) {
        await AccessLog.log(adminEmail, false, 'SENSITIVE_ACCESS', {
          ip:       req.ip,
          targetId,
        });
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }

      // Registrar el acceso exitoso a datos sensibles (HU-6)
      await AccessLog.log(adminEmail, true, 'SENSITIVE_ACCESS', {
        ip:        req.ip,
        userAgent: req.headers['user-agent'],
        targetId,
      });

      res.status(200).json(toSensitiveData(user));
    } catch (error: any) {
      await AccessLog.log(adminEmail, false, 'SENSITIVE_ACCESS', {
        ip: req.ip, targetId,
      });
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /users/logs/sensitive — HU-6
   * Auditoría de accesos a datos sensibles.
   * Acceso: solo ADMIN.
   */
  static async getSensitiveAccessLogs(_req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json(AccessLog.getSensitiveAccessLogs());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}
