# FacilityOS — Site/Client/Contract decoupling (correction design)

Status: **implemented on the correction branch; review and production rollout pending**. This original design is retained as the business rationale. The implemented schema, bounded occupancy policy, migration procedure and verification results are documented in [the correction report](../site-contract-correction-report.md). Contracts retain their existing schema; allocationType supplies the service/occupancy distinction.

## Non-negotiable domain invariants

1. A site is a physical place in a company and exists before any client or contract. Site creation and modification must not require or persist `clientId` or `contractId`.
2. Locations, facilities, assets, furniture, inventory stores, inspections, tasks and physical maintenance history attach to the company/site/location/asset, **never to a transient occupant**.
3. A client is an independent company-owned business party. A contract references exactly one client and defines commercial/service terms.
4. A contract may cover one or more sites or spaces through versioned `contractAllocations`. The UI **derives the client** by reading the contract, never asks the user to select the client again.
5. Multiple clients may be allocated to one site when allocations concern distinct rooms or compatible shared usage. A room can be vacant. Expiry/termination never deletes physical records or history.
6. Facility-management service contracts may cover a whole site without physical occupancy. Office/tenancy contracts may allocate particular spaces. Service coverage and occupancy must not be conflated.

## Proposed document contracts

`companies/{companyId}/sites/{siteId}`: retain existing physical fields and metadata, drop legacy client/contract ownership in schema v2. Do not change immutable siteId, locationId, facilityId or companyId.

`companies/{companyId}/contracts/{contractId}`: retain clientId, start/end dates, serviceDescription. Add contractType (`facility_service`, `space_tenancy`, `other`) through a backward-compatible versioned migration.

`companies/{companyId}/contractAllocations/{allocationId}`:

- companyId, contractId, siteId, locationId (empty for entire site), allocationType (`service_coverage`, `exclusive_occupancy`, `shared_occupancy`), startDate/endDate (YYYY-MM-DD **inclusive**), status (`draft`, `active`, `terminated`, `expired`, `archived`), reference, notes;
- schemaVersion, createdAt, updatedAt, createdBy, updatedBy, revision;
- clientId should **not** be a user-input; derive from contract whenever displayed or reported. Avoid storing a second clientId unless a justified immutable snapshot is explicitly validated server-side.
- Preserve changed allocations via immutable lifecycle events or new replacement rows; do not overwrite past occupied intervals.

Contract date validation: each allocation must have a valid inclusive interval inside an effective contract interval, or a defined amendment/extension. Status must not be used to erase historical intervals.

## Exclusivity and concurrency

A Firestore query for `startDate <= newEndDate` plus `endDate >= newStartDate` is **not** a safe mutex: concurrent transactions can both find no conflicting document and create overlapping rows.

Before supporting active exclusive occupancy, use a _transactionally enforced, finite calendar slot claim_ for the same `companyId/siteId/locationId/date` or another reviewed per-space serialized registry guarded by rules/trusted service. Both write paths must atomically read/check/create claims with allocation; cancellation/renewal must preserve occupied historical intervals and release only future claim intervals according to business policy. Limit time-span and write count to Firestore transaction/rule budgets. A per-room document used as a transaction mutex is another option, but it must support multiple historic intervals without unbounded arrays. If no secure enforceable solution fits Spark quotas/rule budgets, **disable active exclusive allocations**, allowing draft records only until approved trusted backend exists.

Shared occupancy must have explicit site/location capacity and policy checks; service coverage must not block room occupancy.

## Dependency and archive rules

- Client archive: block if active/draft contracts or unresolved dependencies exist.
- Contract archive: block active allocations; preserve historical references.
- Site archive: block active locations/facilities and active allocations.
- Location archive: block active child locations/facilities and active allocations.
- Allocate only contracts, sites and locations belonging to the same company; selected location must belong to the selected site.
- A contract may have many allocations, a site may have many allocations; do not use `site.clientId` or `site.contractId` as owner/refcount references.
- Use explicit write preconditions/revisions for edits and transactional link maintenance; immutable audit history cannot rely only on client-authored snapshots.

## Required code and security migration sequence

1. Read-only audit of existing site records, contract references, client references and child locations; export a backup to owner-controlled secure storage before any mutation.
2. Build backwards-compatible readers for schema v1 sites while introducing v2 sites and allocation feature-flag behind tests.
3. Implement allocation schemas, transaction/claim policy, UI lists/forms and Firestore rules with emulator tests (cross-tenant, invalid refs, overlap races, history and expiry).
4. Deploy tested **compatible** rules and indexes first, wait for indexes to be READY, then run a deliberate dry-run from trusted credentials.
5. Record review decisions for ambiguous legacy site->contract links; do not invent `locationId` or occupancy type.
6. Run approved, checkpointed idempotent migration: create confirmed allocation(s) _before_ removing legacy site references and updating site schema. Preserve a migration manifest/report and rollback/export. Validate counts and inspect spot checks.
7. Switch UI writers to v2-only after migration verification, then tighten security rules to reject v1 writes and remove legacy fields. Monitor data access.
8. Only then review merge and production rollout.

**Never** perform destructive migration via browser client SDK or automatically from CI. Never deploy rules, indexes, or modify `https://fms.flowb.io/` without approval.

## Legacy mapping policy

- A v1 site with `contractId` empty: it does **not** imply a contract or allocation. Keep the site; remove client ownership only after approved migration.
- A v1 site with `contractId` present: check contract exists, client matches site.clientId, same company, and dates valid. Create **review-required proposal**, not an automatic occupancy booking. Contract type, whole-site vs room allocation, shared/exclusive policy and effective dates need owner confirmation.
- A v1 site with clientId but no contract: legacy association may be informational; **do not fabricate a contract**.
- Missing/inconsistent references must be quarantined for manual remediation, not silently dropped.
- Multiple active room allocations inside one site are valid unless they claim the _same exclusive space_ for intersecting inclusive dates.

## Phase 2–7 master rule

Every later module must attach physical objects and operational events to physical site/location/asset IDs. Client/contract reporting is **joined through effective-dated allocations** and can be absent. Role/site/shift assignment never depends on a current site.clientId. This rule is mandatory in future Astra prompts and schema reviews.
