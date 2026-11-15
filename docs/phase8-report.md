# Phase 8 — Exports, imports, onboarding, SaaS plans and the Sharaco platform console

Date: 15 November 2026. Branch `feature/phase8-saas-import-export`, started from `main` at `3546d96`.

Firebase stays on **Spark**. No billing change, no payment provider, no Cloud Functions, no new project or database, no new composite indexes (190/200). `fms.flowb.io` untouched. Nothing from Phase 8 is deployed or merged; Phase 9 has not been started.

## 1–3. Starting state and earlier releases

The brief described Phases 6 and 7 as unmerged and undeployed. The repository showed otherwise:

| Item                               | Verified state                                                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 6 (mobile)                   | Merged to `main` and released on 15 November 2026 with Phase 7 (owner authorisation "merge to main and take build and publish")                                                                                       |
| Phase 7 (reports, customer portal) | Merged; rules released (ruleset `06856f69…`, identical to the repo); 190 indexes READY; admin `/FMS/`, staff `/FMS/staff/` and customer `/FMS/customer/` published; Pages, Android and CI runs on `3546d96` succeeded |
| Scheduler                          | Workflow exists; secrets not configured — automatic scheduling still pending activation                                                                                                                               |

## Security-rule budget work (prerequisite)

The released ruleset was at **≈255.9 KB of Firebase's 256 KB compiled-rules limit**. The emulator does not check this limit, and the Rules API reports it mostly as HTTP 503. A probe that compiles throw-away releases and reads the `actual: N bytes` value was used to measure every change:

| Step                                                                                                                                            | Compiled size                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Released Phase 7                                                                                                                                | ~255.9 KB                       |
| Time-zone list replaced by region pattern (client still validates the exact IANA list)                                                          | ~254.1 KB                       |
| Shared metadata key list in generated validators (`metaKeys()`)                                                                                 | ~243.2 KB                       |
| Shared `aa()`, `stamped()`, `born()` helpers; removed no-op deny lines                                                                          | ~242 KB                         |
| **Phase 8 rules added** (platform, plans, subscriptions, quotas, invitations, support grants, import/export logs, onboarding/branding settings) | **~251.7 KB** (4.3 KB headroom) |

A second limit was found: the deep location-hierarchy transactions already sit at Firestore's **1,000-expression evaluation limit** — four extra expressions on the generic record update rule break the existing tests. The hot record rules (generic `/{kind}/{id}` update, `business()`, Phase 1 validators) are therefore kept as in `main`, and plan quotas are enforced on **create** paths only (counters only go up from the apps; archiving is reflected by the trusted usage reconciliation). This is documented in `docs/database/phase8-schema.md`; future rule changes must be measured the same way.

## 5. Excel export coverage

One shared framework (`packages/shared/src/exporting.ts`, `exportFiles.ts`, admin `exportStore.ts` + `ui/ExportMenu.tsx`). Same control everywhere: format (Excel / PDF / CSV), scope (on screen / all matching records), column selection with optional detail columns, filters and period shown, estimated count, progress and cancel.

| Area                           | Screens                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Masters (generic record lists) | Clients, contracts, contract allocations, sites, locations/buildings/floors/rooms, facility types, facilities, employees (incl. site assignments), departments, designations, teams & members, shifts & shift assignments, leave & holidays, asset register, furniture & fixtures, equipment, asset categories, suppliers, materials, material categories, stores, task categories, task templates, SLA policies |
| Operations                     | Task register (all filters), recurring schedules, preventive maintenance plans, work orders, complaints, escalations, stock balances, stock movement history, customer service requests, audit history                                                                                                                                                                                                           |
| Reports                        | Management summary, task register for the period, staff productivity (staff-wise), site performance (site-wise), maintenance work orders, maintenance costs, asset performance, stock reconciliation, attendance register, SLA performance (all case types), compliance register                                                                                                                                 |
| Customer portal                | Service history (customer audience: only fields the customer already sees)                                                                                                                                                                                                                                                                                                                                       |

