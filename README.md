# SwasthyaSetu

Role-based care-continuity platform for rural healthcare (SIH 2026 prototype):
patients, ANM/ASHA field workers, doctors and district admins share a
consent-controlled record via a QR digital health ID, offline-first field
workflows and referral tracking.

This repo is being built phase-by-phase per
`docs/SwasthyaSetu_Architecture_and_Phase_Wise_Development_Groq_FINAL2.docx`.
Each phase is a gate: don't move to the next one until its exit test passes.
For a narrative walkthrough with diagrams (architecture, the patient
journey, and the AI summary flow in detail), see
`docs/SwasthyaSetu_Overview.pdf`.

**Status: Phase 9 — District Dashboard & Hardening.**

## Structure

```
apps/
  mobile/   Expo (React Native) app — Patient / ANM-ASHA / Doctor UI
  admin/    React + Vite web console — District Admin dashboard (Phase 9)
  api/      Node.js + Express backend — the only thing that talks to Supabase, Groq and Gemini
packages/
  shared-types/   TypeScript types shared across mobile, admin and api
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
| Doctor | doctor2@demo.swasthyasetu.app | Ibrahimpatnam PHC — a second facility/doctor, for demoing a referral that crosses two facilities neither of which is the ANM's own (e.g. Vijayawada → Ibrahimpatnam). |
| District Admin | admin@demo.swasthyasetu.app | |

A patient login is linked to its `patients` row via `user_id`, set directly
in the database (there's no self-service "link my account" flow yet) — see
`apps/api/scripts/seedUsers.ts` for account creation and the patient record
itself is created the normal way (an ANM/ASHA registers it). That link is
per-patient-row, not per-account: `apps/admin`'s **Reset demo data** clears
the `patients` table, so after a reset `patient@...`/`patient2@...` are
logins with no linked record until a new patient is registered and
re-linked the same way.

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
that patient's recorded visits, through an escalating chain
(`apps/api/src/ai/generate.ts`):

1. A deterministic template (`apps/api/src/ai/template.ts`) — always
   available, no model call, this is what Phase 7's Build sequence starts
   with per the architecture doc.
2. Groq (`apps/api/src/ai/groqClient.ts`), if `GROQ_API_KEY` is set — a
   real narrative rewrite plus a triage signal.
3. Gemini (`apps/api/src/ai/geminiClient.ts`), if `GEMINI_API_KEY` is set —
   tried only when Groq is unset or fails, so one vendor's outage or a
   decommissioned model (which happened once already to the Groq model id
   this used) doesn't take the feature down with it.

Every model reply — from either provider — is run through the same real
JSON Schema (`apps/api/src/ai/schema.ts`, via `ajv`), not a hand-rolled
check: anything that doesn't validate is treated exactly like a network
failure and the chain moves on. Each cloud adapter also retries once
(`apps/api/src/ai/retry.ts`) before giving up. Signed in as `doctor@demo...`,
the draft is editable inline; **Approve** saves the final text with
`status: approved`, `reviewed_by`, `approved_at`, and the `model`/
`model_version` that produced it (`apps/api/src/routes/summaries.ts`) —
exactly "approved result is saved with model/version metadata," and
`model` records the concrete resolved version (e.g. `gemini-3.5-flash-lite`
behind the `gemini-flash-lite-latest` alias), not just the alias name. A
`patient` account only ever sees approved summaries, never a pending draft
(`GET /api/patients/:id/summaries` filters by status for that role). ✅

*(Verified directly against the API, live, for every link in the chain:
Groq succeeding end-to-end with a real key; Groq failing (invalid key) and
Gemini genuinely taking over, independently verified with its own real
key; both failing and the deterministic template being served instead; a
doctor's edit+approve call returning `status: "approved"` with
`reviewedByName` and `modelVersion` set; and the same facility/consent
access rule used everywhere else in the app correctly rejecting a summary
request for a patient the caller has no access to — a summary is not a
bypass around consent.)*

## Phase 8 exit test

A language switcher (English / हिंदी / తెలుగు) on the Home screen defaults
to the device's own language (`expo-localization`) and falls back to
English otherwise; switching it live re-translates every screen's labels,
placeholders, buttons and native header titles through `i18n-js`
(`apps/mobile/lib/i18n.tsx`) — the free-stack pairing Expo's own
localization guide recommends, not a hand-rolled lookup table. Routes
never reset or crash on a language switch, satisfying "language can switch
without breaking core navigation."

The rest of the exit test — "a user can complete a simple field workflow
with guided interaction" — is built out concretely, not just claimed:

- **Icon-led actions**: every Home nav item and primary action button
  (Refer, AI Summary, view audit log) pairs an icon with its label
  (`@expo/vector-icons`), for a low-literacy user who recognizes a symbol
  faster than they read a phrase.
- **Large touch targets**: nav rows, language chips, and sex-selection
  chips are all built to at least a 44×44 touch target, not just whatever
  the text happened to need.
- **Guided prompts**: Register Patient's three fields are numbered
  ("Step 1 of 3", etc.) with a one-line hint under each label explaining
  what to enter and why, rather than a bare field with no context.
- **Speech input for selected fields**: a mic button next to "Record a
  visit" and "Reason for referral" (`components/VoiceInputButton.tsx`)
  transcribes speech into the field, localized to the current language
  (`en-IN`/`hi-IN`/`te-IN`). This uses the browser's native
  `SpeechRecognition` API on web — checked `docs.expo.dev/versions/v57.0.0`
  first, per `AGENTS.md`, and confirmed `expo-speech` is text-to-speech
  only. Real speech *recognition* on native needs a config-plugin native
  module (`expo-speech-recognition`), which needs a custom development
  build and would drop this project out of the Expo-Go workflow it's used
  throughout. On native, the mic button honestly reports "not available in
  this build" instead of silently doing nothing. Per the guardrail — voice
  complements the interface, never replaces it — typing always works
  everywhere regardless. ✅

*(Verified directly: switching to Telugu re-translates the entire Home
screen including the native header title, immediately, with no crash;
switching languages persists through a full sign-out/sign-in cycle
resetting to device default as designed. The web mic button was clicked
live and correctly invoked the browser's real `SpeechRecognition` API — a
genuine microphone permission prompt fired — the surrounding sandbox
blocks device audio capture here, the same known limitation already
documented for Phase 6's camera, not a code issue; the button's error
handling was confirmed to cleanly reset to idle rather than getting stuck.)*

## Phase 9 exit test

A district admin's job is at a desk, not a field phone — so per the
architecture doc's free stack ("React/Vite + free static hosting"), this
is a **separate web console** (`apps/admin`), not a screen bolted onto the
mobile app. Sign in at `apps/admin` (`npm run dev:admin`, or
`admin@demo...` / `Demo@1234` once deployed) and the dashboard calls
`GET /api/admin/dashboard` (`apps/api/src/routes/dashboard.ts`,
`district_admin`-only, gated the same way every other admin-only route in
this app is) to show:

- **Referral bottlenecks**: counts by status, plus two separate latency
  signals — average time to *accept* (the queue-wait stage) and average
  time to *complete* (the assessment-in-progress stage) — distinguishing
  where a referral is actually getting stuck.
- **Facility load**: patients, incoming/outgoing/pending referrals per
  facility.
- **Sync health**: how many visits and referrals arrived through the
  on-device offline outbox (Phase 5) vs. created directly online — the
  only signal of that path visible from the server, since the outbox
  itself lives on the device, not in this database.
- **Audit activity**: action counts, not individual patient-level rows.

No patient name, note, or other clinical detail crosses this endpoint at
any point — every field is either a count, an average, or a facility
name, per the guardrail.

**Test-data reset & demo-mode controls**, also called for in the Build
list: `POST /api/admin/reset-demo-data` clears every synthetic
transactional row (patients, encounters, referrals, consultations, AI
summaries, consents, audit log) back to a clean slate, in FK-safe delete
order — facilities and login accounts are untouched, since those are the
environment, not test data. Guarded twice: a typed confirmation phrase in
the UI (the button stays disabled without it) *and* the same phrase
required server-side in the request body, so a client bypass still can't
trigger it blind. ✅

(The mobile app's own `Dashboard` screen from the earlier demo pass still
exists as a lightweight companion view against the same endpoint — useful
for a quick glance from a phone — but `apps/admin` is the authoritative
Phase 9 console the doc describes, with the reset controls and full
metric set that only exist there.)

*(Verified live: the dashboard renders real aggregated numbers from the
actual database, including a real accept→complete latency and real
offline-vs-online sync counts reflecting genuine outbox activity from
earlier in this project. The reset endpoint's guards were verified
directly — a wrong confirmation phrase returns 400, a non-admin role
returns 403 — without actually running the reset against this session's
demo data.)*

## Guardrails (see the architecture doc for the full list)

- No real patient data, ever, in this environment — synthetic/demo data only.
- Secrets (Supabase service role key, Groq and Gemini API keys) live only
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

## Deploying (for a hosted demo)

Three pieces deploy to different places, because only one of them can be
serverless:

| Part | Host | Why |
| --- | --- | --- |
| Express API + Socket.IO | Render (`render.yaml`) | Socket.IO holds persistent WebSocket connections; a serverless function can't keep one open. |
| Expo web export (mobile) | Vercel (`vercel.json`) | Pure static SPA output (`web.output: "single"`), which is what Vercel serves best. |
| Admin console (`apps/admin`) | A second Vercel project | Also a static build (Vite), per Phase 9's free stack — but a separate Vercel project from the mobile one, since they build from different commands/output directories. |

**Live URLs:**

| Part | URL |
| --- | --- |
| API | `https://swasthya-setu-api-zx9d.onrender.com` |
| Mobile web | `https://swasthyasetu.vercel.app` |
| Admin console | `https://swasthyasetu-admin.vercel.app` |

