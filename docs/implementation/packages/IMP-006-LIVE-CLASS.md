# IMP-006 — Live Class (Zoom + Google Meet)

**SPEC_STATUS**: LOCKED FOR IMPLEMENTATION
**RECON**: Targeted IMP-006 recon COMPLETE (read-only, no source modified).
Existing Live Class code: ABSENT everywhere (no model/controller/service/migration/frontend).
Zoom: CONFIGURATION_ONLY (env credentials + settings keys, zero call code).
Google Meet: unwired placeholders only (`gmeet_enabled`, `gmeet_default_url` — no code reads them).
No Google API client dependency. No Calendar/OAuth architecture.

## Target Architecture (LOCKED)

```text
Course
  │
  └── LiveClass
         │
         ▼
   LiveClassManager
         │
         ▼
   LiveClassProvider
       /       \
    Zoom     Google Meet
```

Live Class is a **course-level entity**. Do NOT add a lesson type, touch
LessonProgress, alter certificate eligibility, or create a membership system.

## Provider Model (LOCKED)

### Zoom — Server-to-Server OAuth

Capabilities: create meeting, update meeting, cancel/delete meeting,
normalized provider response, timeout handling, HTTP error handling,
malformed-response handling.

Credentials (account ID, client ID, client secret) are SERVER-SIDE SECRETS.
Never expose via public settings, frontend, API responses, or logs.
Zoom webhook: DEFERRED — do not implement in IMP-006.

### Google Meet — Validated Stored Link

`GOOGLE_MEET_MODEL=VALIDATED_STORED_LINK`. IMP-006 does NOT create meetings
via Google API. The instructor submits an already-created Meet link; the
backend validates the URL and accepts only genuine Google Meet URLs
(`https://meet.google.com/...`). Arbitrary URLs are rejected.

`GOOGLE_CALENDAR_API=DEFERRED`. `google/apiclient=DO_NOT_INSTALL`.
No new Google OAuth/Calendar architecture. Google Maps credentials must
never be treated as Meet credentials.

## Data Model (additive `live_classes` storage)

Minimum logical fields: id, course_id (FK cascade), created_by, provider
(`zoom`|`google_meet`), provider_meeting_id (nullable), title,
scheduled_at, duration_minutes, timezone, join_url (nullable per
lifecycle/provider), status, timestamps. FK/index/constraints per
repository convention.

Persisted lifecycle: `scheduled`|`cancelled` ONLY. Do NOT persist
started/ended/completed/live. Display state (upcoming/in-session/ended)
may be derived from scheduled_at + duration_minutes without writing
provider state to the DB.

## Zoom Start/Host URL

`start_url` is sensitive provider information. Student endpoints/APIs must
NEVER return it. Do not persist `start_url` unless implementation proves it
necessary; prefer obtaining host capability through an authorized staff flow
only when needed. `join_url` and `start_url` have different authorization.

## Access Control (reuse existing)

- Instructor: manage Live Class only on owned courses (`courses.instructor_id`
  + existing ownership semantics).
- Admin: reuse `manage_courses`. No new permission unless existing contract
  demonstrably fails.
- Super Admin: existing full access.
- Student: authenticated + course published + valid Enrollment. No
  LiveClass membership table. Deny join URL to unauthorized/non-enrolled
  students; avoid existence leaks per existing API convention.

## Create Flow

request → authentication → course authorization → validation → provider
enabled validation → LiveClassManager → provider operation → normalized
result → local persistence → response.

Zoom failure: no local record, safe provider error, no raw payload/credential
leak. Google Meet: validate stored link, no external creation call.

## Update Flow

Same authorization as create. Zoom: validate → provider update → local
update; provider failure = FAIL_CLOSED (local state unchanged). Google Meet:
validate updated stored link + local update.

## Cancel Flow

Zoom: `ZOOM_CANCEL_FAILURE=FAIL_CLOSED` — provider cancel succeeds →
local status=cancelled; provider failure → local stays scheduled + safe
error + retry later. Never produce Zoom-active/local-cancelled drift.
Google Meet: local status=cancelled (no remote meeting to manage).

## Display State

Frontend may derive upcoming/in-session/ended from time, but persisted
state stays `scheduled`|`cancelled`.

## Time

Existing timezone architecture only: backend/DB follow existing timestamp
convention, app timezone convention unchanged, Live Class `timezone` stores
display/scheduling context as needed. No new timezone subsystem.

## Dashboard

Existing dashboard/layout only. Instructor course management lists/creates/
edits/cancels sessions. Super Admin/Admin see provider/business settings per
existing authorization. Students see Live Class from courses they can access.
No dashboard redesign.

## Business Settings

