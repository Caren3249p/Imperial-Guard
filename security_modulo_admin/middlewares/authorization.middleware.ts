import { Request, Response, NextFunction } from 'express';
import { Role, Permission, hasPermission } from '../models/role.model';

/** Autorización por ROL — el usuario necesita al menos uno de los roles indicados */
export const authorize = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const userRoles: Role[] = req.user.roles ?? [];
    const permitted = allowedRoles.some(role => userRoles.includes(role));

    if (!permitted) {
      res.status(403).json({ message: 'Acceso denegado: rol insuficiente' });
      return;
    }

    next();
  };
};

/** Autorización por PERMISO granular */
export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const userRoles: Role[] = req.user.roles ?? [];

    if (!hasPermission(userRoles, permission)) {
      res.status(403).json({
        message: `Acceso denegado: permiso '${permission}' requerido`,
      });
      return;
    }

    next();
  };
};
