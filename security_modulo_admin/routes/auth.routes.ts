import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

/** POST /auth/register — Crear cuenta nueva */
router.post('/register', AuthController.register);

/** POST /auth/login — Iniciar sesión y recibir JWT */
router.post('/login', AuthController.login);

export default router;
