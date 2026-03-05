import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import { AccessLog } from '../models/accessLog.model';
import { Role } from '../models/role.model';
import { PublicUser, toPublicUser } from '../models/user.model';
import { securityConfig } from '../config/security.config';

interface AuthResult {
  user:  PublicUser;
  token: string;
}

interface RequestMeta {
  ip?:        string;
  userAgent?: string;
}

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async register(
    email:    string,
    password: string,
    roles:    Role[]      = [Role.USER],
    meta?:    RequestMeta
  ): Promise<AuthResult> {
    this.validateEmail(email);
    this.validatePassword(password);

    const exists = await this.userRepository.existsByEmail(email);
    if (exists) {
      await AccessLog.log(email, false, 'REGISTER', meta);
      throw new Error('El correo ya está registrado');
    }

    // Hash de contraseña — NUNCA almacenar en texto plano
    const hashedPassword = await bcrypt.hash(
      password,
      securityConfig.bcryptSaltRounds
    );

    const user  = await this.userRepository.create(email, hashedPassword, roles);
    const token = this.signToken(user.id, user.email, user.roles);

    await AccessLog.log(email, true, 'REGISTER', meta);
    return { user: toPublicUser(user), token };
  }

  async login(
    email:    string,
    password: string,
    meta?:    RequestMeta
  ): Promise<AuthResult> {
    // Mensaje genérico para no revelar si el email existe
    const INVALID_MSG = 'Credenciales inválidas';

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      await AccessLog.log(email, false, 'LOGIN', meta);
      throw new Error(INVALID_MSG);
    }

    if (!user.isActive) {
      await AccessLog.log(email, false, 'LOGIN', meta);
      throw new Error('La cuenta está desactivada');
    }

    // Comparación segura con bcrypt (tiempo constante)
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await AccessLog.log(email, false, 'LOGIN', meta);
      throw new Error(INVALID_MSG);
    }

    const token = this.signToken(user.id, user.email, user.roles);
    await AccessLog.log(email, true, 'LOGIN', meta);
    return { user: toPublicUser(user), token };
  }

  private signToken(id: string, email: string, roles: Role[]): string {
  return jwt.sign(
    { id, email, roles },
    securityConfig.jwtSecret,
    { expiresIn: securityConfig.jwtExpiresIn as SignOptions['expiresIn'] }
  );
}

  private validateEmail(email: string): void {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) throw new Error('Formato de correo inválido');
  }

  private validatePassword(password: string): void {
    if (password.length < 8)
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    if (!/[A-Z]/.test(password))
      throw new Error('La contraseña debe contener al menos una mayúscula');
    if (!/[0-9]/.test(password))
      throw new Error('La contraseña debe contener al menos un número');
  }
}
