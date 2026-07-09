import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';

export interface AuthUser {
  token: string;
  userId: number | null;
  isAdmin: boolean;
  name: string | null;
}

// Extend Express's Request with the authenticated principal.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export function newToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

interface SessionRow {
  token: string;
  user_id: number | null;
  is_admin: number;
  name: string | null;
}

const selectSession = db.prepare(`
  SELECT s.token, s.user_id, s.is_admin, u.name
  FROM sessions s
  LEFT JOIN users u ON u.id = s.user_id
  WHERE s.token = ?
`);

function loadSession(token: string): AuthUser | null {
  const row = selectSession.get(token) as SessionRow | undefined;
  if (!row) return null;
  return {
    token: row.token,
    userId: row.user_id,
    isAdmin: !!row.is_admin,
    name: row.name,
  };
}

/** Reads the bearer token and attaches req.auth if valid. Never rejects. */
export function attachAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) {
    const session = loadSession(match[1].trim());
    if (session) req.auth = session;
  }
  next();
}

/** Requires any signed-in participant. */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || req.auth.userId == null) {
    res.status(401).json({ error: 'No has iniciado sesión.' });
    return;
  }
  next();
}

/** Requires an admin session. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || !req.auth.isAdmin) {
    res.status(403).json({ error: 'Se requiere acceso de organizador.' });
    return;
  }
  next();
}