Excel files: typed numbers/dates/money, company-local date times, bold coloured header, frozen header row, auto-filter, sized columns, wrapped text, totals row, and a "Report details" sheet (company, period, filters, row count, generated by/at).

**No silent truncation:** "All matching records" re-reads the query in bounded pages of 500 without the 3,000-row display cap (tested with 3,105 rows); in-browser limits are explicit — 100,000 rows for Excel/CSV, 10,000 for PDF — and exceeding them stops with a clear message instead of cutting rows.

## 6. PDF export coverage

Same datasets as Excel. Branded header (logo, report colour, display name, header/footer lines from Company setup → Logo & preferences), title, company, period, filters, generation time and user, repeated column headers, totals row, page numbers ("Page n of N"), landscape for wide tables, consistent margins, long-table page breaks. Non-Latin text loads the bundled DejaVu Sans font on demand (Latin, Greek, Cyrillic; **Arabic shaping is not supported by the PDF library** — Arabic text in PDFs is a known limitation; Excel handles it fully). Customer PDFs never include internal columns.

## Export security

Company scope and role come from the same Firestore reads as the screens (no extra privileges). Columns are marked `sensitive` (personal contact data) or `internal` (hidden from customers). Text starting with `= + - @`, tab or CR is prefixed with `'` (formula-injection protection, tested). Every export writes `companies/{c}/exportLogs` (report, format, scope, row count, filters, user, time) — metadata only, append-only, refused for staff and other companies.

## 7. Bulk import modules

Clients, sites, locations (buildings/floors/rooms), facility types, facilities, departments, designations, employees, teams, asset categories, assets/furniture, suppliers, material categories, materials, stores, task categories, and **opening stock**. (Customer contacts join through invitations/customer access; task templates come from starter packs and the template builder, where checklists can be reviewed — importing checklist content blindly was judged unsafe.)

## 8. Import validation and recovery

Flow: module → Excel/CSV template → upload (.xlsx/.csv, ≤5 MB, ≤2,000 rows; signature checked; old .xls refused) → automatic + manual column mapping → **dry run** (nothing written) → preview classified as New / Match (no change) / Update candidate / Duplicate in file / Invalid / Skipped with source row numbers and reasons → optional "also update existing" → import in sequential single-row transactions with progress and Stop → results → downloadable Excel error report → history.

- Validation reuses the form schemas (`inputSchema`), reference codes are resolved through `codeClaims` (exact, company-scoped), and matching existing records is **only by exact code — never by name**.
- Formula cells are rejected ("paste values only").
- Every row is saved with the normal store functions, so reference counters, plan quotas and security rules apply exactly as for manual entry.
- Session id = module + file SHA-256: re-uploading a file is recognised; an interrupted import resumes and skips finished rows; code claims make duplicate creation impossible (tested: abort after 3 of 6 rows → partial → resume → exactly 6 records).
- Opening stock is posted as ledger "opening" movements with deterministic ids (never balance overwrites); a second opening for the same store/material is reported as a match; reconciliation equals the balance (tested).
- Rollback: imported records are ordinary records — archive them or reverse the opening movement. One-click rollback is deliberately not offered, because imported records may already be in use.

## 9. Company onboarding

Administration → Company setup: 12 steps (company information, logo & preferences, time zone/working hours via company and sites, first site, buildings/floors/rooms, departments, employees, roles, assets & facilities, task templates, recurring schedules, staff access, review & activate) with a percentage, outstanding steps and direct links. Progress is computed from the real records plus explicitly marked steps, so refreshing, leaving or doing the work elsewhere never duplicates anything. A client or contract is not required to create a site. Each step carries a stable help id (`setup.*`, also on the page as `data-help`) for Phases 9–10.

## 10. Starter template packs

