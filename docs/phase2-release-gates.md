# FacilityOS Phase 2 — implementation/release gate (2026-11-14)

**Status: NOT IMPLEMENTED / NOT DEPLOYED.** This branch was created from `feature/phase1-site-contract-decoupling` to preserve the approved physical-property-first business model. It contains design/migration audit groundwork, **not** a finished correction or Phase 2 product. The old preexisting `feature/phase2-staff-assets-inventory` was based on outdated Phase 1 code and is not a usable Phase 2 release.

## Release blockers

- Finish Phase 1 site decoupling in React form/schema, transaction logic, Firestore Security Rules, indexes and emulator regression tests. `sites.clientId` and `sites.contractId` remain required in the existing app.
- Implement independent `contractAllocations` with type/date/physical-space allocation, derived contract client, history, concurrency-safe exclusive occupancy and shared/service coverage semantics.
- Run read-only audit with approved Firebase application-default credentials on exactly `facilityos-43386`; save reviewed JSON to controlled owner storage, excluding contact data. **Do not infer occupancy** from old site.clientId.
- Dry-run migration against backup/export and emulators with representative legacy documents; gain signoff for every ambiguous contract association, then checkpoint, apply idempotently, reconcile counts, support rollback.
- Establish a test execution environment: `npm ci`, `npm run check`, `npm run test:rules`, `npm run test:browser`. Do not mark any as passed until executed on the modified branch.
- Verify live selected project, rule/index deploy target and exact GitHub Pages release URL. Never change `https://fms.flowb.io/` without explicit cutover plan.
- GitHub branch divergences: `main` was merged after the correction branch split. Reconcile its latest commits before any release.

## Phase 2 implementation acceptance matrix

**Employees / access**
- Departments and designations: tenant-scoped codes, active/archived status, site links, indexed search, deletion guards.
- Employees: independent employee ID vs Firebase Auth UID; profile, joining date, active state, assignments, supervisor; no sensitive identity numbers by default.
- Teams, members, site assignments and effective-dated assignment history.
- Shifts including overnight local times, site IANA timezone, recurrence working days, holidays and leave/absence.
- Role and permission design: no self-promotion; use protected trusted provisioning when Spark client rules cannot safely grant roles.
- Prepare task eligibility `company + site + role + shift`; **never** filter eligibility using a site clientId.

**Physical assets**
- Categories, suppliers, individual equipment, tools, fixtures and furniture with immutable human-readable tag, siteId, locationId, optional facilityId, condition/status/warranty/custodian and history.
- Furniture can be serialized individual assets or explicitly managed nonserialized batches; do not treat controlled asset tags as consumable material stock.
- Atomic asset transfer with history and same-tenant reference validation; no implicit site ownership changes on client turnover.
- QR identification should contain only nonsecret opaque asset lookup identifiers and require authorized Firebase access.

**Materials / stores**
- Material categories, unit scale, preferred supplier, reorder threshold, stores per company/site/location.
- Inventory movement ledger is append-only; support opening, receipt, issue, transfer, adjustment/correction; no direct balance edits. Exact numeric units (scaled integers) and negative-stock rejection.
- Balance and ledger updates must be atomic/idempotent. Duplicate and concurrent issue tests mandatory. Restrict adjustment and issuing privileges.
- Stock, asset and inspection history remain site-owned even when tenancy contracts expire or change.

## Spark-specific design gates

- No deployed Cloud Functions, Cloud Storage or Cloud Scheduler. No fake browser background task or photo storage.
- Avoid inventing authorization: protect actual data by Firestore rules, not UI-only checks. Disable operations that cannot be safely enforced with bounded transactions/rules on Spark.
- Site/location/contract relationships are strongly typed and checked within tenant. No cross-company refs.
- Typed schema validation, cursor pagination, Firestore indexes and responsive FacilityOS UI required.

## Must-have evidence before deploy

1. Source diff and code review, dependency and security rules review.
2. Emulator tests: cross-tenant reads/writes, self-privilege denial, contract inheritance, overlapping bookings with racing transactions, archive references, inventory conservation and duplicate posting.
3. Browser end-to-end: independent site creation, client + contract allocation, replacement occupants, asset transfer, store receipt/issue, mobile/tablet.
4. Migration: counts before/after, unresolved legacy links, hash/checkpoint manifest and owner review.
5. Deploy to explicitly selected project only after safe rules and indexes are ready; test live with authorized owner.
6. Production release plan and rollback controls. Do not silently deploy new rules, migration or merge.

## Current evidence

The earlier Phase 1 test report applies **only** to Phase 1 code and rules, not these proposed changes. The previous correction-branch audit script is read-only and has **not** been run against the owner's Firestore data. No cloud credentials were available to this chat execution environment.
