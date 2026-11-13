# Firebase setup — Spark only

The owner supplied the web app configuration for **`facilityos-43386`** on 12 November 2026. The public client values are in `.env.live.example`. This does not provide administrative credentials or confirm that backend services are ready. The existing reference website's Hosting remains outside this setup.

## 1. Console setup

1. Open https://console.firebase.google.com/project/facilityos-43386/overview and select `facilityos-43386`. Optional Analytics is not required.
2. Confirm the billing plan is **Spark**. Do not attach a billing account or enable paid services.
3. The Web app is already registered: `1:719629044951:web:4b85fb3265f04f2bd63492`. Auth and Firestore use the supplied apiKey, authDomain, projectId and appId. Analytics, Messaging and Storage SDKs are not initialized in Phase 0; their extra configuration fields are not needed. Do not register App Hosting.
4. In Build → Authentication → Get started → Sign-in method, enable **Email/Password**. Leave phone auth and unrelated providers disabled. Review email enumeration protection. Under Settings → Authorized domains, allow the approved test hostname; add localhost only if live local testing is intentionally required.
5. In Build → Firestore Database → Create database, choose **Standard edition**, default database, and production/locked rules. Choose the permanent region with the team based on users, latency and data-residency needs; do not assume a region can later be changed. No test-mode open rules.
6. Prepare Firebase Hosting only for a separate test URL. Never change `fms.flowb.io`, its DNS, custom domain or existing deployment.

## 2. Local environment

Node 22.12+ and Java 21 are required. Install with `npm ci`. For isolated local testing use:

```sh
cp .env.emulator.example .env
npm run emulators
# separate terminal
npm run seed:emulator
npm run dev
```

Auth runs on loopback 9099; Firestore on loopback 8080. `demo-facilityos` is local-only. The SDK's emulator mode refuses real project IDs and non-local browser origins. No production fallback is used if an emulator is down. Emulator seeding only contacts these hard-coded loopback services. CI uses the same demo project without credentials.

## 3. Selected live project configuration

For an intentional production-mode build targeting the supplied project:

```sh
cp .env.live.example .env.production.local
npm run build
```

The ignored `.env.production.local` overrides the emulator `.env` only for production-mode builds; ordinary `npm run dev` continues to use `.env`. To deliberately test live Firebase in development, copy `.env.live.example` to `.env` instead. Both live examples opt in with `VITE_ALLOW_LIVE_FIREBASE=true`. Remove `.env.production.local` to return production builds to the base environment. Restart Vite or rebuild after changes. Vite values are embedded at build time. Never paste service-account JSON into any `VITE_` variable. Firebase web values are public client configuration; database authorization is enforced by rules.

No `.firebaserc` cloud default is committed. Every cloud CLI command must specify the confirmed project ID explicitly. Review the CLI account and target project before mutation.

### Read-only checks on 12 November 2026

- Public Authentication configuration returned HTTP 400 `CONFIGURATION_NOT_FOUND`. Authentication setup remains pending.
- An unauthenticated read of a diagnostic Firestore document path returned HTTP 403: the Cloud Firestore API has not been used in this project or is disabled. No document content was returned. This is not evidence that the intended security rules are deployed.
- Firebase CLI has no authenticated operator session in this workspace. An authorized Firebase connection is needed for administrative setup.

No cloud data, users, rules, billing or Hosting were changed by these checks. Billing plan, database region and live owner access remain unverified.

## 4. Deploy rules, then provision the owner

After the selected project is approved and the rules tests pass, an authorized operator may run:

```sh
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project facilityos-43386
```

This changes the selected project's rules. Never run it against an unrelated project.

In Firebase Console → Authentication → Users, create the intended owner email/password account securely. Share/reset credentials through your normal secure process, not GitHub or chat logs. Copy its UID.

Use trusted local Application Default Credentials (e.g. `gcloud auth application-default login` with a suitably restricted operator account). Keep credentials outside the repository. The script uses no frontend credentials and will not create passwords:

```sh
npm run provision:owner -- --project facilityos-43386 --confirm-project facilityos-43386 --company YOUR_COMPANY_ID --name "Your company name" --uid EXISTING_AUTH_UID --time-zone Asia/Dubai
```

The script creates the company, owner membership, user profile if absent, own company discovery hint, and audit record atomically. It refuses overwrite. Additional memberships, suspensions and role changes are trusted administrative procedures until the corresponding audited management phase exists. For another company owned by the same user, rerun with a new company ID and the same UID; the existing profile is preserved.

## 5. Verify the selected live project

Use a separately authorized owner account. Verify login, reload persistence, company details, company switching where applicable, logout, denied staff access and revoked membership. Confirm SDK projectId, Console project and deployed rules all match. Record exact test outcome and date in `phase0-report.md`. Failure is not permission to open rules globally.

## 6. Separate Hosting deployment — approval required

`firebase.json` serves `apps/admin-web/dist` with SPA fallback and basic security headers. There is **no automatic deployment**. Once the owner approves the exact test project and separate Hosting URL:

```sh
npm run check
npm run test:rules
# Ensure .env.production.local contains the intended live configuration
npm run build
npx firebase deploy --only hosting --project facilityos-43386
```

The default `PROJECT_ID.web.app` test hostname is suitable only if confirmed unused/authorized. Do not deploy to `fms.flowb.io` or attach its domain. Password reset requires the authorized domain/email template settings for that project. Actual email delivery is unverified until a live test is authorized.

## Spark limits and deferred services

As checked on 12 November 2026, Standard Firestore's Spark allocation includes 1 GiB stored data, 50K document reads/day, 20K writes/day, 20K deletes/day and 10 GiB monthly egress. Hosting includes 10 GB storage and 360 MB/day transfer. Email/password authentication is available. Monitor quotas in Console; budget limits do not replace secure query design.

No Cloud Functions, Storage, Scheduler, Run, App Hosting, paid extensions, image base64 in Firestore, or fake browser scheduling is used. Cloud Storage now requires Blaze. A later approved upgrade preserves Auth UIDs and company paths; it enables trusted adapters and jobs rather than replacing the schema.

Sources checked: https://firebase.google.com/pricing ; https://firebase.google.com/docs/projects/billing/firebase-pricing-plans ; https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 ; https://firebase.google.com/docs/rules/unit-tests ; https://firebase.google.com/docs/emulator-suite/install_and_configure . Recheck quotas before release.
