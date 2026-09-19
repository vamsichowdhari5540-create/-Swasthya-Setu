import * as SQLite from 'expo-sqlite';

// Opened once per process; expo-sqlite's sync open is the documented
// pattern for a database used throughout the app's lifetime.
export const db = SQLite.openDatabaseSync('swasthya-setu.db');

let ready: Promise<void> | null = null;

export function ensureDb(): Promise<void> {
  if (!ready) {
    ready = db.execAsync(`
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        server_id TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT
      );
    `);
  }
  return ready;
}
