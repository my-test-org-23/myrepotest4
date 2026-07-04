import { Router, Request, Response } from 'express';
import { db } from '../db';
import { config } from '../config';
import { newToken, requireUser, requireAdmin } from '../auth';
import { monthDates, slotHours, isValidDate, isValidHour } from '../slots';

export const api = Router();

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------
const findUserByName = db.prepare('SELECT id, name FROM users WHERE name = ?');
const insertUser = db.prepare('INSERT INTO users (name) VALUES (?)');
const insertSession = db.prepare(
  'INSERT INTO sessions (token, user_id, is_admin) VALUES (?, ?, ?)'
);
const deleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');

const selectMySlots = db.prepare(
  'SELECT date, hour FROM availability WHERE user_id = ? ORDER BY date, hour'
);
const deleteDaySlots = db.prepare(
  'DELETE FROM availability WHERE user_id = ? AND date = ?'
);
const insertSlot = db.prepare(
  'INSERT OR IGNORE INTO availability (user_id, date, hour) VALUES (?, ?, ?)'
);

const countUsers = db.prepare('SELECT COUNT(*) AS n FROM users');

// ---------------------------------------------------------------------------
// Meta: event details + slot definition (public, no auth needed)
// ---------------------------------------------------------------------------
api.get('/meta', (_req: Request, res: Response) => {
  res.json({
    event: config.event,
    dates: monthDates(),
    hours: slotHours(),
  });
});

// ---------------------------------------------------------------------------
// Auth: exchange a code (+ name for participants) for a bearer token
// ---------------------------------------------------------------------------
api.post('/auth', (req: Request, res: Response) => {
  const code = String(req.body?.code ?? '').trim();
  const name = String(req.body?.name ?? '').trim();

  if (!code) {
    res.status(400).json({ error: 'A code is required.' });
    return;
  }

  // Admin code path — no name required, read-only dashboard access.
  if (code === config.adminCode) {
    const token = newToken();
    insertSession.run(token, null, 1);
    res.json({ token, isAdmin: true, name: null });
    return;
  }

  // Participant code path — requires a name.
  if (code === config.accessCode) {
    if (!name) {
      res.status(400).json({ error: 'Please enter your name.', needsName: true });
      return;
    }
    if (name.length > 60) {
      res.status(400).json({ error: 'Name is too long (max 60 characters).' });
      return;
    }

    let user = findUserByName.get(name) as { id: number; name: string } | undefined;
    if (!user) {
      const info = insertUser.run(name);
      user = { id: Number(info.lastInsertRowid), name };
    }

    const token = newToken();
    insertSession.run(token, user.id, 0);
    res.json({ token, isAdmin: false, name: user.name, userId: user.id });
    return;
  }

  res.status(401).json({ error: 'That code is not valid.' });
});

api.post('/logout', (req: Request, res: Response) => {
  if (req.auth) deleteSession.run(req.auth.token);
  res.json({ ok: true });
});

/** Returns who the current token belongs to (used to restore sessions). */
api.get('/me', (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Not signed in.' });
    return;
  }
  res.json({
    isAdmin: req.auth.isAdmin,
    name: req.auth.name,
    userId: req.auth.userId,
  });
});

// ---------------------------------------------------------------------------
// Participant availability
// ---------------------------------------------------------------------------

/** All of the signed-in participant's selected slots, grouped by date. */
api.get('/availability', requireUser, (req: Request, res: Response) => {
  const rows = selectMySlots.all(req.auth!.userId) as { date: string; hour: number }[];
  const byDate: Record<string, number[]> = {};
  for (const r of rows) {
    (byDate[r.date] ||= []).push(r.hour);
  }
  res.json({ byDate });
});

/**
 * Replace the participant's availability for a single day.
 * Body: { date: 'YYYY-MM-DD', hours: number[] }
 * Sending an empty hours array clears that day.
 */
api.put('/availability/:date', requireUser, (req: Request, res: Response) => {
  const date = String(req.params.date);
  const hours: unknown = req.body?.hours;

  if (!isValidDate(date)) {
    res.status(400).json({ error: 'Date is outside the event month.' });
    return;
  }
  if (!Array.isArray(hours) || !hours.every((h) => isValidHour(h))) {
    res.status(400).json({ error: 'Invalid hours.' });
    return;
  }

  const unique = Array.from(new Set(hours as number[]));
  const userId = req.auth!.userId!;

  const tx = db.transaction(() => {
    deleteDaySlots.run(userId, date);
    for (const h of unique) insertSlot.run(userId, date, h);
  });
  tx();

  res.json({ date, hours: unique.sort((a, b) => a - b) });
});

// ---------------------------------------------------------------------------
// Overlap / suggested times (visible to any signed-in principal)
// ---------------------------------------------------------------------------

/**
 * For every (date, hour) that at least one person picked, returns how many
 * people are free and their names. Also returns the total participant count so
 * the client can highlight slots where *everybody* is available.
 */
api.get('/overlap', (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Not signed in.' });
    return;
  }

  const rows = db
    .prepare(
      `SELECT a.date, a.hour, u.name
       FROM availability a
       JOIN users u ON u.id = a.user_id
       ORDER BY a.date, a.hour, u.name`
    )
    .all() as { date: string; hour: number; name: string }[];

  const map = new Map<string, { date: string; hour: number; names: string[] }>();
  for (const r of rows) {
    const key = `${r.date}#${r.hour}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { date: r.date, hour: r.hour, names: [] };
      map.set(key, entry);
    }
    entry.names.push(r.name);
  }

  const totalUsers = (countUsers.get() as { n: number }).n;

  const slots = Array.from(map.values())
    .map((s) => ({ ...s, count: s.names.length }))
    .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date) || a.hour - b.hour);

  res.json({ totalUsers, slots });
});

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------
api.get('/admin/summary', requireAdmin, (_req: Request, res: Response) => {
  const users = db
    .prepare('SELECT id, name, created_at FROM users ORDER BY created_at')
    .all() as { id: number; name: string; created_at: string }[];

  const rows = db
    .prepare('SELECT user_id, date, hour FROM availability ORDER BY date, hour')
    .all() as { user_id: number; date: string; hour: number }[];

  const slotsByUser: Record<number, { date: string; hour: number }[]> = {};
  for (const r of rows) {
    (slotsByUser[r.user_id] ||= []).push({ date: r.date, hour: r.hour });
  }

  const summary = users.map((u) => {
    const slots = slotsByUser[u.id] || [];
    const days = new Set(slots.map((s) => s.date));
    return {
      id: u.id,
      name: u.name,
      created_at: u.created_at,
      totalSlots: slots.length,
      totalDays: days.size,
      slots,
    };
  });

  res.json({
    totalUsers: users.length,
    totalSlots: rows.length,
    users: summary,
  });
});
