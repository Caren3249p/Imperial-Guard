import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import { securityConfig } from './config/security.config';

// Valida JWT_SECRET al arranque — falla rápido si no está configurado
try {
  const _ = securityConfig.jwtSecret;
  console.log('✓ Configuración de seguridad validada');
} catch (err: any) {
  console.error('✗ Error de configuración:', err.message);
  process.exit(1);
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth',  authRoutes);
app.use('/users', userRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error no controlado]', err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
});

export default app;
