import type { Server as HttpServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CONSULTATION_CHANGED_EVENT,
  CONSULTATION_JOIN_ROOM,
  CONSULTATION_SIGNAL_EVENT,
  REFERRAL_CHANGED_EVENT,
  type Consultation,
  type ConsultationSignal,
  type Referral,
} from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { env } from '../env';

let io: IOServer | null = null;

// Socket.IO here is purely a delivery mechanism for realtime updates — see
// the architecture doc's frozen principle. The database row returned by the
// REST endpoints is always the source of truth; a client that never
// receives (or misses) an event can still get the right answer by
// re-fetching, which every referral screen does anyway.
export function initRealtime(httpServer: HttpServer): IOServer {
  // Same origins list as the REST API's CORS config (env.ts) — undefined
  // keeps the previous wide-open behavior until real frontend URLs are set.
  io = new IOServer(httpServer, { cors: { origin: env.corsOrigins ?? '*' } });

  io.use(async (socket, next) => {
    const supabase = getSupabase();
    const token = socket.handshake.auth?.token as string | undefined;
    if (!supabase || !token) {
      next(new Error('unauthorized'));
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      next(new Error('unauthorized'));
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, facility_id')
      .eq('id', userData.user.id)
      .single();
    if (!profile) {
      next(new Error('unauthorized'));
      return;
    }

    socket.data.userId = profile.id as string;
    socket.data.role = profile.role as string;
    socket.data.facilityId = profile.facility_id as string | null;
    next();
  });

  io.on('connection', (socket) => {
    if (socket.data.facilityId) socket.join(`facility:${socket.data.facilityId}`);
    if (socket.data.role === 'patient') socket.join(`patient:${socket.data.userId}`);

    // Joining the call's signaling room requires the same access rule as
    // the referral it belongs to — otherwise anyone with a valid session
    // could listen in on an arbitrary consultation's SDP/ICE exchange by
    // guessing its id.
    socket.on(CONSULTATION_JOIN_ROOM, async (payload: { consultationId?: string }, ack?: (ok: boolean) => void) => {
      const supabase = getSupabase();
      const allowed =
        supabase && payload?.consultationId
          ? await canJoinConsultationRoom(supabase, socket.data, payload.consultationId)
          : false;
      if (allowed) socket.join(`consultation:${payload!.consultationId}`);
      ack?.(!!allowed);
    });

    // Pure relay: the server never inspects or stores the SDP/ICE payload,
    // it only forwards it to whoever else is in the room.
    socket.on(CONSULTATION_SIGNAL_EVENT, (payload: { consultationId: string; signal: ConsultationSignal }) => {
      if (!payload?.consultationId) return;
      const room = `consultation:${payload.consultationId}`;
      // Membership is the authorization: the join handler above is what
      // vets it. Relaying on the payload's room id alone would let any
      // authenticated socket inject SDP/ICE into a call it never joined,
      // just by naming the consultation id.
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit(CONSULTATION_SIGNAL_EVENT, payload.signal);
    });
  });

  return io;
}

async function canJoinConsultationRoom(
  supabase: SupabaseClient,
  socketData: { userId: string; role: string; facilityId: string | null },
  consultationId: string
): Promise<boolean> {
  const { data: consultation } = await supabase
    .from('consultations')
    .select('referral_id, patient_id')
    .eq('id', consultationId)
    .maybeSingle();
  if (!consultation) return false;

  if (socketData.role === 'patient') {
    const { data: patient } = await supabase
      .from('patients')
      .select('user_id')
      .eq('id', consultation.patient_id)
      .maybeSingle();
    return patient?.user_id === socketData.userId;
  }

  if (!socketData.facilityId) return false;
  const { data: referral } = await supabase
    .from('referrals')
    .select('originating_facility_id, receiving_facility_id')
    .eq('id', consultation.referral_id)
    .maybeSingle();
  if (!referral) return false;
  return (
    socketData.facilityId === referral.originating_facility_id ||
    socketData.facilityId === referral.receiving_facility_id
  );
}

// Notifies both facilities on the parent referral that a consultation was
// created or changed status (e.g. the other side joined, or the call
// ended) — the "someone started/ended a call" notification.
export function broadcastConsultationChanged(
  consultation: Consultation,
  referralFacilities: { originatingFacilityId: string; receivingFacilityId: string }
) {
  if (!io) return;
  io.to(`facility:${referralFacilities.originatingFacilityId}`).emit(CONSULTATION_CHANGED_EVENT, consultation);
  io.to(`facility:${referralFacilities.receivingFacilityId}`).emit(CONSULTATION_CHANGED_EVENT, consultation);
}

// Notifies the referring facility, the receiving facility, and the patient
// (if they have their own linked account) — everyone the architecture
// doc's data flow says should see the update land.
export function broadcastReferralChanged(referral: Referral, patientUserId: string | null) {
  if (!io) return;
  io.to(`facility:${referral.originatingFacilityId}`).emit(REFERRAL_CHANGED_EVENT, referral);
  io.to(`facility:${referral.receivingFacilityId}`).emit(REFERRAL_CHANGED_EVENT, referral);
  if (patientUserId) io.to(`patient:${patientUserId}`).emit(REFERRAL_CHANGED_EVENT, referral);
}
