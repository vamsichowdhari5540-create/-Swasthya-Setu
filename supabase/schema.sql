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

-- Phase 3: Consent, Encounter Timeline & Audit.
-- Replaces Phase 2's placeholder ("any staff sees any patient") with real
-- access control: a staff member may reach a patient's record only if their
-- facility registered that patient, or the patient has actively consented
-- to that facility. See apps/api/src/patients/access.ts — this is enforced
-- in exactly one place (the backend), not duplicated into RLS, per the
-- architecture doc's principle of keeping authn/authz/consent as separate,
-- centrally-enforced checks.

-- Append-only clinical facts: a visit is recorded once and never edited or
-- deleted, so continuity of care never depends on a last-write-wins update
-- silently overwriting what a previous field worker or doctor observed.
create table if not exists encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id),
  facility_id uuid not null references facilities (id),
  recorded_by uuid not null references profiles (id),
  encounter_date timestamptz not null default now(),
  notes text not null,
  -- Phase 5: the client-generated id from the device's offline outbox.
  -- Unique so a retried sync (after a dropped connection, before the
  -- device saw the first response) reaches the same row instead of a
  -- duplicate — this is what "server receives exactly one logical
  -- operation" means in practice. Null for anything created online only.
  client_mutation_id uuid unique,
  created_at timestamptz not null default now()
);

alter table encounters enable row level security;

-- `create table if not exists` above is a no-op once the table already
-- exists from an earlier phase's run of this file — adding a column to an
-- existing table needs its own statement. Every later phase that extends
-- an existing table follows this same pattern.
alter table encounters add column if not exists client_mutation_id uuid unique;

-- Consent is additive and revocable, not a single mutable flag: keeping
-- every grant/revoke as its own row is itself part of the audit trail of
-- who had access when, which a single "consented boolean" would lose.
create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id),
  facility_id uuid not null references facilities (id),
  granted_by uuid not null references profiles (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references profiles (id)
);

alter table consents enable row level security;

-- Every protected-record access and every consent change is written here
-- and is never updated or deleted — an audit log you can edit isn't one.
create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id),
  actor_id uuid not null references profiles (id),
  action text not null check (
    action in ('view_patient', 'create_encounter', 'grant_consent', 'revoke_consent')
  ),
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table audit_events enable row level security;

-- Phase 4: Referral Continuity.
-- The Pending -> Accepted -> Completed workflow the pitch is built around.
-- originating_facility_id is captured at creation time rather than derived
-- from created_by's current facility, so the referral's history stays
-- correct even if that staff member is later reassigned elsewhere.
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id),
  originating_facility_id uuid not null references facilities (id),
  receiving_facility_id uuid not null references facilities (id),
  created_by uuid not null references profiles (id),
  accepted_by uuid references profiles (id),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'completed', 'cancelled')),
  completion_notes text,
  -- Phase 5: same idempotency guarantee as encounters.client_mutation_id.
  client_mutation_id uuid unique,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

alter table referrals enable row level security;

-- Phase 5: Offline-First Field App & Sync.
-- No new tables — client_mutation_id is the entire server-side surface
-- this phase needs. The outbox, retry queue and sync status live entirely
-- on the device (SQLite); the server only needs to recognize a replayed
-- mutation and answer with the same row instead of a duplicate.
alter table referrals add column if not exists client_mutation_id uuid unique;

-- Phase 6: Low-Bandwidth Teleconsultation.
-- Deliberately tied to a referral rather than free-standing: the pitch's
-- workflow is "doctor ACCEPTED referral -> consultation/assessment ->
-- COMPLETED", so a consultation only ever exists between two sides that
-- already both know about each other (no separate "how does the other
-- side find out" problem to solve), and access reuses the referral's own
-- facility-based rule instead of a new one.
create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references referrals (id),
  patient_id uuid not null references patients (id),
  created_by uuid not null references profiles (id),
  joined_by uuid references profiles (id),
  mode text not null default 'video' check (mode in ('video', 'audio')),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'ended')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer
);

alter table consultations enable row level security;

-- Phase 7: AI Summarization & Assisted Triage.
-- Per the architecture doc's guardrail, AI is assistance, not autonomous
-- diagnosis: every row starts as a `draft` (built from a deterministic
-- template, optionally upgraded by a Groq-hosted rewrite) and only becomes
-- meaningful once a doctor reviews/edits and approves it — model/version
-- metadata is captured at creation so an approved result stays traceable
-- to exactly what produced it.
create table if not exists ai_summaries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id),
  created_by uuid not null references profiles (id),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  -- 'template': deterministic, no model call succeeded. 'groq' / 'gemini':
  -- two independent cloud adapters, tried in that order, so one vendor's
  -- outage or a decommissioned model doesn't take the feature down with it.
  source text not null default 'template' check (source in ('template', 'groq', 'gemini')),
  model text,
  model_version text,
  draft_text text not null,
  edited_text text,
  -- Experimental triage signal: routine/priority/urgent, always with a
  -- plain-language rationale a doctor can check against the timeline
  -- rather than a bare label to trust blindly. Null for template-only
  -- summaries, which don't attempt triage at all.
  triage_level text check (triage_level in ('routine', 'priority', 'urgent')),
  triage_rationale text,
  reviewed_by uuid references profiles (id),
  approved_at timestamptz,
  client_mutation_id uuid unique,
  created_at timestamptz not null default now()
);

alter table ai_summaries enable row level security;

create index if not exists ai_summaries_patient_id_idx on ai_summaries (patient_id);

