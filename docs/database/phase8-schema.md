# Phase 8 schema additions

Rules: `firebase/firestore.rules` (Phase 8 sections). Tests: `firebase/tests/phase8.test.ts`.

## Platform (top level, Sharaco only)

Authority comes from the Firebase Auth custom claim `platformRole` (`owner` | `billing` | `support` | `viewer`) **plus a verified email**, set only by `scripts/grant-platform-role.mjs` (Admin SDK). Tenant roles never grant platform access.

| Collection                           | Read                                          | Write                                                                                                   | Notes                                                                                                                               |
| ------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `platformEvents/{id}`                | any platform role                             | create by owner/billing/support; `actorUid == auth.uid`, `at == request.time`; never updated or deleted | Append-only audit of every privileged change                                                                                        |
| `platformPlans/{planId}`             | any signed-in user                            | owner/billing **with an audit event in the same batch** (`eventId`, subject `plan/{id}`)                | `code, name, description, status (active/retired), currentVersion`                                                                  |
| `platformPlanVersions/{planId}_v{n}` | any signed-in user                            | create only, owner/billing + event                                                                      | `terms: {limits, features, trialDays, supportLevel, billingPeriod, price                                                            | null}` — immutable |
| `platformSubs/{companyId}`           | platform roles; the tenant's own admins       | owner/billing + event (subject = company)                                                               | `planId, versionId, planName, terms, state (running/suspended/cancelled), trialEndsAt, periodStart, periodEnd, graceDays, revision` |
| `platformInvoices/{id}`              | owner/billing/viewer; the tenant's own admins | owner/billing + event; `source` must be `manual`                                                        | `companyId, number, amount, currency, periodStart, periodEnd, status (draft/issued/paid/void), paidAt`                              |
| `platformPayments/{id}`              | owner/billing                                 | **nobody** from the apps                                                                                | Reserved for verified provider webhooks via a trusted backend (not active)                                                          |

An event satisfies `platEvent()` only when written in the same request (`at == request.time`) by the same user with the matching subject, so old or other people's events cannot be reused.

## Company record (`companies/{id}`)

- `status` adds `read_only`: subscription suspended/cancelled/expired. All reads and exports keep working; every write rule's `activeCompany()` is false for writes.
- `plan` (written by platform owner/billing with an event): `{planId, versionId, planName, status, access, limits, features}` — the entitlement snapshot read by the rules.
- Platform owners can create a company (registration) with `eventId`; platform roles can read company directory records (not subcollections).

## Tenant subcollections

| Path                                       | Purpose / rules                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usage/counters`                           | `{sites, employees, assets, recurringSchedules, staffLinks, last, revision, updatedAt}`. Created only by the platform at registration (or by `scripts/usage-reconcile.ts`). Tenant admins may only **increment** one counter by 1 in the transaction that creates that record (`last = kind/id`), and only within the plan limit. Archiving is reflected by the trusted reconciliation. |
| `invitations/{token}`                      | `{companyId, email (lower-case), role, siteIds, status, expiresAt (≤15 days), createdAt, createdBy, note}`. Admins invite non-owner roles (only owners invite admins); platform owners invite owners. Accepted only by the signed-in user whose **verified** token email equals the invitation email, in the same batch that creates `members/{uid}` with exactly that role.            |
| `members/{uid}`                            | New create path: self-join from an accepted invitation (`inviteId`). Still no updates/deletes from apps.                                                                                                                                                                                                                                                                                |
| `supportGrants/{platformUid}`              | Platform support requests access with a reason; a tenant admin approves for ≤72 hours or revokes. An approved grant lets that support user read only `settings/onboarding` and `usage/counters` — never operational data.                                                                                                                                                               |
| `importSessions/{module}_{fileHash}`       | Import history and resumable progress: `{module, fileName, fileHash, status, counts, rows[≤2000], mapping, createdBy, …}`. Admin only.                                                                                                                                                                                                                                                  |
| `exportLogs/{id}`                          | Export audit metadata (report, format, scope, rows, filters text, by, at). Admins and customers create; append-only; the exported data is never stored.                                                                                                                                                                                                                                 |
| `settings/onboarding`, `settings/branding` | Setup progress (`steps`, `pack`) and report branding (`displayName, logoDataUrl ≤60 KB, primaryColor, locale, currency, dateFormat, reportHeader, reportFooter`). Admin only.                                                                                                                                                                                                           |

## Plan enforcement in rules

- `quota(c, kind, id)` on creating sites (generic rule), employees and assets (`create2`), recurring schedules and staff logins: once the company has a plan, the usage counter must be bumped in the same transaction (concurrency-safe: Firestore serialises the counter document).
- `feature(c, 'customerPortal')` on creating customer links.
- Read-based features (advanced reports, exports, mobile app) cannot be blocked by rules without also blocking reads of the tenant's own data; they are gated in the apps.

## Compiled-size and evaluation budgets

The ruleset is close to Firebase's limits: compiled size about **251.7 KB of 256 KB**, and the location-hierarchy transactions sit at the **1,000-expression** evaluation limit (adding even four expressions to the generic record update rule breaks them). Phase 8 therefore keeps the hot record rules unchanged, adds quota checks only on create paths, and shares helper functions (`aa`, `stamped`, `born`, `metaKeys`) elsewhere. Any future rule change must be measured (see `docs/phase8-report.md`).

No new composite indexes (190/200 unchanged).
