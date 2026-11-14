# Phase 3 — Task templates, checklists, RACI, execution and approvals

Date: 14 November 2026. Branch: `feature/phase3-tasks-raci-approvals`, started from `main` at `ea4f077` (newer than the requested `3f0fe9e`; it adds the Phase 2 deployment record and a greeting fix).

## Phase 2 activation gate (verified live, read-only unless stated)

| Check                 | Result                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project / billing     | `facilityos-43386`, Cloud Billing reports `billingEnabled: false` (Spark)                                                                                                                   |
| Rules                 | Deployed rules match `firebase/firestore.rules` byte-for-byte (verified after the Phase 2 deploy)                                                                                           |
| Indexes               | All 119 Phase 0–2 composite indexes `READY`                                                                                                                                                 |
| Live CRUD smoke       | As `admin@flowbee.io` in company GBH: department `SMOKE-P2` created, edited, archived and read back at revision 3; no page errors. The archived record remains (records are never deleted). |
| Legacy site migration | **Not required.** GBH has one site, already schema 2 with no client/contract fields. No dry-run or migration was run.                                                                       |
| Emulator suites       | All Phase 0/1/2 suites pass on this branch                                                                                                                                                  |

## Module status

| Module                                                                                                                                                                                | Status                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task categories (one subcategory level, responsible department)                                                                                                                       | Complete and tested                                                                                                                                                                                                             |
| Task template builder (6 steps: information, checklist, evidence, responsibilities, assignment defaults, review & publish)                                                            | Complete and tested                                                                                                                                                                                                             |
| Checklist question builder (16 answer types, sections, drag/arrow reordering, choices, allowed/expected/critical ranges, conditional follow-ups with loop detection, escalation flag) | Complete and tested                                                                                                                                                                                                             |
| Template versioning (draft → published → retired, immutable published versions, copy into new draft)                                                                                  | Complete and tested                                                                                                                                                                                                             |
| Evidence requirements                                                                                                                                                                 | Configurable per question; photo needs Cloud Storage (Phase 4), QR/GPS need the mobile app (Phase 6). Submissions record evidence as **pending**, never as captured. Required photo/QR/GPS questions cannot be published.       |
| RACI matrix (designation, department, team or employee; optional site scope; snapshot on task)                                                                                        | Complete and tested. RACI grants no access.                                                                                                                                                                                     |
| Assignment configuration (employee, department, team, shift, site) with eligible-employee preview                                                                                     | Complete; manual assignment only (scheduler is Phase 4)                                                                                                                                                                         |
| Manual task creation with frozen version snapshot                                                                                                                                     | Complete and tested                                                                                                                                                                                                             |
| Task lifecycle and timeline                                                                                                                                                           | Complete and tested                                                                                                                                                                                                             |
| Execution: start, pause, resume, save progress, submit                                                                                                                                | Complete and tested **for owners/admins**                                                                                                                                                                                       |
| Submissions (immutable attempts) and exceptions                                                                                                                                       | Complete and tested                                                                                                                                                                                                             |
| Approval, rejection and rework (no self-approval)                                                                                                                                     | Complete and tested                                                                                                                                                                                                             |
| Task dashboard, register, assignments board, approvals inbox, history                                                                                                                 | Complete and tested                                                                                                                                                                                                             |
| Staff / technician execution                                                                                                                                                          | **Blocked by design.** Only owner/admin memberships have portal access. Staff access needs role- and site-scoped rules that are not built yet; staff are not made admins as a workaround. Planned with the staff web (Phase 5). |
| Scheduled generation, work orders, notifications, uploads                                                                                                                             | Not started (Phase 4); nothing in the UI claims they work                                                                                                                                                                       |

## Task workflow

```
pending ──assign──▶ assigned ──start──▶ in_progress ──submit──▶ awaiting_approval ──approve──▶ completed
   ▲  (reassign) ◀── paused ◀──pause──┘     ▲ resume            │                 └─reject──▶ rejected
   │                                       │                    └─request rework─▶ rework_required ──restart (attempt+1)──▶ in_progress
cancel (with reason) from pending, assigned, in_progress, paused, rework_required ─▶ cancelled
```

