# FacilityOS Phase 0 — implementation and verification report

Date: 12 November 2026. **Status: foundation implemented and tested; GitHub delivery on the development branch; live Firebase acceptance pending. Phase 0 is not fully accepted. Phase 1 has not started.**

## 1. Repository audit

`tsforcetech/FMS` was empty: GitHub contents returned empty-repository 404, branch list was empty, and no remote refs were returned. Local development was initialized directly on `feature/phase0-foundation`. No existing application/history was overwritten.

## 2. FacilityOS UI audit

Inspected the staff home, admin dashboard, sites/assets, employees, templates, seven-day scheduler, RACI matrix, approvals, work orders, escalations, complaints, reports and settings at `https://fms.flowb.io/`. Retrieved the public HTML source. It explicitly identifies itself as a browser-local prototype without production authentication or backend synchronization. No true login screen exists there.

The prototype supplies visual styling only. Following the user's clarification, our agreed multi-company structure determines forms, fields and workflows. Original CSS primitives are reused, with responsive overrides and new typed React components. Demo JavaScript/data was not copied into the application. See `source-audit.md` and `ux-contract.md`.

## 3. Implementation summary

Created npm workspaces, strict TypeScript, React/Vite/Tailwind admin app, reusable fields and states, Firebase environment validation, Auth persistence configuration, typed Firestore access, company discovery pagination, canonical membership authorization, selected-company subscriptions, protected routing and secure local provisioning.

Created deny-by-default rules, emulator-only fixtures, SDK integration tests, UI flow tests, security tests and GitHub Actions CI without deployment. Added full setup, schema, security, architecture, usability and phase documentation.

## 4. Folder structure

```text
FMS/
  apps/
    admin-web/
      src/{App.tsx,main.tsx,firebase.ts,data.ts,reference.css,styles.css}
      index.html
      vite.config.ts
      package.json
    staff-web/README.md
    mobile/README.md
  packages/
    shared/src/{index.ts,future.ts,security.test.ts}
    ui/src/index.tsx
    config/src/index.ts
  firebase/
    firestore.rules
    firestore.indexes.json
    tests/{rules.test.ts,auth.test.ts,ui.test.tsx}
    functions/README.md
  scripts/{provision-owner.mjs,seed-emulator.mjs}
  docs/
    architecture/architecture.md
    database/database-schema.md
    security/security.md
    source-audit.md
    ux-contract.md
    firebase-setup.md
    development-roadmap.md
    phase0-report.md
  .github/workflows/ci.yml
  .env.example
  .env.emulator.example
  .gitignore
  .prettierignore
  .prettierrc.json
  eslint.config.js
  firebase.json
  package.json
  package-lock.json
  tsconfig.json
  vitest.config.ts
  vitest.emulator.config.ts
  README.md
```

Each shared package also has a package.json. No unused staff/mobile framework is installed.

## 5. Firebase configuration

Connected and tested against the real Firebase Auth/Firestore SDKs using `demo-facilityos` emulators, with Standard edition confirmed by emulator startup. This ID is exclusively local, not a real cloud project. No live Firebase project ID/configuration was supplied. Console project creation, chosen region, live rules deployment and live owner provisioning remain blocked.

Environment examples are committed; active `.env` and credentials are ignored. The live SDK mode requires actual web config plus `VITE_ALLOW_LIVE_FIREBASE=true`. Emulator mode rejects real project IDs. No cloud default project, automatic deployment or paid service is configured.

## 6. Authentication

Verified through SDK/UI integration: failed password rejection, successful email/password login, authenticated route access, profile retrieval, two-company discovery/selection, logout and staff denial. The component test verifies revoked membership removes tenant content.

Browser-local Auth persistence is configured, but reload persistence in a real browser is **Not Tested** because browser access to the local server is unavailable. Password reset uses generic responses; live email delivery is **Not Tested**. There is no public company/admin registration UI. Arbitrary Auth identities do not acquire memberships.

