import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * All configuration is read from environment variables so the same build can
 * be deployed to a VPS with different codes / ports without code changes.
 * Sensible defaults are provided for local development.
 */
export const config = {
  port: parseInt(process.env.PORT || '4000', 10),

  // Shared code that any participant types to sign in and set their name.
  accessCode: (process.env.ACCESS_CODE || 'JULY2026').trim(),

  // Separate code that unlocks the read-only super-user dashboard.
  adminCode: (process.env.ADMIN_CODE || 'ADMIN2026').trim(),

  // Absolute path to the SQLite database file.
  dbPath: process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(__dirname, '..', 'data', 'scheduler.db'),

  // The single event everyone is scheduling around.
  event: {
    title: process.env.EVENT_TITLE || 'Team Get-Together',
    // The month we collect availability for. Fixed to July 2026 per spec.
    year: 2026,
    // 1-based month (7 = July).
    month: 7,
  },

  // Hourly slots offered to participants, inclusive range [startHour, endHour).
  // e.g. 7..23 => selectable slots at 7:00, 8:00, ... 22:00.
  slots: {
    startHour: parseInt(process.env.SLOT_START_HOUR || '7', 10),
    endHour: parseInt(process.env.SLOT_END_HOUR || '23', 10),
  },

  // Comma-separated list of allowed CORS origins ("*" allows all).
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

export type AppConfig = typeof config;
