# Phase 1 implementation and review

Status: development branch implementation; browser CI verification pending. Not merged or deployed to production.

## Foundation acceptance

- Foundation base: main merge `2054d074d7d59592934016fefad033fc3bdcc1f5`.
- Branch: `feature/phase1-company-sites`.
- Existing Pages test: https://tsforcetech.github.io/FMS/#/login . The deployed app remains Phase 0.
- Live owner sign-in, authorized company profile and refresh persistence were observed in the real browser after manual sign-in. No credentials were collected into source or logs.
- Live logout/reset and live mobile/tablet verification are not claimed. Local emulator UI tests cover logout, denied staff access and revoked membership. The new browser test covers reset and responsive layouts using isolated fixtures.

## Implemented screens

- Safe company profile/contact editing; protected company ID, billing, status and membership fields stay read-only.
- Clients: create, edit, details, archive, name-prefix search, status filtering, pagination and related sites/counts.
- Contracts: create/edit/details/status, date validation, client selector and related sites.
- Sites: create/edit/details, working days/hours, client and optional contract; overview/counts, location hierarchy and facility tabs; clearly marked future tabs.
- Locations: roots and children, editable parent, breadcrumbs, lazy expandable tree, site filtering and archive protection.
- Company-defined facility types and the physical facility register with condition/status history.
- Real count aggregations for the authorized company; no invented operational metrics.
- Responsive forms, inline errors, searchable paginated reference selectors, save feedback, empty/error/loading states and archive confirmation.

## Collections and integrity

Operational records use the existing tenant paths: `companies/{companyId}/clients`, `contracts`, `sites`, `locations`, `facilityTypes` and `facilities`. Business fields are flat alongside schema version, timestamps, creator/updater, revision and protected reference counters. The TypeScript view model separates metadata from form values.

Supporting records: `companies/{companyId}/codeClaims/{kind}_{code}` permanently reserves business codes. `facilities/{facilityId}/history/{revision}` stores a constrained, append-only client-attributed condition/status snapshot per save. It is not an independent or tamper-proof compliance audit.

All creates and relationship/status changes run transactions. Optimistic revisions prevent stale edits; server timestamps are required. Reference counters are validated against the linked record's before/after state and a transaction witness, not trusted from the browser. Only direct ownership links count: site → root locations → child locations → facilities, plus clients → contracts/sites, contracts → sites and types → facilities. Site detail totals use count queries and include archived history.

Hard deletion is denied. Archive requires zero active incoming references and releases outgoing active references atomically; historical IDs and reserved codes remain. Archived references cannot be rewritten while archived. Reactivation requires valid active parents. Locations/facilities cannot silently move across sites. A referenced contract cannot change client.

Owners/admins of an active company can use operational modules. Staff and all other roles remain denied. Membership, tenant creation, owner promotion and the existing trusted provisioning audit remain locked. Prototype rules require review before public rollout.

## Current validation

- `npm run check`: passed (lint, TypeScript, 20 unit tests, production build).
- `npm run test:rules`: passed, 33 tests including all Phase 0 regressions and new operational transaction/security scenarios.
- `npm run test:browser`: authored; local Chromium could not launch because the workspace denies its singleton socket. Escalation is disallowed by workspace policy. GitHub CI runs the browser test and uploads screenshots/results; its result must be checked before claiming completion.
- Tests cover duplicate-code races, tenant isolation, staff denial, stale edits, protected metadata, cycles, invalid parent/site links, archived dependencies, reference-counter tampering, calendar dates, time zones, valid CRUD and facility history.
- Build warns about the main JavaScript bundle size (~971 KB before gzip); splitting can be improved separately.

## Deliberate limits and remaining acceptance

- Name search is a case-sensitive prefix search, clearly labelled. Full-text/fuzzy search is not implemented.
- A location save supports a parent chain of at most four ancestors (five nodes including the edited location). Types are flexible and no Building/Floor/Room sequence is required. A moved subtree can retain deeper descendants; those descendants must be moved to a shallower parent before an edit requiring a longer ancestry check. All cycles are rejected; arbitrary-depth transactional tree edits need a reviewed trusted backend design.
- Reassign one relationship per update. For example, save a location change before changing a facility type. This keeps reference checks within the Firestore rules evaluation budget. Creation may establish all required references together.
- Code changes, cross-site location/facility transfers, tenant provisioning, role management and uploads are not enabled in the browser.
- Facility history currently displays the latest 20 revisions.
- Working hours represent one opening/closing window with selected working days; overnight windows are allowed. Multiple shifts/holiday calendars remain future work.
- New cloud rules/indexes have NOT been deployed. Before authorizing deployment, review the rule changes, CI browser evidence and limits above. Deploy indexes and rules to the existing approved project only; wait for indexes to build before using the Phase 1 app.
- Production rollout/manual acceptance is pending; do not describe this branch as a completed production release.

## Phase 2 compatibility

Existing company/site/location/facility IDs are stable. Individually tracked equipment, furniture and fixtures can reference site/location/facility in the next phase. Quantity inventory and stock movements remain separate from asset identities. No Phase 2 records or screens were implemented. No Functions, Storage, scheduled jobs, new Firebase project or billing changes were introduced. The reference site and its DNS remain untouched.