Owner provisioning is implemented using trusted Application Default Credentials and an existing enabled password user. It performs one atomic Firestore provisioning transaction and refuses overwrite. Actual cloud provisioning is **Blocked**, not reported as passed. Test fixtures seed only loopback emulators.

## 7. Security

All ten requested security cases passed, plus inactive membership, suspended company, own-directory isolation, hint tampering, profile privilege injection, protected user lists, closed future collections and revocation. Client membership/role/company writes are denied even to owners. Audit documents cannot be created, changed or deleted by browser clients. Profile updates are field-whitelisted and cannot grant roles.

Site restrictions, custom role permissions, customer access and operational writes are deferred and therefore denied. Tests validate isolation in the emulator; intended cloud project rules remain unverified.

## 8. Firestore

Implemented: `users`, own `companyAccess` directory, `companies`, canonical `members`, provisioning `auditLogs`. Runtime schemas validate identity, fields, status, timezone and Timestamp data. Company discovery uses 25-row cursor pages and document reads; only the selected company/member pair uses listeners. Company data uses memory cache, not persistent offline storage.

No composite index is currently needed for direct paths and document-ID pagination. Future task, inventory, site, SLA and report query/index plans are documented without creating empty collections or granting their access.

## 9. Admin UI

Implemented login, reset action, authenticated sidebar/header, profile menu/logout, company selector, company details dashboard, future-module pages, access-denied, loading, error, empty and not-found states. No invented production metrics or records. Reference-inspired teal/white styling; all modules and planned forms follow the agreed architecture.

Responsive CSS and accessible labels/focus controls exist. A responsive breakpoint conflict inherited from the reference was corrected during source review. Actual visual desktop/mobile QA and keyboard-only browser testing are **Not Tested**; component tests are not claimed as visual browser tests.

## 10. GitHub delivery

Repository: https://github.com/tsforcetech/FMS
Development branch: `feature/phase0-foundation`.

The user explicitly approved a README-only initial commit on `main`. That commit is `2d11e2435a9f160a3e550b5f9a9b0eed0a5f8f20`. The application is delivered separately on the development branch, based on that initial commit. No application merge to main or production deployment is included.

The source was verified locally in commits `342ecbb997a03375d9eab6840f526c2386c9d2aa` and `a63e82ab4d27114e9e2401f436451960e048c6bb`; GitHub delivery recreates the reviewed tree on top of the approved initial commit. Use the branch head for the authoritative delivery commit. The earlier downloadable archive is a snapshot from before remote publication.

All application files are new. No credentials, dependency folders, generated build output or active `.env` are committed. GitHub Actions performs verification only, with no deployment job. The initial remote run is recorded separately after publication; local test results below remain the verified baseline.

## 11. Test evidence

| Command / verification                            | Result     | Evidence                                                          |
| ------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| `npm install --no-audit --no-fund`                | Passed     | Dependencies installed; package-lock created                      |
| `npm ci --no-audit --no-fund`                     | Passed     | Clean lockfile install: 995 packages; exit 0                      |
| `npm run lint`                                    | Passed     | ESLint exit 0                                                     |
| `npm run typecheck`                               | Passed     | Strict TypeScript exit 0                                          |
| `npm test`                                        | Passed     | 1 file, 16 tests                                                  |
| `npm run build`                                   | Passed     | Vite 8.3.8; 1,691 modules transformed                             |
| `npm run test:rules`                              | Passed     | 3 files, 19 tests; real Auth/Firestore emulators; 7.55 seconds    |
| `npm run seed:emulator` inside emulator execution | Passed     | Two test users / two test companies seeded                        |
| `npm run dev` + same-process HTTP GET             | Passed     | Vite ready; HTTP 200 and FacilityOS HTML title                    |
| `npm run format:check`                            | Passed     | All files formatted with Prettier                                 |
| `git diff --cached --check`                       | Passed     | No whitespace errors                                              |
| Cloud browser `http://localhost:5173`             | Blocked    | ERR_CONNECTION_REFUSED; browser cannot reach sandbox-local server |
| GitHub Actions remote run                         | Not Tested | Awaiting published-branch CI                                      |
| Live Firebase connectivity                        | Blocked    | Project not supplied                                              |

