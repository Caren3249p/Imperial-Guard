import { Role } from './role.model';

/** Entidad interna — NUNCA exponer directamente en respuestas HTTP */
export interface User {
  id:        string;
  email:     string;
  password:  string;   // Siempre hash bcrypt, nunca texto plano
  roles:     Role[];
  isActive:  boolean;
  createdAt: Date;
}

/**
 * Perfil propio — visible solo para el usuario dueño o roles autorizados.
 * Incluye email y estado de cuenta.
 */
export type PublicUser = Omit<User, 'password'>;

/**
 * Perfil de jugador — lo único visible para OTROS jugadores.
 * No expone email, roles internos ni estado de cuenta.
 */
export type PlayerProfile = Pick<User, 'id' | 'createdAt'>;

/**
 * Datos sensibles — solo accesible por ADMIN.
 * Incluye toda la información del usuario excepto la contraseña.
 */
export type SensitiveData = Omit<User, 'password'> & {
  _sensitivity: 'HIGH';   // marcador explícito para evitar uso accidental
};

/** Convierte un User a su perfil propio (sin contraseña) */
export function toPublicUser(user: User): PublicUser {
  const { password, ...publicUser } = user;
  return publicUser;
}

/** Convierte un User al perfil mínimo visible para otros jugadores */
export function toPlayerProfile(user: User): PlayerProfile {
  return {
    id:        user.id,
    createdAt: user.createdAt,
  };
}

/** Convierte un User a datos sensibles (solo para ADMIN) */
export function toSensitiveData(user: User): SensitiveData {
  const { password, ...rest } = user;
  return { ...rest, _sensitivity: 'HIGH' };
}