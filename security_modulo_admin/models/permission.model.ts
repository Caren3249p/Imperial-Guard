/** Estructura de un permiso granular (recurso + acción) */
export interface PermissionEntry {
  resource: string;
  action:   string;
}

/** Convierte un string "recurso:acción" en un PermissionEntry */
export function parsePermission(raw: string): PermissionEntry {
  const [resource, action] = raw.split(':');
  return { resource, action };
}
