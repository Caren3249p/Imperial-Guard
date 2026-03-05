export interface LogEntry {
  id:         string;
  email:      string;
  action:     'LOGIN' | 'REGISTER' | 'ACCESS_DENIED' | 'LOGOUT'
            | 'SENSITIVE_ACCESS' | 'UNAUTHORIZED_ACCESS';  // ← nuevas
  success:    boolean;
  ip?:        string;
  userAgent?: string;
  targetId?:  string;   // ← ID del recurso al que se intentó acceder
  timestamp:  Date;
}

export class AccessLog {
  /** Almacén en memoria — TODO: reemplazar con repositorio de BD */
  private static logs: LogEntry[] = [];

  static async log(
    email:    string,
    success:  boolean,
    action:   LogEntry['action'] = 'LOGIN',
    meta?:    { ip?: string; userAgent?: string; targetId?: string }
  ): Promise<void> {
    const entry: LogEntry = {
      id:        crypto.randomUUID(),
      email,
      action,
      success,
      ip:        meta?.ip,
      userAgent: meta?.userAgent,
      targetId:  meta?.targetId,
      timestamp: new Date(),
    };

    AccessLog.logs.push(entry);

    const status = success ? '✓' : '✗';
    console.log(
      `[${entry.timestamp.toISOString()}] ${status} ${action.padEnd(20)} | ${email}${
        meta?.targetId ? ` | target: ${meta.targetId}` : ''
      }${meta?.ip ? ` | IP: ${meta.ip}` : ''}`
    );

    // TODO: cuando la BD esté disponible, reemplazar por:
    // await db.accessLogs.create({ data: entry });
  }

  static getAll(): LogEntry[] {
    return [...AccessLog.logs];
  }

  static getByEmail(email: string): LogEntry[] {
    return AccessLog.logs.filter(l => l.email === email);
  }

  static getFailedAttempts(email: string): LogEntry[] {
    return AccessLog.getByEmail(email).filter(l => !l.success);
  }

  /** Devuelve solo los accesos a datos sensibles (para auditoría) */
  static getSensitiveAccessLogs(): LogEntry[] {
    return AccessLog.logs.filter(l =>
      l.action === 'SENSITIVE_ACCESS' || l.action === 'UNAUTHORIZED_ACCESS'
    );
  }
}