-- Post-demo hardening: added a second cloud model adapter (Gemini), so the
-- 'source' column needs a third allowed value. `create table if not exists`
-- above is a no-op on a database from before this change, same reasoning
-- as every other constraint update in this file.
alter table ai_summaries drop constraint if exists ai_summaries_source_check;
alter table ai_summaries add constraint ai_summaries_source_check
  check (source in ('template', 'groq', 'gemini'));

-- Extend the audit trail with this phase's two sensitive actions, same
-- append-only table used since Phase 3.
alter table audit_events drop constraint if exists audit_events_action_check;
alter table audit_events add constraint audit_events_action_check
  check (action in (
    'view_patient', 'create_encounter', 'grant_consent', 'revoke_consent',
    'generate_summary', 'approve_summary'
  ));

-- Post-demo hardening: the referral lifecycle moves a patient's care
-- between facilities, which is exactly the kind of access the audit trail
-- exists to record, but none of its five transitions were writing to it.
alter table audit_events drop constraint if exists audit_events_action_check;
alter table audit_events add constraint audit_events_action_check
  check (action in (
    'view_patient', 'create_encounter', 'grant_consent', 'revoke_consent',
    'generate_summary', 'approve_summary',
    'create_referral', 'accept_referral', 'complete_referral',
    'reassign_referral', 'cancel_referral'
  ));

-- Postgres indexes primary keys and unique constraints automatically but
-- never foreign keys, so every lookup below was a sequential scan. Listed
-- against the query that needs each one; they matter more as the demo
-- database grows than they did when it held a dozen rows.
--
-- canAccessPatient (patients/access.ts) — runs on every cross-facility
-- record access, so this is the hottest of the set.
create index if not exists consents_patient_facility_idx
  on consents (patient_id, facility_id);
-- Patient timeline and AI summary generation.
create index if not exists encounters_patient_id_idx on encounters (patient_id);
-- A patient's own referral list.
create index if not exists referrals_patient_id_idx on referrals (patient_id);
-- The "incoming" and "outgoing" facility queues (routes/referrals.ts).
create index if not exists referrals_receiving_facility_idx
  on referrals (receiving_facility_id);
create index if not exists referrals_originating_facility_idx
  on referrals (originating_facility_id);
-- Resolving a call from its parent referral.
create index if not exists consultations_referral_id_idx on consultations (referral_id);
-- A patient's "who accessed my record" view.
create index if not exists audit_events_patient_id_idx on audit_events (patient_id);
-- The district dashboard's recent-activity feed, which reads the newest
-- 200 events on every load.
create index if not exists audit_events_created_at_idx
  on audit_events (created_at desc);

-- Post-demo hardening: a consent grant had no expiry, no stated purpose
-- and no scope — active forever until the patient manually revoked it.
-- ABDM's consent artifact model expects all three; this adds the one that
-- matters most for access control. Nullable and NOT backfilled on
-- existing rows: a pre-existing grant keeps working as "no expiry set"
-- (see the .or() clause added to canAccessPatient) rather than being
-- silently revoked by a schema change, while every new grant going
-- forward gets a real expiry from the API.
alter table consents add column if not exists expires_at timestamptz;

-- Editing a draft summary before approval was the one clinically
-- meaningful action on the audit-covered list that wasn't actually
-- writing to it.
alter table audit_events drop constraint if exists audit_events_action_check;
alter table audit_events add constraint audit_events_action_check
  check (action in (
    'view_patient', 'create_encounter', 'grant_consent', 'revoke_consent',
    'generate_summary', 'edit_summary', 'approve_summary',
    'create_referral', 'accept_referral', 'complete_referral',
    'reassign_referral', 'cancel_referral'
  ));

-- Real self-service signup, replacing the seed-script-only demo accounts.
-- profiles has no insert policy for a reason — a client picking its own
-- role is exactly the kind of write that must never be trusted to RLS.
-- This function runs as its definer (the table owner), not the calling
-- user, so it can insert on their behalf from inside the same transaction
-- that creates their auth.users row — there is no window where the user
-- exists without a profile. full_name/role/facility_id come from the
-- signUp() call's `options.data`, which Supabase copies verbatim into
-- raw_user_meta_data.
--
-- district_admin is deliberately NOT one of the roles a signup can request:
-- it's a district-wide privileged role, and raw_user_meta_data is fully
-- client-controlled (anyone can call the signup API directly with any
-- payload, bypassing the app's own role picker). Whitelisting the
-- self-service roles here — rather than trusting the client and relying on
-- profiles_role_check to merely reject garbage — is the actual security
-- boundary; a district_admin profile can only come from a direct DB write
-- by an operator, never from this trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
begin
  insert into public.profiles (id, email, full_name, role, facility_id)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    case when requested_role in ('anm_asha', 'doctor') then requested_role else 'patient' end,
    nullif(new.raw_user_meta_data->>'facility_id', '')::uuid
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A field worker provisioning a login for a patient they just registered
-- is an action on that patient's record, so it belongs in the same
-- append-only trail as every other access to it.
alter table audit_events drop constraint if exists audit_events_action_check;
alter table audit_events add constraint audit_events_action_check
  check (action in (
    'view_patient', 'create_encounter', 'grant_consent', 'revoke_consent',
    'generate_summary', 'edit_summary', 'approve_summary',
    'create_referral', 'accept_referral', 'complete_referral',
    'reassign_referral', 'cancel_referral',
    'create_patient_account'
  ));
