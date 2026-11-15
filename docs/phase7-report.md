# Phase 7 — Reports, management dashboard, customer portal and operational hardening

Date: 15 November 2026. Branch `feature/phase7-reports-customer-portal`, started from `feature/phase6-mobile-apps` at `8bacc96` (Phase 6 is not yet merged; both phases await release authorisation).

Firebase stays on **Spark**. No billing change, no Cloud Functions, no Cloud Storage, no new project or database. `fms.flowb.io` and its DNS untouched. Nothing was deployed and nothing was merged to `main` in this phase.

## What was built

| Area                     | Where                                                                                                                                                                           | Notes                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Report engine            | `packages/shared/src/reports.ts`                                                                                                                                                | Pure functions + report definitions (columns, filters, date field, page size) reused by screens now and by Phase 8 exports later                               |
| Task timing              | `tasks.startedAt / submittedAt`                                                                                                                                                 | Server timestamps enforced by rules; forged values refused                                                                                                     |
| Management dashboard     | Reports & analytics → Management dashboard                                                                                                                                      | Server count aggregates (open, overdue, awaiting approval, completed) + period metrics, sites needing attention, cases raised (incl. from the customer portal) |
| Reports                  | Task performance, Staff productivity, Site performance, Maintenance & costs, Asset performance, Inventory reconciliation, Attendance, SLA performance, Compliance & inspections | Period (7/30 days, month, custom) and site filters; every screen states its definitions and warns when a period is too large to read fully                     |
| Maintenance costs        | `maintenanceCosts`                                                                                                                                                              | Admin-only, append-only; costs never mixed with asset purchase value; mixed currencies flagged                                                                 |
| Compliance               | `complianceRecords`                                                                                                                                                             | "Valid" only when verified **with** an evidence reference; expiring ≤30 days / expired / evidence pending                                                      |
| Customer portal          | `apps/customer-web`, published at `/FMS/customer/`                                                                                                                              | Overview, My locations, Service requests (new, detail, messages, confirm, ask to reopen), Service history, Updates, Profile                                    |
| Customer access          | Administration → Customer access                                                                                                                                                | Link a provisioned customer login to one client, optionally restricted to ≤10 allocations; revoke/restore                                                      |
| Customer requests intake | Issues & escalations → Customer requests                                                                                                                                        | Take in → complaint (`sourceType: service_request`, deterministic ID, SLA from submission time); team replies; status reconciliation                           |
| Operational monitoring   | Administration → Operational monitoring                                                                                                                                         | Scheduler freshness and errors, overdue tasks, breached cases, requests awaiting intake, recent runs                                                           |
| Audit history            | Administration → Audit history                                                                                                                                                  | Combined task/case/stock/asset-transfer events, filterable; labelled honestly as rule-protected append-only, not tamper-evident                                |
| Data retention           | Administration → Data retention                                                                                                                                                 | Policy record only — states clearly that nothing is purged automatically on Spark                                                                              |
| Backup & recovery        | Administration → Backup & recovery, `docs/backup-recovery.md`, `scripts/backup-export.ts`                                                                                       | States there is no automatic backup on Spark; read-only operator JSON export (verified on the emulator) and recovery procedure                                 |
| Provisioning             | `scripts/provision-staff.mjs --role customer`                                                                                                                                   | Refuses to convert between staff and customer logins                                                                                                           |

## Definitions (shared by screens and future exports)

- **Cancelled tasks** are excluded from all rates. **Completed** = approved, or completed without approval.
- **Overdue** = open (not awaiting approval) and past due. **On-time** = completed no later than due.
- **Rework** = number of extra attempts. **Approval rate** = approved ÷ (approved + rejected) for tasks needing approval.
- **Average completion** uses only tasks with recorded `startedAt` and submission time; its coverage % is shown. Tasks from before Phase 7 have no start time and are not guessed.
- **Staff workload** = sum of task estimates; **recorded time** = actual start→submit.
- **SLA** uses the response/resolution targets stored on each case when raised, so later policy edits do not rewrite history. Reopens are counted from case events.
- **Inventory**: opening = movements before the period; reversals and transfers use their real store effects; quantities only (no unit costs exist).
- **Attendance**: late, missed check-out (after the local day), supervisor-corrected; GPS coordinates are never shown in reports.

## Customer isolation (security design)

- Access requires an active `customer` membership **and** an admin-created `customerLinks/{uid}`. An email address alone never grants access.
- Customers read only their link and their client's service requests (restricted further by `allocationIds`). They cannot read sites, locations, clients, contracts, allocations, complaints, work orders, employees, costs or other customers' links.
- Creating a request is checked server-side against the real allocation: same client, active today, same site/location, inside the login's scope. Forged places from another tenant or a sibling office are refused.
- What customers see: status, fixed customer-safe timeline labels, team replies written for them, and the resolution summary. Internal complaint notes, assignees, staff names and costs are never copied.

## Tests

| Suite                                                                                  | Result                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Unit (`npm test`) incl. 9 report-engine tests                                          | see below                                                          |
| Emulator rules (`npm run test:rules`) incl. `firebase/tests/phase7.test.ts` (10 tests) | see below                                                          |
| Phase 7 browser (`npm run test:phase7-browser`)                                        | 10 checks — see `docs/evidence/phase7/phase7-browser-results.json` |
| Regression: Phase 1 browser, staff browser, mobile runtime, migration                  | see below                                                          |

Phase 7 emulator tests cover: explicit linking (staff refused), customer cannot read internal records or other links or another company, own-allocation-only creation, idempotent retry, duplicate prevention, forged other-tenant/sibling-office places refused, expired allocation refused, forged status refused, two tenants sharing a building isolated (get and query), scoped login isolated from its own client's other office, staff cannot read requests, intake → complaint with no internal data leaking to the customer, customer can't change status/description/resolution, resolve → summary, reopen request, reconcile, revocation, cost append-only/admin-only/no negatives, compliance evidence rule, retention admin-only, task timing server-stamped and unforgeable, report queries admin-only, audit view.

Browser test (emulator, 390 px phone + 1440 px desktop): admin links a customer login restricted to Office 201 through the UI; staff login refused by the portal; customer sees only Office 201; raises a request; a second tenant in the same building cannot open or list it; admin takes it in; complaint assigned (internal note naming staff and a cost) and resolved; customer sees the resolution and none of the internal text, and confirms; no horizontal overflow at 320–1024 px; all 14 report/administration screens load without errors; admin records a cost through the UI.

## Performance

- Headline numbers use `getCountFromServer` on existing composite indexes (`[status, siteId, dueAt]` etc.).
- Detail reports read bounded pages of 500 (cap 3 000 rows; movements 5 000) and say when a period is truncated. No unbounded collection reads.
- Indexes: 190 of 200 (3 new for `serviceRequests`).
- The customer portal bundle is separate and small (no admin screens are imported).

## Not done / limitations (honest status)

- **Not released**: rules/indexes not deployed, branch not merged, portal not published. Needs release authorisation (together with Phase 6).
- **No automatic backup** and no automatic retention purge on Spark (documented; Blaze upgrade needs approval).
- **Customer notifications** are in-portal "Updates" derived from request changes; no email/push (needs paid services/FCM approval).
- Reports read up to 3 000 rows interactively; full exports are Phase 8.
- Audit history is append-only by security rules, not cryptographically tamper-evident.
- Real customer logins in the live company were not created (needs approval); verified on the emulator.

## Phase 8 (planned, not started)

Excel/PDF export (using the Phase 7 report definitions), bulk import, onboarding wizard, SaaS subscriptions, Sharaco super-admin console.