Existing Settings architecture may carry non-secret business configuration
(live_class_enabled, live_class_default_provider, zoom_enabled,
google_meet_enabled) under existing key governance. Provider credentials
never enter public settings. Do not expand existing Zoom placeholder exposure;
fix only if in scope and safe.

## Provider Contract

`LiveClassProvider`: `createMeeting(...)`, `updateMeeting(...)`,
`cancelMeeting(...)` — normalized application data only. Controllers must
never depend on raw Zoom payloads. The Meet stored-link provider implements
the contract without a fake external API.

## Failure Handling

Cover: timeout, connection failure, 401/403, 4xx, 5xx, malformed JSON,
missing meeting ID, missing join URL, provider unavailable, invalid Meet
URL. No silent fallback, fake success, guessed join URL, credential leak,
or raw provider exception to clients.

## Orphan Risk

Document: Zoom meeting created but local DB persistence fails. No fake
distributed transaction. Best-effort safe compensation where possible
(e.g. attempt remote delete of the just-created meeting); on compensation
failure do not loop — log secret-safe reconciliation evidence, return
failure, never treat local creation as successful. No large reconciliation
subsystem.

## Notifications

Only if existing NotificationService reuses minimally and only after
successful persistence. Provider/DB success must never depend on
notification success; notification failure must never cancel a valid meeting.

## Out of Scope

recording; automatic attendance sync; Zoom webhook; Google Calendar API;
new Google OAuth architecture; Google Meet API creation; geographic
restrictions; RajaOngkir; OpenRoute; Google Maps picker; payment changes;
CMS; lesson progress redesign; certificate redesign; frontend testing
framework; IMP-007.

## Migration Safety

ADDITIVE ONLY. Forbidden: migrate:fresh, migrate:reset, db:wipe,
destructive drops, LMS table recreation. Preserve existing data.

## Test Contract

Authorization: unauthenticated denied; student cannot manage; owner
instructor can; non-owner denied; admin manage_courses; super_admin.
Student access: enrolled+published can view/join; non-enrolled denied;
unpublished denied; cancelled gives no active join; student payload never
contains start_url/host secret.
Zoom (mocked Http::fake, never live): OAuth normalization; create/update/
cancel; timeout; 401/403; 4xx; 5xx; malformed; missing ID; missing join URL.
Google Meet: valid URL accepted; wrong domain/malformed/arbitrary URL
rejected; local create/update/cancel lifecycle.
Security: credentials absent from public settings and student responses;
raw failures not leaked.
Regression: targeted first, then full backend suite; TypeScript + static
verification + production build if frontend changed. No new frontend test
framework.

## Acceptance

Course-level entity works; Zoom S2S works via abstraction; Meet stored-link
works; ownership + enrollment enforced; secrets server-side; start_url never
student-visible; create/update/cancel correct; Zoom cancel fail-closed;
safe provider failures; additive migration; targeted + regression green;
frontend checks green where applicable; no IMP-001–005 regression; IMP-007
not started.

## DECISION LOCK

```text
ENTITY_MODEL=COURSE_LEVEL_LIVE_CLASSES

GOOGLE_MEET_MODEL=VALIDATED_STORED_LINK
GOOGLE_CALENDAR_API=DEFERRED
GOOGLE_API_CLIENT_DEPENDENCY=NONE

ZOOM_MODEL=SERVER_TO_SERVER_OAUTH
ZOOM_CREATE_MEETING=YES
ZOOM_UPDATE_MEETING=YES
ZOOM_CANCEL_MEETING=YES
ZOOM_WEBHOOK=DEFERRED

PERSISTED_LIFECYCLE=SCHEDULED|CANCELLED
DISPLAY_STATE=DERIVED_FROM_TIME
MANUAL_START_END_STATE=NO

ZOOM_CANCEL_FAILURE=FAIL_CLOSED
GOOGLE_MEET_CANCEL=LOCAL_CANCEL

PERMISSIONS=REUSE_EXISTING
INSTRUCTOR=OWN_COURSE
ADMIN=MANAGE_COURSES
SUPER_ADMIN=EXISTING_FULL_ACCESS
STUDENT=PUBLISHED_COURSE_PLUS_VALID_ENROLLMENT

RECORDING=OUT_OF_SCOPE
ATTENDANCE_SYNC=OUT_OF_SCOPE
GEOGRAPHIC_RESTRICTION=OUT_OF_SCOPE

SERVER_SECRETS=ENV_ONLY
ZOOM_START_URL=NEVER_STUDENT_VISIBLE
JOIN_URL=ENROLLMENT_GATED

MIGRATION=ADDITIVE_ONLY

IMP001_005=DO_NOT_TOUCH
IMP007=DO_NOT_START
```
