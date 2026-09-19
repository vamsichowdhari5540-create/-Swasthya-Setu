import type { Session } from '@supabase/supabase-js';

const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(session: Session | null, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? `Request failed with ${response.status}`, body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
