# SwasthyaSetu

Role-based care-continuity platform for rural healthcare (SIH 2026 prototype):
patients, ANM/ASHA field workers, doctors and district admins share a
consent-controlled record via a QR digital health ID, offline-first field
workflows and referral tracking.

This repo is being built phase-by-phase per
`SwasthyaSetu_Architecture_and_Phase_Wise_Development_Groq_FINAL2.docx`.
Each phase is a gate: don't move to the next one until its exit test passes.

**Status: Phase 9 — District Dashboard & Hardening.**

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

All accounts use the password `Demo@1234` — synthetic accounts only, per the
architecture doc's guardrail against paid SMS OTP / real accounts here.

| Role | Email | Notes |
| --- | --- | --- |
| Patient | patient@demo.swasthyasetu.app | Linked to **Sunitha Reddy** — cardiac referral history: BP checks, an accepted+completed referral, and a completed teleconsultation. |
| Patient | patient2@demo.swasthyasetu.app | Linked to **Ramesh Kumar** — a separate, simpler history: routine diabetes/BP follow-ups, no referral. Useful for showing two distinct patients side by side. |
| ANM/ASHA | anm@demo.swasthyasetu.app | Kondapalli Sub Center |
| Doctor | doctor@demo.swasthyasetu.app | Vijayawada Government General Hospital |
| District Admin | admin@demo.swasthyasetu.app | |

