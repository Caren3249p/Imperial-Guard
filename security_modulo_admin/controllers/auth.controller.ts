import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { userRepository } from '../repositories/user.repository';

const authService = new AuthService(userRepository);

export class AuthController {
  /** POST /auth/register */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, roles } = req.body;

      if (!email || !password) {
        res.status(400).json({ message: 'Email y contraseña son requeridos' });
        return;
      }

      const result = await authService.register(email, password, roles, {
        ip:        req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /** POST /auth/login */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ message: 'Email y contraseña son requeridos' });
        return;
      }

      const result = await authService.login(email, password, {
        ip:        req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  }
}
