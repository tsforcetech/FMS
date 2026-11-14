# Development roadmap

Each phase requires implementation, tests and review before the next phase. Do not begin Phase 1 without approval. Existing reference UI is visual guidance; planned domain structure governs all new forms.

| Phase | Scope                                                                                                                                       | Release gate                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0     | Source audit, npm monorepo, SDK configuration, Auth, tenant resolution, owner bootstrap, admin shell, rules, tests and CI                   | Verified emulator foundation plus selected-project configuration and live verification documented |
| 1     | Companies, clients, contracts, sites, flexible locations, facility types and facilities, working hours                                      | Tenant/site isolation, validated forms, archive/reference integrity, accessible mobile layout     |
| 2     | Departments, designations, roles/permissions, employees, teams, shifts, leave/holidays; assets/furniture, suppliers, materials/stores/stock | Trusted permission workflows, site restrictions, stock invariants and audit trails                |
| 3     | Versioned templates, checklist types, RACI, task assignments/execution, submissions, approvals/rework                                       | Historical snapshots, state-transition authorization and evidence validation                      |
| 4     | Approved Blaze enablement, scheduler, recurrence and assignment, maintenance/work orders, complaints/escalations, files and notifications   | Idempotency, missed-run recovery, timezones/DST, SLA, retry and security tests                    |
| 5     | Staff web: My Day, clear actions, checklists, issues, history and localization                                                              | Real staff usability tests; no fake background execution                                          |
| 6     | Android/iOS, QR/camera/GPS, offline queue and synchronization                                                                               | Device permissions, replay/conflict resolution, secure local storage, Android/iOS device tests    |
| 7     | Reports, exports, dashboards, customer portal, operational monitoring and release hardening                                                 | Accurate aggregates, scoped customer access, retention/backups, performance and recovery tests    |

## Current status

Phase 0, Phase 1 and the site/contract correction are merged. Phase 2 (people, assets, inventory) and the admin redesign are implemented and tested; see [phase2-report.md](phase2-report.md). Phase 2 Firestore rules/indexes require operator deployment before Phase 2 modules activate in the live project.

## Phase 0 status

Implemented in source: strict workspace setup, email/password login/reset, Auth persistence, profile read, paginated company discovery, canonical membership checks, selected-company subscriptions, access-denied/error/loading/empty states, responsive foundation shell, secure provisioning, emulator fixtures, schema contracts, closed future collection rules and CI.

Deferred: operational CRUD screens, production onboarding UX/invitations, custom roles/site grants, file uploads, scheduling, notifications, mobile, reporting and customer portal.

Unverified/manual: selected real Firebase project, real rules deployment, real owner provisioning, live email/reset delivery and Hosting deployment. See `phase0-report.md` for exact test evidence and repository delivery status.

Phase 1 starts with requirements review of client/contract/site forms, agreed location hierarchy, archive policies, site permissions and mock-free CRUD acceptance tests. It must not start automatically at the end of Phase 0.
