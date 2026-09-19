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

export type ReferralStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

export interface Referral {
  id: string;
  patientId: string;
  createdByUserId: string;
  receivingFacilityId: string;
  status: ReferralStatus;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  service: 'swasthya-setu-api';
  timestamp: string;
  database: 'connected' | 'unreachable' | 'not_configured';
}
