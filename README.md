# SwasthyaSetu

Role-based care-continuity platform for rural healthcare (SIH 2026 prototype):
patients, ANM/ASHA field workers, doctors and district admins share a
consent-controlled record via a QR digital health ID, offline-first field
workflows and referral tracking.

This repo is being built phase-by-phase per
`SwasthyaSetu_Architecture_and_Phase_Wise_Development_Groq_FINAL2.docx`.
Each phase is a gate: don't move to the next one until its exit test passes.

**Status: Phase 2 — Patient Profile & QR Digital Health ID.**

## Structure

```
apps/
  mobile/   Expo (React Native) app — Patient / ANM-ASHA / Doctor UI
  api/      Node.js + Express backend — the only thing that talks to Supabase and Groq
packages/
  shared-types/   TypeScript types shared between mobile and api
supabase/
  schema.sql      Postgres schema (source of truth), extended every phase
```

Modular monolith, not microservices: one mobile codebase for every role, one
backend with separated domain modules. See `AGENTS.md` for the Expo version
note and the architecture doc for the full rationale.

## Prerequisites

- Node.js LTS
- A free [Supabase](https://supabase.com) project (Project Settings → API for
  the URL and service role key)

## Setup

```bash
npm install
```

```bash
cp apps/api/.env.example apps/api/.env
# fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

Run `supabase/schema.sql` against your Supabase project (SQL Editor in the
dashboard, or the Supabase CLI) to create the tables. It's idempotent, so
re-running it after a later phase adds more tables is safe.

```bash
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_API_URL defaults to http://localhost:4000, which is fine for
# local development
```

## Run

```bash
npm run dev:api        # Express API on http://localhost:4000
npm run seed            # optional: inserts synthetic demo facilities
npm run seed:users      # creates one demo login per role (see below)
npm run dev:mobile      # Expo dev server (press w for web, or scan the QR code)
```

Opening the mobile app with no session redirects to Sign In. Once signed in,
the Home screen shows your resolved role, role-specific navigation, and two
live checks against the backend (`GET /api/auth/me`, and an admin-only
endpoint to prove RBAC is enforced server-side, not just hidden in the UI).

### Demo accounts (`npm run seed:users`)

All four use the password `Demo@1234` — synthetic accounts only, per the
architecture doc's guardrail against paid SMS OTP / real accounts here.

| Role | Email |
| --- | --- |
| Patient | patient@demo.swasthyasetu.app |
| ANM/ASHA | anm@demo.swasthyasetu.app |
| Doctor | doctor@demo.swasthyasetu.app |
| District Admin | admin@demo.swasthyasetu.app |

## Phase 0 exit test

Clone, `npm install`, start the API, start the mobile app, and see the
mobile app report `Connected` / `database: connected` once Supabase is
configured. ✅

## Phase 1 exit test

Sign in as each of the four demo accounts above: navigation differs by role,
`GET /api/auth/me` resolves the right role/facility, and `GET /api/admin/ping`
returns 200 only for `district_admin` and 403 for everyone else — enforced
in `apps/api/src/auth`, not in the mobile UI. ✅

## Phase 2 exit test

Sign in as `anm@demo.swasthyasetu.app` (or `doctor@...`) → **Register
Patient** → fill in a name/DOB/sex → the app generates an opaque QR digital
health ID (`SS-XXXXXXXXXX`, `apps/api/src/patients/generateHealthId.ts`) and
shows the new patient record. **Search Patients** finds them by name or
health ID. **Scan Patient QR** opens the camera (`expo-camera`) and, on a
successful scan, resolves straight to that same authorized record via
`GET /api/patients/health-id/:healthId` — on a second physical device this is
exactly "ANM scans a QR and reaches the correct patient record." Signed in as
`patient@demo...`, **My Health ID (QR)** renders that patient's own QR code
(once a field worker links a patient record to their account) via
`GET /api/patients/me`. The `patient` role gets 403 from every staff-only
patient endpoint. ✅

## Guardrails (see the architecture doc for the full list)

- No real patient data, ever, in this environment — synthetic/demo data only.
- Secrets (Supabase service role key, and later the Groq API key) live only
  in `apps/api/.env`. They must never reach the mobile bundle.
- Database is the source of truth. Realtime (Socket.IO, later phases) only
  distributes changes; it never replaces persistence.

## Other commands

```bash
npm run lint
npm run typecheck
```
