import { SignOptions } from 'jsonwebtoken';

export const securityConfig = {
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        '[SecurityConfig] JWT_SECRET no está definido. ' +
        'Copia .env.example a .env y asigna un valor seguro.'
      );
    }
    return secret;
  },

  jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as SignOptions['expiresIn'],

  bcryptSaltRounds: 12,
};