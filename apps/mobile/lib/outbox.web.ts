import AsyncStorage from '@react-native-async-storage/async-storage';

export type OutboxType = 'encounter' | 'referral';
export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OutboxRow {
  id: string;
  type: OutboxType;
  patient_id: string;
  payload: string;
  status: OutboxStatus;
  server_id: string | null;
  error: string | null;
  created_at: string;
  synced_at: string | null;
}

// Web build: expo-sqlite's web backend needs SharedArrayBuffer (requires
// cross-origin-isolation headers this dev server doesn't set), which
// crashes the whole app on load if it's ever imported here — so the web
// platform gets a plain AsyncStorage-backed outbox instead of SQLite. Web
// is a preview/testing convenience for this app, not the offline target
// platform (that's the native mobile build), so a simpler store is fine.
const STORAGE_KEY = 'swasthya-setu/outbox';

async function readAll(): Promise<OutboxRow[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as OutboxRow[]) : [];
}

async function writeAll(rows: OutboxRow[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

async function update(id: string, patch: Partial<OutboxRow>): Promise<void> {
  const rows = await readAll();
  await writeAll(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
}

export async function insertOutboxItem(item: {
  id: string;
  type: OutboxType;
  patientId: string;
  payload: unknown;
}): Promise<void> {
  const rows = await readAll();
  rows.push({
    id: item.id,
    type: item.type,
    patient_id: item.patientId,
    payload: JSON.stringify(item.payload),
    status: 'pending',
    server_id: null,
    error: null,
    created_at: new Date().toISOString(),
    synced_at: null,
  });
  await writeAll(rows);
}

export async function getAllOutboxItems(): Promise<OutboxRow[]> {
  const rows = await readAll();
  return [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getRetryableOutboxItems(): Promise<OutboxRow[]> {
  const rows = await readAll();
  return rows
    .filter((row) => row.status === 'pending' || row.status === 'failed')
    .sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
}

export async function markOutboxSyncing(id: string): Promise<void> {
  await update(id, { status: 'syncing', error: null });
}

export async function markOutboxSynced(id: string, serverId: string): Promise<void> {
  await update(id, { status: 'synced', server_id: serverId, synced_at: new Date().toISOString() });
}

export async function markOutboxFailed(id: string, error: string): Promise<void> {
  await update(id, { status: 'failed', error });
}

export async function markOutboxPending(id: string): Promise<void> {
  await update(id, { status: 'pending' });
}

export async function retryOutboxItem(id: string): Promise<void> {
  await markOutboxPending(id);
}
