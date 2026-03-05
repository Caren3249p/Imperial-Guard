import { User } from '../models/user.model';
import { Role } from '../models/role.model';

// Repositorio de usuarios con almacenamiento en memoria.
// Exporta una instancia singleton para compartir el estado
// entre AuthService y UserController sin perder datos.
//
// TODO: cuando haya BD, reemplazar el Map por llamadas al ORM
// (Prisma, TypeORM, Drizzle, etc.) manteniendo la misma interfaz.

export class UserRepository {
  /** Almacén en memoria: id → User */
  private store: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) return user;
    }
    return null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.store.values());
  }

  async create(
    email:          string,
    hashedPassword: string,
    roles:          Role[] = [Role.USER]
  ): Promise<User> {
    const user: User = {
      id:        crypto.randomUUID(),
      email:     email.toLowerCase().trim(),
      password:  hashedPassword,
      roles,
      isActive:  true,
      createdAt: new Date(),
    };
    this.store.set(user.id, user);
    return user;
  }

  async updateRoles(id: string, roles: Role[]): Promise<User | null> {
    const user = this.store.get(id);
    if (!user) return null;
    const updated = { ...user, roles };
    this.store.set(id, updated);
    return updated;
  }

  async deactivate(id: string): Promise<boolean> {
    const user = this.store.get(id);
    if (!user) return false;
    this.store.set(id, { ...user, isActive: false });
    return true;
  }
}

/** Singleton compartido entre servicios y controladores */
export const userRepository = new UserRepository();