A patient login is linked to its `patients` row via `user_id`, set directly
in the database (there's no self-service "link my account" flow yet) — see
`apps/api/scripts/seedUsers.ts` for account creation and the patient record
itself is created the normal way (an ANM/ASHA registers it).

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

## Phase 3 exit test

The `anm_asha` and `doctor` demo accounts are seeded at *different*
facilities (Kondapalli Sub Center vs. Vijayawada Government General
Hospital), which makes this directly testable: sign in as
`doctor@demo...` and try **Search Patients** → open a patient the ANM
registered → 403 ("Your facility doesn't have access... needsConsent").
Sign in as `patient@demo...` → **Manage Consent** → grant access to the
doctor's facility. Now the doctor can open the same patient, view/add to
the timeline (`apps/api/src/routes/encounters.ts`, append-only — no
edit/delete route exists). Back as the patient, **Manage Consent** →
**Revoke access** — the doctor is immediately locked out again
(`apps/api/src/patients/access.ts`, checked in one place for every
patient-record route via `requirePatientAccess`). **My Audit Log** shows
every one of those steps (`grant_consent`, `view_patient`,
`create_encounter`, `revoke_consent`) with who did it and when. ✅

## Phase 4 exit test

From a patient's detail screen (**Search Patients** → open one), **Refer
this patient** → pick a different facility → reason → **Create Referral**
(status `pending`). Sign in as `doctor@demo...` at the receiving facility:
**Incoming Referrals** shows it; open it → **Accept Referral** (`accepted`)
→ **Mark Completed** with outcome notes (`completed`). Completing a
referral both updates the referral's own status *and* writes an ordinary
append-only encounter into the patient's timeline
(`apps/api/src/routes/referrals.ts`) — exactly the "updates both the
referral view and patient timeline" the exit test asks for. Meanwhile the
ANM who created it (or the patient, via **My Referrals**) sees the status
change live over Socket.IO (`REFERRAL_CHANGED_EVENT`) without refreshing —
verified by connecting a second client and watching the `accepted`/
`completed` events arrive the instant the doctor acts. A referral can also
be **reassigned** (while pending, by the receiving facility) or
**cancelled** (by either facility, while pending/accepted). Access to a
referral is separate from patient consent: it's granted to whichever two
facilities the referral itself is between, regardless of the general
consent state on that patient. ✅

## Phase 5 exit test

Turn on airplane mode, sign in as `anm@demo...` (session persists locally),
open a patient and **Save Visit** — it saves instantly to an on-device
outbox (`apps/mobile/lib/outbox.native.ts` — SQLite; `outbox.web.ts` uses
AsyncStorage instead, since expo-sqlite's web backend needs
cross-origin-isolation headers this dev setup doesn't provide) and appears
in the timeline
tagged "Waiting to sync", no network required. Do the same for **Create
Referral**. Reconnect: `SyncContext` (`apps/mobile/context/SyncContext.tsx`)
notices via `@react-native-community/netinfo` and flushes the outbox
automatically, tagging each request with an `Idempotency-Key` header. The
**server receives exactly one logical operation** even if a request is
retried after the device never saw the first response — verified directly:
POSTing the same encounter (and separately, the same referral) twice with
the same idempotency key returns `201` then `200` with the *identical*
row id both times, and the patient's timeline / facility's referral queue
contains exactly one entry, not two (`apps/api/src/idempotency.ts`). The
**Sync Status** screen exposes queue state (waiting / syncing / synced /
failed) with per-item retry. Per the guardrail below, there's no "update" to
reconcile: encounters stay append-only and referral creation is the only
offline-queued mutation, so there's no last-write-wins conflict to resolve
in the first place. ✅

*(The idempotent-retry guarantee above — the hard part — was verified
directly against the API. Actual device airplane-mode behavior, SQLite
persistence across app restarts, and the NetInfo reconnect listener firing
in practice need a real device/emulator to confirm; this dev environment
can't toggle real network hardware.)*

## Phase 6 exit test

On an **accepted** referral's detail screen (a consultation only makes
sense mid-referral — "ACCEPTED -> consultation/assessment -> COMPLETED" per
the architecture doc's data flow), either side sees a **Teleconsultation**
card: pick Video or Audio-only, **Start Teleconsultation**. This creates a
`waiting` session (`apps/api/src/routes/consultations.ts`) and opens the
call screen, which requests camera/mic and joins a Socket.IO signaling room
scoped to that consultation (`apps/api/src/realtime/socket.ts` — access is
inherited from the parent referral's own facility rule, not a new one). The
other side sees **Join Consultation** appear live and taps it — the WebRTC
offer/answer/ICE exchange is relayed peer-to-peer through the server, which
never inspects or stores it, using only public STUN (no TURN, per the
guardrail: this works on LAN/direct paths, not through every NAT). Either
side can toggle video off for a weak link without dropping the call. On
**End Call**, the session is marked `ended` with a computed duration, *and*
an ordinary append-only encounter documenting it is written to the
patient's timeline — **returning to the patient record with consultation
metadata saved**, exactly as the exit test asks. ✅

*(Verified directly: two Socket.IO clients join the same consultation's
signaling room and a relayed SDP offer reaches only the other peer, not an
echo back to the sender; a third, unrelated account is rejected from
joining; the full join → end REST lifecycle produces the right status
transitions, duration, and timeline entry. This sandboxed environment's
browser pane blocks real camera/microphone capture entirely (confirmed:
`getUserMedia` returns `NotAllowedError`), so actual audio/video frames
flowing between two real devices needs hardware this dev environment
doesn't have — the signaling, access control and session lifecycle around
that media path are what's been verified here.)*

## Phase 7 exit test

From a patient's detail screen (any role with access), tap **AI Summary →**.
**Generate AI Summary** (ANM/ASHA or doctor) builds a draft straight from
that patient's recorded visits: a deterministic template first
(`apps/api/src/ai/template.ts`, always available), optionally rewritten by
a Groq-hosted model with a triage signal if `GROQ_API_KEY` is configured
(`apps/api/src/ai/groqClient.ts` — falls back to the template on any
missing key, network failure, or a reply that fails the hand-rolled JSON
Schema check, never blocking the feature). Signed in as `doctor@demo...`,
the draft is editable inline; **Approve** saves the final text with
`status: approved`, `reviewed_by`, `approved_at`, and the `model`/
`model_version` that produced it (`apps/api/src/routes/summaries.ts`) —
exactly "approved result is saved with model/version metadata." A
`patient` account only ever sees approved summaries, never a pending draft
(`GET /api/patients/:id/summaries` filters by status for that role). ✅

*(Verified directly against the API with a live Groq key: generating a
summary for a patient's real encounter timeline returns a Groq-authored
narrative plus a triage signal (`source: "groq"`, `model:
"openai/gpt-oss-20b"`), a doctor's edit+approve call returns `status:
"approved"` with `reviewedByName` and `modelVersion` set, and the patient's
own summaries list correctly excludes it until approved. Also confirmed:
without a patient the caller has access to, the same access rule used
everywhere else in the app (facility match or active consent) correctly
rejects the request — a summary is not a bypass around consent. The
template-only fallback path (no Groq key, or a bad/decommissioned model
id) was hit and confirmed working during this session before the key was
supplied.)*

## Phase 8 exit test

A language switcher (English / हिंदी / తెలుగు) on the Home screen
(`apps/mobile/lib/i18n.tsx`) changes the welcome text, role label and every
nav item's label immediately, with no navigation reset or crash — the
routes underneath are unchanged, only the labels are looked up through
`t()`. This is a deliberately scoped slice of the architecture doc's fuller
Phase 8 (which also covers speech input and icon-led guided workflows
app-wide) given the demo timeline; the mechanism it proves — swap language,
core navigation still works — is what the exit test asks for. ✅

## Phase 9 exit test

Signed in as `admin@demo...`, **District Dashboard** calls
`GET /api/admin/dashboard` (`apps/api/src/routes/dashboard.ts`,
`district_admin`-only) and shows referral counts by status, average
time-to-accept (the bottleneck signal), and per-facility load (patient
count, incoming/outgoing/pending referral counts) — aggregated numbers
only, no patient name or clinical note ever leaves this endpoint, per the
guardrail. Recent audit activity is shown as action counts, not individual
patient-level rows. ✅

## Guardrails (see the architecture doc for the full list)

- No real patient data, ever, in this environment — synthetic/demo data only.
- Secrets (Supabase service role key, and later the Groq API key) live only
  in `apps/api/.env`. They must never reach the mobile bundle.
- Database is the source of truth. Socket.IO (`apps/api/src/realtime`) only
  distributes changes; every referral screen re-fetches via REST regardless,
  so a missed or duplicated event can never leave the UI wrong.
- No blind last-write-wins on clinical facts: encounters are append-only
  (no edit/delete route exists) and the only offline-queued mutations are
  creates (a visit, a referral) — never an update to a mutable field.
- No paid TURN infrastructure: teleconsultation uses public STUN only, so
  it works on LAN/direct paths but not through every NAT — a documented,
  intentional limitation of the free-cost prototype, not a bug.
- AI is assistance, not autonomous diagnosis: every summary starts as
  `draft` and a doctor must review/edit and approve it before a patient
  ever sees it; the triage signal always carries a plain-language rationale
  instead of a bare label to trust blindly.
- The district dashboard is read-optimized and aggregated only — counts and
  averages, never individual patient names or notes.

## Other commands

```bash
npm run lint
npm run typecheck
```