Initial issues corrected: dependency type conflict between Vite 7 and Vite 8 was resolved by aligning the app to Vite 8; effect cleanup lint warning corrected; UI test option typing corrected; local Vite binding changed to loopback after sandbox network-interface discovery failed. Final lint/typecheck/test/build commands above passed after those changes.

The build has a nonfatal large-chunk warning: approximately 910 kB JavaScript, 275 kB gzip, including Firebase/React/Zod. Bundle splitting and mobile performance measurement remain pre-release optimization tasks. No claim of production performance certification is made.

## 12. Spark restrictions

Only Auth email/password, Standard Firestore, rules, Hosting configuration and local emulation are used. Official Firebase pricing reviewed on 12 November 2026 confirms this service selection fits Spark within quotas. Cloud Functions, Storage, Scheduler, Run and App Hosting are deferred; no billing upgrade or deployment was performed. Secure adapters can be enabled after a later approved Blaze upgrade without changing tenant/identity paths.

Sources: https://firebase.google.com/pricing and https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 .

## 13. Acceptance checklist

| Acceptance criterion                | Status     | Scope/evidence                                                      |
| ----------------------------------- | ---------- | ------------------------------------------------------------------- |
| Existing reference inspected        | Passed     | Browser + public HTML                                               |
| Repository inspected                | Passed     | Empty state verified                                                |
| Development branch prepared         | Passed     | Development branch based on the approved initial commit             |
| Dependencies install                | Passed     | npm install; clean npm ci passed                                    |
| Admin app runs locally              | Passed     | Vite HTTP smoke                                                     |
| Spark compatibility                 | Passed     | Service selection/configuration + official docs; no paid service    |
| SDK initializes                     | Passed     | Auth/Firestore emulator integration                                 |
| Firestore intended environment      | Passed     | Intended local emulator; cloud environment blocked                  |
| Email/password authentication       | Passed     | Emulator SDK and UI tests                                           |
| Owner securely provisioned          | Blocked    | Trusted script ready; no real project/account selected              |
| Admin login/logout                  | Passed     | Emulator-backed component flow                                      |
| Protected routes                    | Passed     | UI route redirected before authentication                           |
| Membership resolution               | Passed     | SDK + rules tests                                                   |
| Company selection                   | Passed     | UI switches A to B without retaining A content                      |
| Unauthorized access denied          | Passed     | Rules + staff UI denial                                             |
| Rules tests                         | Passed     | 16 security tests                                                   |
| Cross-company isolation             | Passed     | Read/write denial tests                                             |
| Responsive admin layout             | Not Tested | CSS implemented/reviewed; visual browser QA blocked                 |
| Reference website unchanged         | Passed     | No production deployment, DNS or operational mutation               |
| No paid services required           | Passed     | No paid backend configured                                          |
| No committed secrets                | Passed     | Active env ignored; no service-account/private key in tracked files |
| Lint/typecheck/unit/build           | Passed     | Commands above                                                      |
| GitHub development commit published | Passed     | Application tree published through the connected GitHub tools       |
| Configuration/setup documentation   | Passed     | Complete docs included                                              |
| Manual steps documented             | Passed     | Firebase setup and remaining blockers                               |
| Browser reload persistence          | Not Tested | Requires reachable browser preview                                  |
| Password-reset email delivery       | Not Tested | Requires selected cloud project                                     |

## 14. Phase 1 readiness

Do not begin Phase 1 yet. Required next actions: review the development branch and CI results, supply the selected Firebase Web app configuration, confirm Firestore region/Spark setup, provision the owner securely, verify live rules/auth, and complete desktop/mobile browser QA. Any separate test Hosting deployment needs approval of the exact target project/URL. The current `fms.flowb.io` production website must remain untouched.