Without approval, submit goes straight to `completed`. "Submitted" is recorded as the submission event; overdue is derived (`dueAt` passed and not terminal) and never replaces the status. Every transition writes the task and a numbered timeline event (`taskEvents/{taskId}_{revision}`) in one transaction; the rules reject any status change without its matching event, any transition not in the table, and any stale revision.

## Data model

See [Phase 3 schema](database/phase3-schema.md). Key points:

- `taskCategories` and `taskTemplates` are master records using the generated Phase 2 rule machinery.
- `templateVersions/{templateId}-v{n}` hold the checklist, sections, RACI and assignment defaults. Published versions are frozen.
- `tasks` store an exact copy of the published version content; the rules compare it with the version at creation.
- `taskSubmissions/{taskId}_{attempt}` and `taskApprovals/{taskId}_{attempt}` are create-only; the attempt-keyed IDs prevent duplicate submissions and duplicate decisions.
- `taskExceptions` are created from out-of-range or failed answers and from manual "Report issue". They can be acknowledged and closed; they do not create work orders.
- `occurrenceKey` is reserved for deterministic Phase 4 schedule occurrences (manual tasks use `''`).

## Security

- All new collections: canonical active owner/admin membership of an active company; no cross-company reads or writes; no deletes.
- Template versions: drafts editable; publishing requires at least one question; published versions can only be retired.
- Task creation: version must be published and match the snapshot; site active; location/facility/asset in the same site and active.
- Submissions are bound to the in-progress attempt; reviews require `awaiting_approval`, a reason for rework/reject, and a reviewer who did not submit the attempt.
- Timeline, submissions and decisions are append-only. They are attributed to signed-in users and protected by rules; they are **not** an independent tamper-proof audit trail (that needs a trusted backend).
- Employee assignees are validated by the transaction, not by rules (rules cannot iterate lists within budget).

Indexes: 28 new composite indexes (147 total of 200), generated and checked by `rules-sync.test.ts`.

## Verification (executed on this branch)

- `npm run format:check`, `lint`, `typecheck`, `build`: pass.
- `npm test`: 49 unit tests pass (10 new for answer types, ranges, conditional loops, publish gates, transitions, overdue).
- `npm run test:rules`: 63 emulator tests pass, including 8 new Phase 3 tests: immutable versions, snapshot preservation, forged snapshot and status jumps, cross-company/staff denial, full start → submit → rework → resubmit → approve, no-approval completion, self-approval denial, duplicate decisions, concurrent transitions, exceptions, overdue counts.
- `npm run test:migration`: pass.
- `npm run test:browser`: 14 checks pass at 1440×1000, 768×1024 and 390×844, including the Phase 3 flow with two users (owner submits, supervisor requests rework and approves). Evidence: [docs/evidence/phase3](evidence/phase3).

## Deployment status

- Code is on `feature/phase3-tasks-raci-approvals`; **not merged to `main`** (merge requires explicit authorisation) and therefore not on GitHub Pages.
- **Phase 3 Firestore rules and the 28 new indexes are not deployed.** Before merging: deploy rules and indexes to `facilityos-43386`, wait for READY, then merge so Pages publishes the UI. The new rules only add collections; Phase 0–2 behaviour is unchanged.
- No isolated test environment exists besides the main-branch Pages site; local emulators were used for all Phase 3 testing.

## Limitations and follow-ups

- Staff/technician execution is blocked until scoped permissions exist (see above).
- Multi-stage approvals are prepared in the data model (one decision per attempt) but only a single review stage is offered.
- Approval-inbox filters cover status plus one of site, department, priority or assignee at a time (each combination has an index).
- Photo/QR/GPS evidence is configurable but not capturable until Phase 4/6.
- Dashboard metrics use server-side count queries; large historical reports need scheduled aggregates (Phase 7).

## Phase 4 readiness

Templates, versions, assignment rules, RACI snapshots, deterministic occurrence keys and the exception records are in place for the Phase 4 scheduler, work orders and notifications. Phase 4 has not been started.