Business centre, commercial building, residential building, hotel, warehouse, retail facility, corporate office. Each pack offers departments, designations, task categories, checklist templates (with suggested recurrence) and SLA suggestions; the admin chooses what to install. Items with existing codes are skipped (installing twice is safe). **Checklists are created as drafts and no schedules are created**, so no live tasks appear without an administrator publishing and scheduling them (tested).

## 11–12. Subscription plans and entitlements

Shared model `packages/shared/src/saas.ts`: plans, immutable plan versions (limits for sites, employees, assets, recurring schedules and staff logins; features customer portal, mobile app, advanced reports, exports, imports; trial days; support level; billing period; optional list price — **no prices are invented**), subscriptions, statuses (trial, active, renewal due, grace, past due, suspended, cancelled, expired), administrative actions (assign, extend trial, renew, upgrade/downgrade, suspend, reactivate, cancel) and history through the audit log.

Enforcement at the write boundary (security rules): creating sites, employees, assets, recurring schedules and staff logins must bump `usage/counters` in the same transaction and stay within the plan limit; the counter document serialises concurrent creates (tested: one free slot, two simultaneous creates → exactly one succeeds); tenants cannot create, reset or decrement counters; the customer-portal entitlement gates customer links. Suspension, cancellation and expiry set the company to `read_only`: all data remains readable and exportable, writes are refused, nothing is deleted (tested). Exceeding a limit never blocks viewing or exporting existing data. Tenant view: Administration → Plan & usage (limits vs usage, features, billing history, support access).

## 13. Billing integration status

Provider-agnostic boundary in place; **online payment is not active**. Manual invoice records (draft/issued/paid/void) by platform billing staff, each audited; MRR/ARR computed only from invoices marked paid whose service period covers the date, per currency, trials excluded. `platformPayments` is closed to all app writes (reserved for verified provider webhooks via a trusted backend); browser-written `provider` invoices are refused (tested). No card data is stored anywhere.

## 14–15. Sharaco platform console and security model

`apps/platform-web`, published at `/FMS/platform/` (no secrets in the bundle; access enforced by rules):

- Overview (registered companies, active subscriptions, trials, read-only companies, expiring in 30 days, companies without a plan, total sites, staff logins, plan distribution, revenue from paid records only, recent events), companies directory and detail (subscription actions, usage, support access), register company, plans and versions, subscriptions, billing records, platform audit log, operational health, configuration.
- Identity: platform authority comes **only** from the `platformRole` custom claim with a verified email, set by `scripts/grant-platform-role.mjs` (Admin SDK, operator credentials; revokes refresh tokens). A tenant `owner`/`admin` never reaches platform data (tested; the console shows "Not a Sharaco platform account").
- Least privilege: owner (registration, all), billing (plans, subscriptions, invoices), support (support-access requests), viewer (read-only).
- Every privileged change is a single batch containing its audit event by the same user; forged, reused or someone else's events are refused (tested).
- **Platform users cannot read tenant operational data.** Support needs a tenant-admin approval (≤72 h, revocable) and even then sees only the setup summary and usage counters (tested).
- MFA: the console is MFA-ready (shows when a second factor was not used); enforcing MFA needs Firebase Identity Platform MFA to be enabled — **pending approval**.

## 16. Firebase rules / index changes

See `docs/database/phase8-schema.md`. No new composite indexes. Rules not deployed.

## 17. Test results

| Suite                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Result |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Shared unit tests (`npm test`) incl. 20 Phase 8 tests (export typing/totals/dates/formula injection/columns/xlsx structure/4,000-row PDF/Unicode font; CSV/xlsx parsing, invalid files, classification, exact-code matching, formula refusal, opening stock, templates; lifecycle, suspension, renewal, plan change, limits, revenue; onboarding, packs)                                                                                                                                             | passed |
| Emulator rules (`npm run test:rules`): all earlier suites (99) + `phase8.test.ts` (18)                                                                                                                                                                                                                                                                                                                                                                                                               | passed |
| Phase 8 browser (`npm run test:phase8-browser`): 8 checks — starter pack (drafts, idempotent, no schedules), onboarding progress/branding, Import Center (dry run, preview, import, repeat detection, history), real Excel and PDF downloads + audit, invitation → account → verification required → accept with the invited role, tenant owner refused by the console, platform plan → reconcile → assign → suspend (tenant read-only, data intact) → reactivate → audit, no overflow at 390/768 px | passed |