Render assigns the API's hostname itself (not the plain `swasthya-setu-api.onrender.com` the service name would suggest) — use the URL above, not a guessed one, when setting `EXPO_PUBLIC_API_URL`, `VITE_API_URL`, or `CORS_ORIGINS`.

All three build from the **repo root**, not from inside `apps/*` — npm
workspaces hoists dependencies and symlinks `@swasthya-setu/shared-types`
into the root `node_modules`, so installing from a subdirectory wouldn't
resolve it.

**Render** (backend): point it at this repo, it reads `render.yaml`. Set
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY` and
`GEMINI_API_KEY` in the Render dashboard — never in a committed file.
Render injects its own `PORT`, which `apps/api/src/env.ts` already respects.

**Vercel — mobile web**: point it at this repo, it reads `vercel.json`. Set
the three `EXPO_PUBLIC_*` variables in the Vercel dashboard —
`EXPO_PUBLIC_API_URL` must be the deployed Render URL
(`https://swasthya-setu-api-zx9d.onrender.com`, see the live URLs table
above — Render assigns this hostname, it isn't derived from the service
name), since these are inlined into the bundle at build time, not read at
runtime. The `EXPO_PUBLIC_SUPABASE_ANON_KEY`
is a publishable key and safe in a client bundle; the service role key is not
and never leaves the backend.

