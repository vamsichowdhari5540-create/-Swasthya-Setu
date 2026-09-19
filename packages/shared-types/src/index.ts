// Shared between apps/api and apps/mobile. Keep this package free of
// runtime dependencies so it can be imported from both Node and Expo.

export type UserRole = 'patient' | 'anm_asha' | 'doctor' | 'district_admin';

export const USER_ROLES: UserRole[] = ['patient', 'anm_asha', 'doctor', 'district_admin'];

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  facilityId: string | null;
}

export interface Facility {
  id: string;
  name: string;
  district: string;
  type: 'phc' | 'chc' | 'district_hospital' | 'sub_center';
}

export type Sex = 'male' | 'female' | 'other';

export interface Patient {
  id: string;
  healthId: string; // opaque identifier encoded in the QR code — no medical data
  fullName: string;
  dateOfBirth: string;
  sex: Sex;
  facilityId: string;
  userId: string | null;
}

export interface CreatePatientRequest {
  fullName: string;
  dateOfBirth: string; // ISO date, e.g. 1990-04-12
  sex: Sex;
}

export interface Encounter {
  id: string;
  patientId: string;
  facilityId: string;
  facilityName: string;
  recordedBy: string;
  recordedByName: string;
  encounterDate: string;
  notes: string;
  // Present when this row was created via the offline outbox (Phase 5) —
  // lets the device recognize its own queued mutation once it lands, and
  // drop the local optimistic copy instead of showing it twice.
  clientMutationId: string | null;
}

export interface CreateEncounterRequest {
  notes: string;
}

export interface Consent {
  id: string;
  patientId: string;
  facilityId: string;
  facilityName: string;
  grantedAt: string;
  revokedAt: string | null;
}

export type AuditAction =
  | 'view_patient'
  | 'create_encounter'
  | 'grant_consent'
  | 'revoke_consent'
  | 'generate_summary'
  | 'approve_summary';

export interface AuditEvent {
  id: string;
  patientId: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type ReferralStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

export interface Referral {
  id: string;
  patientId: string;
  patientName: string;
  patientHealthId: string;
  originatingFacilityId: string;
  originatingFacilityName: string;
  receivingFacilityId: string;
  receivingFacilityName: string;
  createdByUserId: string;
  createdByName: string;
  acceptedByUserId: string | null;
  acceptedByName: string | null;
  status: ReferralStatus;
  reason: string;
  completionNotes: string | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  clientMutationId: string | null;
}

export interface CreateReferralRequest {
  receivingFacilityId: string;
  reason: string;
}

export interface CompleteReferralRequest {
  completionNotes?: string;
}

export interface ReassignReferralRequest {
  facilityId: string;
}

// Broadcast over Socket.IO to the originating facility, the receiving
// facility, and the patient (if they have their own account) whenever a
// referral is created or changes status. Realtime only distributes the
// change — the database row from the REST response above is always the
// source of truth, never this event payload.
export const REFERRAL_CHANGED_EVENT = 'referral:changed';

export type ConsultationMode = 'video' | 'audio';
export type ConsultationStatus = 'waiting' | 'active' | 'ended';

export interface Consultation {
  id: string;
  referralId: string;
  patientId: string;
  patientName: string;
  createdByUserId: string;
  createdByName: string;
  joinedByUserId: string | null;
  joinedByName: string | null;
  mode: ConsultationMode;
  status: ConsultationStatus;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
}

export interface CreateConsultationRequest {
  mode: ConsultationMode;
}

// Broadcast to both facilities on a referral whenever a consultation tied
// to it is created or changes status — the "someone started a call" and
// "the call ended" notifications. Same source-of-truth rule as referrals:
// this event only says "go re-fetch", it never carries data a client acts
// on directly.
export const CONSULTATION_CHANGED_EVENT = 'consultation:changed';

// Signaling only — WebRTC session negotiation relayed peer-to-peer through
// the server without the server ever inspecting or storing it. Sent and
// received on room `consultation:<id>`, joined via CONSULTATION_JOIN_ROOM.
export const CONSULTATION_JOIN_ROOM = 'consultation:join-room';
export const CONSULTATION_SIGNAL_EVENT = 'consultation:signal';

export type ConsultationSignal =
  | { kind: 'offer'; sdp: string }
  | { kind: 'answer'; sdp: string }
  | { kind: 'ice-candidate'; candidate: unknown }
  | { kind: 'bye' };

export type SummaryStatus = 'draft' | 'approved';
export type SummarySource = 'template' | 'groq';
export type TriageLevel = 'routine' | 'priority' | 'urgent';

export interface AiSummary {
  id: string;
  patientId: string;
  createdByUserId: string;
  createdByName: string;
  status: SummaryStatus;
  source: SummarySource;
  model: string | null;
  modelVersion: string | null;
  draftText: string;
  editedText: string | null;
  triageLevel: TriageLevel | null;
  triageRationale: string | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
  clientMutationId: string | null;
}

export interface UpdateSummaryRequest {
  editedText: string;
}

export interface ApproveSummaryRequest {
  editedText?: string;
}

export interface FacilityLoad {
  facilityId: string;
  facilityName: string;
  district: string;
  type: string;
  patientCount: number;
  outgoingReferrals: number;
  incomingReferrals: number;
  pendingIncoming: number;
}

export interface DashboardResponse {
  generatedAt: string;
  totals: { facilities: number; patients: number; referrals: number };
  referralsByStatus: Record<string, number>;
  avgAcceptanceLatencyMinutes: number | null;
  facilityLoad: FacilityLoad[];
  recentAuditActionCounts: Record<string, number>;
  recentAuditEventCount: number;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  service: 'swasthya-setu-api';
  timestamp: string;
  database: 'connected' | 'unreachable' | 'not_configured';
}
