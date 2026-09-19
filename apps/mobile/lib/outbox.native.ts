import { db, ensureDb } from './db';

export type OutboxType = 'encounter' | 'referral';
export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OutboxRow {
  id: string;
  type: OutboxType;
  patient_id: string;
  // JSON blob: display + request fields for this mutation. Kept as a
  // single opaque column since the two mutation types have different
  // shapes and the outbox itself never needs to query into it.
  payload: string;
  status: OutboxStatus;
  server_id: string | null;
  error: string | null;
  created_at: string;
  synced_at: string | null;
}

export async function insertOutboxItem(item: {
  id: string;
  type: OutboxType;
  patientId: string;
  payload: unknown;
}): Promise<void> {
  await ensureDb();
  await db.runAsync(
    `INSERT INTO outbox (id, type, patient_id, payload, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`,
    item.id,
    item.type,
    item.patientId,
    JSON.stringify(item.payload),
    new Date().toISOString()
  );
}

export async function getAllOutboxItems(): Promise<OutboxRow[]> {
  await ensureDb();
  return db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY created_at DESC');
}

// FIFO by creation time: preserves the order a field worker actually did
// things in, rather than however the retry loop happens to revisit them.
export async function getRetryableOutboxItems(): Promise<OutboxRow[]> {
  await ensureDb();
  return db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE status IN ('pending', 'failed') ORDER BY created_at ASC`
  );
}

export async function markOutboxSyncing(id: string): Promise<void> {
  await ensureDb();
  await db.runAsync(`UPDATE outbox SET status = 'syncing', error = NULL WHERE id = ?`, id);
}

export async function markOutboxSynced(id: string, serverId: string): Promise<void> {
  await ensureDb();
  await db.runAsync(
    `UPDATE outbox SET status = 'synced', server_id = ?, synced_at = ? WHERE id = ?`,
    serverId,
    new Date().toISOString(),
    id
  );
}

export async function markOutboxFailed(id: string, error: string): Promise<void> {
  await ensureDb();
  await db.runAsync(`UPDATE outbox SET status = 'failed', error = ? WHERE id = ?`, error, id);
}

export async function markOutboxPending(id: string): Promise<void> {
  await ensureDb();
  await db.runAsync(`UPDATE outbox SET status = 'pending' WHERE id = ?`, id);
}

export async function retryOutboxItem(id: string): Promise<void> {
  await markOutboxPending(id);
}
