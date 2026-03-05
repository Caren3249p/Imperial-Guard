import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { securityConfig } from '../config/security.config';
import { Role } from '../models/role.model';

export interface AuthPayload extends JwtPayload {
  id:    string;
  email: string;
  roles: Role[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const authenticate = (
  req:  Request,
  res:  Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Autenticación requerida' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, securityConfig.jwtSecret) as AuthPayload;
    req.user = payload;
    next();
  } catch (error) {
    const isExpired = error instanceof jwt.TokenExpiredError;
    res.status(401).json({
      message: isExpired ? 'Token expirado' : 'Token inválido',
    });
  }
};
