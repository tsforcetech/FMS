# FacilityOS

Sharaco Technologies' multi-company facility management platform. The administrator application covers Phase 0 (foundation), Phase 1 (companies, physical sites, locations, facilities, clients, contracts and allocations) and Phase 2 (people and teams, assets and furniture, materials and inventory) with the redesigned UI. Staff web, Android/iOS and operational modules are future phases. See the [Phase 2 report](docs/phase2-report.md).

**The existing `https://fms.flowb.io/` is a visual reference only.** Forms, fields, hierarchy and workflows follow our planned FacilityOS structure, not the prototype's demo data model. No production deployment or DNS change is part of this delivery.

## Stack and prerequisites

React, strict TypeScript, Vite, Tailwind CSS, React Router, Firebase modular SDK and Zod. npm workspaces; Node 22.12+ (Node 22 LTS in CI), npm and Java 21 for Firestore emulation. Exact installed dependencies are locked in `package-lock.json`.

## Quick start — local only

```sh
npm ci
cp .env.emulator.example .env
npm run emulators
```

Keep emulators running. In another terminal:

```sh
npm run seed:emulator
npm run dev
```

Open `http://localhost:5173`. Use `owner@example.test` / `Local-only-123!` for two authorized test companies. `staff@example.test` with the same password must see Access denied. These are isolated emulator fixtures, never production users. Seed is explicitly repeatable and resets only the fixture company/profile records; it never contacts a live project. Restarting emulators without export clears their in-memory data.

Without configuration the app shows a setup-required screen. Without running emulators it fails closed. The demo project ID is not an invented production Firebase project.

## Verification

```sh
npm run format:check
npm run check
npm run test:rules
```

`check` runs lint, strict typechecking, unit tests (including the rules/index sync check) and the production build. `npm run test:browser` runs the end-to-end suite; Phase 2 rule validators are regenerated with `GENERATE_RULES=1 npx vitest run packages/shared/src/rules-sync.test.ts`. `test:rules` starts its own Auth/Firestore emulators, runs security and SDK integration tests, and shuts them down. Stop interactive emulators first to avoid port conflicts. Tests use a demo project and require no cloud credentials. `npm run build` produces `apps/admin-web/dist`; a build without a configured environment is deliberately not a live connected deployment.

## Repository layout

- `apps/admin-web`: login, reset, session handling, company discovery, validated admin shell.
- `apps/staff-web`, `apps/mobile`: future app boundaries; documentation only.
- `packages/shared`: Phase 0 schemas, permissions, future domain contracts, adapters and tests.
- `packages/ui`: reusable accessible field/message primitives.
- `packages/config`: environment validation and live-access opt-in.
- `firebase`: deny-by-default rules, indexes, emulator/integration tests and future Functions boundary.
- `scripts`: isolated emulator fixtures and trusted local owner provisioning.
- `docs`: source audit, architecture, schema, security, setup, UX and roadmap.
- `.github/workflows/ci.yml`: checks only, no deployment.

## Next steps

The owner-selected Firebase project is `facilityos-43386`; its public web configuration is in `.env.live.example`. Read [Firebase setup](docs/firebase-setup.md) for the intentional live build steps. Authentication/Firestore setup, owner provisioning and live verification remain pending and separate from emulator results. Never put service-account keys in this repository or frontend.

See [source audit](docs/source-audit.md), [architecture](docs/architecture/architecture.md), [schema](docs/database/database-schema.md), [security](docs/security/security.md), [UX contract](docs/ux-contract.md), [roadmap](docs/development-roadmap.md) and [verification report](docs/phase0-report.md).

Phase 0 code belongs to `feature/phase0-foundation`. Do not merge into `main`, deploy Firebase Hosting, or modify the reference website without the required review/approval.
