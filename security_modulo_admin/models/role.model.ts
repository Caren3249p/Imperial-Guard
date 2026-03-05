export enum Role {
  ADMIN     = 'ADMIN',
  MODERATOR = 'MODERATOR',
  USER      = 'USER',
}

export enum Permission {
  USERS_READ    = 'users:read',
  USERS_WRITE   = 'users:write',
  USERS_DELETE  = 'users:delete',
  LOGS_READ     = 'logs:read',
  PROFILE_READ  = 'profile:read',
  PROFILE_WRITE = 'profile:write',
}

export const RolePermissions: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.USERS_DELETE,
    Permission.LOGS_READ,
    Permission.PROFILE_READ,
    Permission.PROFILE_WRITE,
  ],
  [Role.MODERATOR]: [
    Permission.USERS_READ,
    Permission.LOGS_READ,
    Permission.PROFILE_READ,
    Permission.PROFILE_WRITE,
  ],
  [Role.USER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_WRITE,
  ],
};

/** Verifica si un conjunto de roles posee un permiso específico */
export function hasPermission(userRoles: Role[], permission: Permission): boolean {
  return userRoles.some(role => RolePermissions[role]?.includes(permission));
}
