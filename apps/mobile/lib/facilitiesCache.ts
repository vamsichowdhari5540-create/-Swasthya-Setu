import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import type { Facility } from '@swasthya-setu/shared-types';

import { apiFetch } from '@/lib/api';

const CACHE_KEY = 'swasthya-setu/cached-facilities';

// Facilities are exactly the "minimum safe data" the architecture doc means
// to cache: small, non-sensitive, rarely-changing reference data a field
// worker needs available (to pick a referral destination) even with no
// signal at all.
export async function loadFacilities(session: Session | null): Promise<Facility[]> {
  try {
    const data = await apiFetch<Facility[]>(session, '/api/facilities');
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
    return data;
  } catch {
    const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
    return cached ? JSON.parse(cached) : [];
  }
}