Full regression on the final branch (all executed locally against the emulators):

| Command                                                                                    | Result                            |
| ------------------------------------------------------------------------------------------ | --------------------------------- |
| `npm run format:check`                                                                     | passed                            |
| `npm run check` (lint, typecheck, unit tests, all builds incl. customer and platform apps) | 100/100 unit tests                |
| `npm run test:rules`                                                                       | 117/117 (99 earlier + 18 Phase 8) |
| `npm run test:migration`                                                                   | passed                            |
| `npm run test:browser`                                                                     | 20 checks passed                  |
| `npm run test:staff-browser`                                                               | 10 checks passed                  |
| `npm run test:mobile-runtime`                                                              | 8 checks passed                   |
| `npm run test:phase7-browser`                                                              | 10 checks passed                  |
| `npm run test:phase8-browser`                                                              | 8 checks passed                   |

Phase 8 emulator tests cover: platform identity isolation (incl. unverified claim), plan versioning and immutability, forged events, payments and provider invoices refused, usage-counter preconditions, tenant cannot change plan/status/counters, site limit at the write boundary and under concurrency, customer-portal entitlement, suspension read-only without data loss and with exports still possible, renewal/plan change history, tenant-scoped invoices, company registration with owner invitation, wrong-email/unverified/reused invitations, role escalation, support-access approval rules and scope, cross-company isolation, import dry run/repeat/partial/resume/updates/opening stock, idempotent starter packs, exports beyond 3,000 rows, export-log integrity.

Screenshots: `docs/evidence/phase8/`.

## 18–20. Deployment status and missing approvals

| Item                                                     | Status                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 8 rules                                            | **Not deployed** — measured to fit (≈251.7 KB); release needs authorisation                                                                                                                                                                                       |
| Merge to `main` / publish (`/platform/` + admin changes) | **Not done** — awaits authorisation                                                                                                                                                                                                                               |
| Existing companies (e.g. GBH)                            | Unaffected until a plan is assigned. Before assigning, run `scripts/usage-reconcile.ts --apply` for the company                                                                                                                                                   |
| First platform account                                   | Run `scripts/grant-platform-role.mjs --role owner` for a verified Sharaco email                                                                                                                                                                                   |
| Online payments                                          | **Blocked** — needs an approved trusted backend and provider                                                                                                                                                                                                      |
| Automatic subscription expiry and usage reconciliation   | **Manual** (`scripts/subscription-sweep.ts`, `scripts/usage-reconcile.ts`) until a trusted scheduled backend is approved                                                                                                                                          |
| Email delivery (invitations, renewal reminders)          | **Not active** — invitation links are shared manually; Firebase sends only the account-verification email                                                                                                                                                         |
| MFA enforcement for platform staff                       | **Pending** Identity Platform MFA                                                                                                                                                                                                                                 |
| Arabic text in PDFs                                      | Known limitation (no glyph shaping); use Excel                                                                                                                                                                                                                    |
| `npm audit`                                              | Pre-existing high findings in `@grpc/grpc-js` via Firebase (server-side gRPC only). New: moderate `uuid` advisory via exceljs (affects `v3/v5/v6` with a `buf` argument; exceljs uses `v4` only). Not fixed by override because of a conflicting hoisted version. |

## 21–22. Phase 9 readiness and roadmap

Phase 9 (Help Center & documentation) and Phase 10 (interactive tutorials & tours) are listed as planned in `docs/development-roadmap.md` and were **not started**. Prepared hooks: onboarding step metadata with stable `setup.*` help ids rendered as `data-help` attributes, and the read-only/plan banners use stable text for future help links.
