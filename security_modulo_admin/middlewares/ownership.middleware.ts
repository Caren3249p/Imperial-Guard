// Historia de usuario #51
import { Request, Response, NextFunction } from 'express';
import { Role } from '../models/role.model';

/**
 * Permite el acceso solo si:
 *   a) el usuario autenticado es el dueño del recurso (:id === req.user.id), O
 *   b) tiene uno de los roles autorizados (por defecto ADMIN)
 *
 * Uso en rutas: router.get('/:id', authenticate, isOwnerOrAuthorized(), handler)
 */

export const isOwnerOrAuthorized = (authorizedRoles: Role[] = [Role.ADMIN]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const requestedId = req.params.id;
    const isOwner     = req.user.id === requestedId;
    const hasRole     = authorizedRoles.some(role => req.user!.roles.includes(role));

    if (!isOwner && !hasRole) {
      res.status(403).json({
        message: 'Acceso denegado: no tienes permiso para ver esta información',
      });
      return;
    }

    next();
  };
};