# Phase 2 and admin redesign — implementation report

Date: 14 November 2026. Branch: `feature/phase2-people-assets-inventory`, started from `main` at `6e045ea` (merged site/contract correction).

## Recovery findings

- The workspace was clean (no uncommitted changes, no stashes).
- Every remote branch was a strict subset of `main`. `feature/phase2-staff-assets-inventory` pointed at the old Phase 1 commit `4868de1`; `feature/phase2-after-site-decoupling` (`1ac7e9d`) held only a release-gates document and pre-dated the merged correction.
- No Phase 2 implementation existed in the repository. The correction report mentions uncommitted Phase 2 work in another checkout; it was never pushed and could not be recovered. Phase 2 was therefore built here, on top of the corrected physical-site/allocation architecture, and the release-gate requirements from `1ac7e9d` were used as the acceptance matrix.

## Module status

| Area       | Module                                                                                                                | Status                                                                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| People     | Departments (company-wide or site, one parent level, manager)                                                         | Complete and tested                                                                                                                                                                               |
| People     | Designations (never grant access)                                                                                     | Complete and tested                                                                                                                                                                               |
| People     | Employees (code, contact, joining date, type, department, designation, supervisor, primary site, optional login link) | Complete and tested                                                                                                                                                                               |
| People     | Site assignments, team memberships, shift assignments (effective-dated, end instead of delete)                        | Complete and tested                                                                                                                                                                               |
| People     | Teams (department, home site, leader, members)                                                                        | Complete and tested                                                                                                                                                                               |
| People     | Shifts (site time zone, overnight, working days, break)                                                               | Complete and tested                                                                                                                                                                               |
| People     | Leave records and holidays                                                                                            | Complete and tested                                                                                                                                                                               |
| People     | Roles & permissions                                                                                                   | Partially implemented by design: matrix and read-only member list. Owner/admin are enforced; other roles are a prepared model with no portal access. Role changes stay with trusted provisioning. |
| Assets     | Categories with one subcategory level                                                                                 | Complete and tested                                                                                                                                                                               |
| Assets     | Asset register: equipment, tools, IT, vehicles, furniture, fixtures                                                   | Complete and tested                                                                                                                                                                               |
| Assets     | Non-serialised furniture batches with quantity                                                                        | Complete and tested (whole-batch transfer; partial split is a documented limit)                                                                                                                   |
| Assets     | Atomic transfers with immutable transfer log, condition before/after, receipt acknowledgment                          | Complete and tested                                                                                                                                                                               |
| Assets     | Condition/status/custodian/quantity history                                                                           | Complete and tested                                                                                                                                                                               |
| Assets     | QR labels (opaque record link, sign-in required, print/download)                                                      | Complete; scanning app is Phase 6                                                                                                                                                                 |
| Inventory  | Suppliers, material categories, materials, units of measure, stores                                                   | Complete and tested                                                                                                                                                                               |
| Inventory  | Opening, receipt, issue, transfer, adjustment in/out, reversal                                                        | Complete and tested                                                                                                                                                                               |
| Inventory  | Balances, movement history, reorder flags                                                                             | Complete and tested                                                                                                                                                                               |
| Shared     | Navigation, forms, tables, details, tabs, dialogs, toasts, responsive UI                                              | Complete and tested                                                                                                                                                                               |
| Operations | Tasks, maintenance, work orders, inspections                                                                          | Not started (Phase 3/4); shown with phase labels                                                                                                                                                  |

## Data model

All records are tenant-scoped under `companies/{companyId}` and attach to physical site/location IDs; none references a client or contract. Masters reuse the Phase 1 contract (code claims, revision, `refCount`/witness counters, archive instead of delete). See [Phase 2 schema](database/phase2-schema.md).

Inventory uses an append-only ledger: `stockMovements/{id}` (create-only; the ID is the idempotency key, reversals use `REV-{id}`) and `stockBalances/{storeId}_{materialId}` (integer minor units). Balances change only together with a movement created in the same transaction, and never go below zero.

## Security rules

- Phase 2 validators and per-kind rule blocks are **generated from the shared TypeScript schema** (`packages/shared/src/rules-generator.ts`); `rules-sync.test.ts` fails CI if the rules or index file drift.
- Firestore charges 1,000 expressions per request across the whole transaction, and `let` bindings are re-evaluated on every use. Helpers now receive document data as arguments (evaluated once), per-kind blocks avoid dispatch chains, and grouped regex checks validate several IDs/dates at once. This also reduced the cost of the existing Phase 1 checks.
- Counted links (archive protection): department, designation, team, shift, site, location, category and parent links. Informational links (supervisor, primary site, custodian, supplier, facility, store keeper, leave employee) are resolved by the transaction but do not block archive.
- Owners/admins may now **list** their company's members (read-only). Member writes, role changes and self-promotion remain denied.
- Asset site/location can change only with a matching immutable transfer record in the same transaction.

## UI/UX redesign

New design system (`apps/admin-web/src/theme.css`, `src/ui/kit.tsx`): Plus Jakarta Sans (self-hosted), soft blue canvas, white rounded cards, navy active states, blue pill actions, status pills, animated tabs, drawers, confirm dialogs, toasts, skeletons and empty states. Grouped, collapsible sidebar (collapses to an icon rail; off-canvas on mobile), breadcrumb top bar, company switcher, dashboard with real setup insights, setup queue, record counts and setup gauge, and a quick-actions panel. Forms are sectioned drawers with inline validation, searchable pickers, unsaved-change protection and friendly errors (raw Firebase errors are never shown). Search is now case-insensitive.

## Verification (executed on this branch)

- `npm run format:check`, `npm run lint`, `npm run typecheck`: pass.
- `npm test`: 39 unit tests pass (exact quantities, ledger rules, schemas, rules/index sync).
- `npm run test:rules`: 55 emulator tests pass, including 15 new Phase 2 security/integrity tests (tenant isolation, staff denial, forged references, archive protection, transfer forgery, negative stock, duplicate posting, concurrent issues, reversal-once, inactive material, cross-company store).
- `npm run test:migration`: unchanged and passing.
- `npm run test:browser`: 11 end-to-end checks pass at 1440×1000, 768×1024 and 390×844 with a strict no-horizontal-overflow check. Evidence: [docs/evidence/phase2](evidence/phase2).
- `npm run build`: pass (bundle-size advisory only).

## Deployment status

- The redesigned app deploys to GitHub Pages from `main`.
- **Firestore rules and indexes for Phase 2 are not yet deployed** to `facilityos-43386`; this needs an authorised operator. Until then the live app keeps Phase 1 working and shows Phase 2 modules as "pending activation". Deploy with:

  ```sh
  npx firebase deploy --only firestore:rules,firestore:indexes --project facilityos-43386
  ```

  Wait until all indexes report READY before using Phase 2 lists.

- The legacy site migration (schema-1 sites) remains **not run**; the dashboard flags any legacy sites for review.

## Limits and follow-ups

- Partial furniture-batch transfers (split) are not supported; adjust quantity and create a new batch.
- Archiving a material or store does not require a zero balance; balances and history are retained.
- Employee overlap checks for assignments are advisory (not enforced).
- Search covers common casings of a name prefix; full-text search is a later phase.
- Roles beyond owner/admin have no portal access until their scoped rules are built and tested.

Phase 3 (templates, tasks, approvals) can start after Phase 2 acceptance and the rules/index deployment above.
