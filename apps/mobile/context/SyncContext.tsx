import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Encounter, Referral } from '@swasthya-setu/shared-types';

import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { generateId } from '@/lib/uuid';
import {
  getAllOutboxItems,
  getRetryableOutboxItems,
  insertOutboxItem,
  markOutboxFailed,
  markOutboxPending,
  markOutboxSynced,
  markOutboxSyncing,
  retryOutboxItem,
  type OutboxRow,
} from '@/lib/outbox';

export interface EncounterPayload {
  patientName: string;
  notes: string;
}

export interface ReferralPayload {
  patientName: string;
  receivingFacilityId: string;
  receivingFacilityName: string;
  reason: string;
}

interface SyncContextValue {
  items: OutboxRow[];
  pendingCount: number;
  refresh: () => Promise<void>;
  flush: () => Promise<void>;
  retry: (id: string) => Promise<void>;
  queueEncounter: (patientId: string, payload: EncounterPayload) => Promise<string>;
  queueReferral: (patientId: string, payload: ReferralPayload) => Promise<string>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [items, setItems] = useState<OutboxRow[]>([]);
  const flushing = useRef(false);

  const refresh = useCallback(async () => {
    setItems(await getAllOutboxItems());
  }, []);

  // Local-first: the write lands in SQLite immediately and refresh() shows
  // it right away, regardless of whether flush() below succeeds, fails, or
  // never runs because the device is offline. See the architecture doc's
  // "offline writes are first-class operations" principle.
  const flush = useCallback(async () => {
    if (flushing.current || !session) return;
    flushing.current = true;
    try {
      const pending = await getRetryableOutboxItems();
      for (const item of pending) {
        await markOutboxSyncing(item.id);
        await refresh();
        try {
          const payload = JSON.parse(item.payload) as EncounterPayload | ReferralPayload;
          const path =
            item.type === 'encounter'
              ? `/api/patients/${item.patient_id}/encounters`
              : `/api/patients/${item.patient_id}/referrals`;
          const body =
            item.type === 'encounter'
              ? { notes: (payload as EncounterPayload).notes }
              : {
                  receivingFacilityId: (payload as ReferralPayload).receivingFacilityId,
                  reason: (payload as ReferralPayload).reason,
                };

          const result = await apiFetch<Encounter | Referral>(session, path, {
            method: 'POST',
            headers: { 'Idempotency-Key': item.id },
            body: JSON.stringify(body),
          });
          await markOutboxSynced(item.id, result.id);
        } catch (err) {
          // A definitive rejection (bad request, access revoked) will never
          // succeed by retrying as-is, so stop and let the user see why —
          // anything else (network error, server hiccup) is retried later.
          const isDefinitive = err instanceof ApiError && err.status >= 400 && err.status < 500;
          if (isDefinitive) {
            await markOutboxFailed(item.id, (err as ApiError).message);
          } else {
            await markOutboxPending(item.id);
            await refresh();
            break; // still offline (or the server is down) — stop for now
          }
        }
        await refresh();
      }
    } finally {
      flushing.current = false;
    }
  }, [session, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (session) flush();
  }, [session, flush]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) flush();
    });
    return unsubscribe;
  }, [flush]);

  const value = useMemo<SyncContextValue>(
    () => ({
      items,
      pendingCount: items.filter((i) => i.status !== 'synced').length,
      refresh,
      flush,
      retry: async (id: string) => {
        await retryOutboxItem(id);
        await refresh();
        flush();
      },
      queueEncounter: async (patientId, payload) => {
        const id = generateId();
        await insertOutboxItem({ id, type: 'encounter', patientId, payload });
        await refresh();
        flush();
        return id;
      },
      queueReferral: async (patientId, payload) => {
        const id = generateId();
        await insertOutboxItem({ id, type: 'referral', patientId, payload });
        await refresh();
        flush();
        return id;
      },
    }),
    [items, refresh, flush]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}
