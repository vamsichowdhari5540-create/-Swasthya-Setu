-- Phase 0: minimal schema needed to prove the API can reach a real
-- Supabase project. Later phases extend this file (patients, encounters,
-- referrals, consent, audit) rather than replacing it.

create extension if not exists pgcrypto;

create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  district text not null,
  type text not null check (type in ('phc', 'chc', 'district_hospital', 'sub_center')),
  created_at timestamptz not null default now()
);

-- Row Level Security is enabled from day one, even though Phase 0 has no
-- policies yet — the backend talks to Supabase with the service role key,
-- which bypasses RLS by design. Real per-role policies land in Phase 1/3.
alter table facilities enable row level security;

-- Phase 1: Authentication & Role-Based Access.
-- `profiles` extends Supabase's own `auth.users` with the app-specific role
-- and facility association. Nothing else in this app should ever store a
-- password or session directly — Supabase Auth owns that.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('patient', 'anm_asha', 'doctor', 'district_admin')),
  facility_id uuid references facilities (id),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- A signed-in user may read (and only read) their own profile row directly
-- from the mobile app. Every other cross-user read (e.g. an ANM/ASHA
-- looking up a patient) goes through the Express API, never straight to
-- Supabase from the mobile app — see apps/api/src/auth.
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select
  using (auth.uid() = id);

-- Phase 2: Patient Profile & QR Digital Health ID.
-- The patient is the central domain object (see the architecture doc's
-- frozen principle #1) — encounters, referrals and consultations will
-- attach to this table in later phases.
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  -- Opaque identifier only, per the Phase 2 guardrail: this is what the QR
  -- code encodes, and it carries no medical information whatsoever.
  health_id text not null unique,
  full_name text not null,
  date_of_birth date not null,
  sex text not null check (sex in ('male', 'female', 'other')),
  facility_id uuid not null references facilities (id),
  -- Set when the patient has (or is later given) their own login, so the
  -- Patient role can see their own record. Null for patients registered by
  -- a field worker who don't yet have app access.
  user_id uuid references profiles (id),
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

alter table patients enable row level security;

-- A patient may read their own linked record directly. Every staff read
-- (ANM/ASHA, doctor, admin looking up any patient) goes through the Express
-- API instead, because "any staff can see any patient" is a Phase 2
-- placeholder — Phase 3 replaces it with real consent/minimum-necessary
-- checks, which only make sense enforced in one place (the backend).
drop policy if exists "patients_select_own" on patients;
create policy "patients_select_own" on patients
  for select
  using (auth.uid() = user_id);
