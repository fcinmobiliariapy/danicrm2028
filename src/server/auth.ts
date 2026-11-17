import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { db } from './db.js';

const SESSION_SECRET = process.env.SESSION_SECRET || 'crm-politico-dani-centurion-2018-secret-key';
const COOKIE_NAME = 'crm_session';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role_id: number;
  role_slug: string;
  role_name: string;
  permissions: Record<string, boolean>;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, keyHex] = stored.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function signToken(userId: number): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): { uid: number; exp: number } | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded?.uid || !decoded?.exp || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function loadUserWithPermissions(userId: number): Promise<AuthUser | null> {
  const userRes = await db.execute({
    sql: `SELECT u.id, u.username, u.full_name, u.email, u.role_id, u.custom_permissions_json, u.active,
                 r.slug AS role_slug, r.name AS role_name
          FROM users u
          JOIN roles r ON r.id = u.role_id
          WHERE u.id = ? AND u.active = 1`,
    args: [userId],
  });

  const row = userRes.rows[0] as unknown as
    | {
        id: number;
        username: string;
        full_name: string;
        email: string;
        role_id: number;
        custom_permissions_json: string;
        active: number;
        role_slug: string;
        role_name: string;
      }
    | undefined;

  if (!row) return null;

  const permsRes = await db.execute({
    sql: `SELECT p.key FROM role_permissions rp
          JOIN permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = ?`,
    args: [row.role_id],
  });

  const rolePerms = permsRes.rows as unknown as { key: string }[];

  const perms: Record<string, boolean> = {};
  for (const p of rolePerms) {
    perms[p.key] = true;
  }

  try {
    const custom = JSON.parse(row.custom_permissions_json || '{}');
    for (const [k, v] of Object.entries(custom)) {
      if (typeof v === 'boolean') {
        perms[k] = v;
      }
    }
  } catch {
    // ignore malformed json
  }

  return {
    id: Number(row.id),
    username: String(row.username),
    full_name: String(row.full_name),
    email: String(row.email || ''),
    role_id: Number(row.role_id),
    role_slug: String(row.role_slug),
    role_name: String(row.role_name),
    permissions: perms,
  };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies && req.cookies[COOKIE_NAME]) {
      token = req.cookies[COOKIE_NAME];
    }

    if (!token) {
      return res.status(401).json({ error: 'Sesión no iniciada o expirada.' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Token de sesión inválido o expirado.' });
    }

    const user = await loadUserWithPermissions(decoded.uid);
    if (!user) {
      return res.status(401).json({ error: 'Usuario inactivo o no encontrado.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(500).json({ error: 'Error interno al verificar la sesión.' });
  }
}

export function requirePermission(permKey: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado.' });
    }
    if (req.user.role_slug === 'super_admin' || req.user.permissions[permKey]) {
      return next();
    }
    return res.status(403).json({ error: 'No posee permisos suficientes para esta operación.' });
  };
}

export function maskSensitive(value: string, canViewSensitive: boolean): string {
  if (canViewSensitive) return value;
  if (!value || value.length <= 3) return '***';
  return `${'*'.repeat(Math.max(3, value.length - 3))}${value.slice(-3)}`;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
