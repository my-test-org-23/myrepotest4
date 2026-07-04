import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from './config';

// Ensure the directory holding the SQLite file exists.
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Schema.
 *
 * users        - one row per participant (identified by the name they type).
 * sessions     - opaque bearer tokens mapped to a user (or an admin session).
 * availability - one row per (user, date, hour) slot the user marked free.
 *
 * The event itself is a singleton defined in config, so it needs no table.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_admin   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS availability (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date    TEXT NOT NULL,          -- 'YYYY-MM-DD'
    hour    INTEGER NOT NULL,       -- 0..23
    PRIMARY KEY (user_id, date, hour)
  );

  CREATE INDEX IF NOT EXISTS idx_availability_date_hour
    ON availability(date, hour);
`);