**Vercel — admin console**: create a **second** Vercel project pointing at
the same repo, and in that project's own dashboard settings (not
`vercel.json`, which is already claimed by the mobile build) override the
build command to `npm run build:admin` and the output directory to
`apps/admin/dist`. Set the three `VITE_*` variables from
`apps/admin/.env.example`, same `EXPO_PUBLIC_API_URL`-style reasoning: the
anon key is safe client-side, `VITE_API_URL` should be the Render URL.

### Showing multiple roles at once in a browser

The Supabase session is persisted in `AsyncStorage`, which on web is
`localStorage` — **shared across every tab of the same browser on the same
origin**. So opening several tabs and logging into each as a different role
does not work: the last login wins and the other tabs silently become that
user. To demo several roles side by side, give each one its own storage:
separate browser profiles (Chrome/Edge → Add profile), or different browsers
entirely. One role per profile, same URL.

## Other commands

```bash
npm run lint
npm run typecheck
npm run build:api      # compiles shared-types, then the API, to dist/
npm run build:web      # static Expo web export to apps/mobile/dist/
```

`packages/shared-types` is compiled (not consumed as raw `.ts`) because the
production API runs `node dist/server.js`, and plain Node can't `require()` a
TypeScript file the way `tsx` and Metro can. The root `postinstall` builds it
automatically after `npm install`, so a fresh clone works without extra steps.
