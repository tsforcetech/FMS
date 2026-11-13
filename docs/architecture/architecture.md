# Architecture

## Boundaries

One Firebase project initially hosts a multi-company SaaS. A company is the facility-management tenant. A client is an organization served by that tenant and may own multiple properties. Clients do not become tenants implicitly. A user can belong to multiple companies with different roles.

Admin web is the only initialized app. Staff web and React Native Android/iOS consume shared domain contracts in later phases. Customer access is a separate later release. No platform super-admin authority is accepted from client fields or custom role names. Platform administration is currently a trusted operator procedure outside the browser.

## Identity and tenant resolution

1. Firebase Auth email/password identifies the UID; authentication alone grants no company privileges.
2. Read `users/{uid}` for display metadata, then a page of at most 25 `companyAccess` hints.
3. Read each canonical `companies/{companyId}/members/{uid}` document. Ignore inactive/non-admin memberships and inaccessible companies.
4. Fetch the company only after a matching active owner/admin membership. Validate schemas and matching IDs.
5. On selection, remount tenant content and subscribe only to the selected member/company pair. Hide content while verifying. Ignore stale async results after user changes; unregister listeners on switch/logout.
6. Firestore rules independently enforce every request. Client guards are only UX. Discovery hints and user profile fields never authorize access.

The company selector reads more pages on demand. There are no collection scans, collection-group membership queries or unbounded membership arrays. Only the current company and membership use real-time listeners; operational reporting is absent. Firestore uses memory cache, with no persistent company-data cache on shared devices. Auth persistence is browser-local for session continuity; explicit logout clears the signed-in state. Previously viewed information cannot be retracted from a user's memory/browser; revoked access blocks subsequent server requests.

## Domain design

Sites own flexible location trees using `parentLocationId`, not hard-coded depth. Location kinds include buildings, floors, zones, rooms, outdoors and custom structures. A facility is a serviceable area (pool, garden, kitchen, parking); a uniquely tagged asset is an individually tracked item (including furniture); a material is measured inventory. These are separate models.

Templates are versioned. Task instances reference an immutable template version, with separate assignment history, submission attempts, evidence, status events and approvals. Overdue is a derived flag so it does not replace workflow status. A task can be in progress and overdue simultaneously. Approved snapshots remain stable after a template changes. RACI indicates responsibility; explicit permission rules determine who may approve.

Future stock movements are append-only; quantities use exact scaled units where fractional precision is required. Transfers debit/credit within one trusted transaction, and task/work-order consumption references the originating work. Aggregate balances are derived and reconciled; no editable browser-authoritative stock totals.

## Future server processing

`AttachmentGateway` and `SchedulerGateway` explicitly report unavailable in Phase 0. No Functions/Storage packages or cloud jobs run in the browser. After an approved Blaze upgrade, add trusted adapters without changing UIDs, company IDs or record paths.

Scheduling uses site IANA timezones and UTC instants. Store recurrence rules, shift/local working times and holiday/leave exceptions separately. Generate a deterministic occurrence key from company/schedule/version/planned instant and enforce uniqueness transactionally. Persist scheduler cursor, bounded batch progress and recovery history; replay missed runs idempotently. Policy for DST gaps/overlaps must be agreed and tested before release. Automatic assignment resolves role/site/shift and absence rules, with explicit manual override history.

Trusted transactions update tasks/events and generate append-only audit records together. Outbox events drive notifications with idempotent delivery keys, retries and delivery status. Photos/files require scoped Storage rules, quotas, content validation and retention policy. GPS/QR proof and offline uploads need explicit anti-replay and conflict handling.

## Reporting, growth and migration

Prefer scoped, paginated queries and server-maintained aggregates over dashboard collection scans. Index specifications must ship alongside each module's actual queries. Store operational timestamps as Firestore Timestamp UTC; site timezone is the display/schedule boundary. Every domain record carries schemaVersion and immutable creator metadata. Backfill tools run in a trusted environment with dry-run, checkpoint, before/after counts, validation and rollback plan. Deploy compatible readers before migrations, then retire old writers. Archive masters referenced by history; avoid cascade deletion. Export/retention policies require review before production.
