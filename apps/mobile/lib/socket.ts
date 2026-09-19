import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { REFERRAL_CHANGED_EVENT, type Referral } from '@swasthya-setu/shared-types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;
let socketToken: string | null = null;

// Idempotent by design: several referral (and consultation) screens may
// call this within the same session, and should share one connection
// rather than each opening (and tearing down) their own.
export function connectSocket(accessToken: string): Socket {
  if (socket && socketToken === accessToken) return socket;
  socket?.disconnect();
  socket = io(API_URL, { auth: { token: accessToken }, transports: ['websocket'] });
  socketToken = accessToken;
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

// Realtime only distributes the change — every screen using this still
// re-fetches its own list/detail via the REST API on each event, so a
// dropped or duplicated socket message can never leave the UI wrong, only
// briefly stale. See the architecture doc's frozen principle on Socket.IO.
export function useReferralUpdates(accessToken: string | undefined, onChanged: (referral: Referral) => void) {
  useEffect(() => {
    if (!accessToken) return;
    const client = connectSocket(accessToken);
    const handler = (referral: Referral) => onChanged(referral);
    client.on(REFERRAL_CHANGED_EVENT, handler);
    return () => {
      client.off(REFERRAL_CHANGED_EVENT, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);
}
