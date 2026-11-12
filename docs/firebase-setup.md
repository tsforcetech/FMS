# Firebase setup — Spark only

No real Firebase project has been selected in this repository. Do not invent a project ID or use the existing live website's hosting project implicitly.

## 1. Console setup

1. Open https://console.firebase.google.com/ and create/select the project intended for FacilityOS. Confirm the project ID with the owner. Optional Analytics is not required.
2. Confirm the billing plan is **Spark**. Do not attach a billing account or enable paid services.
3. In Project settings → General → Your apps, register a Web app and copy apiKey, authDomain, projectId and appId. Do not register App Hosting.
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

## 3. Real project configuration (when authorized)

Copy `.env.example` to `.env`, replace placeholders using the registered web app, set `VITE_FIREBASE_ENV=live`, and set `VITE_ALLOW_LIVE_FIREBASE=true` only for intentional cloud access. Restart Vite or rebuild after changes. Vite values are embedded at build time. Never paste service-account JSON into any `VITE_` variable. Firebase web values are public client configuration; database authorization is enforced by rules.

No `.firebaserc` cloud default is committed. Every cloud CLI command must specify the confirmed project ID explicitly. Review the CLI account and target project before mutation.

## 4. Deploy rules, then provision the owner

After the selected project is approved and the rules tests pass, an authorized operator may run:

```sh
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_CONFIRMED_PROJECT_ID
```

This changes the selected project's rules. Never run it against an unrelated project.

In Firebase Console → Authentication → Users, create the intended owner email/password account securely. Share/reset credentials through your normal secure process, not GitHub or chat logs. Copy its UID.

Use trusted local Application Default Credentials (e.g. `gcloud auth application-default login` with a suitably restricted operator account). Keep credentials outside the repository. The script uses no frontend credentials and will not create passwords:

```sh
npm run provision:owner -- --project YOUR_CONFIRMED_PROJECT_ID --confirm-project YOUR_CONFIRMED_PROJECT_ID --company YOUR_COMPANY_ID --name "Your company name" --uid EXISTING_AUTH_UID --time-zone Asia/Dubai
```

The script creates the company, owner membership, user profile if absent, own company discovery hint, and audit record atomically. It refuses overwrite. Additional memberships, suspensions and role changes are trusted administrative procedures until the corresponding audited management phase exists. For another company owned by the same user, rerun with a new company ID and the same UID; the existing profile is preserved.

## 5. Verify the selected live project

Use a separately authorized owner account. Verify login, reload persistence, company details, company switching where applicable, logout, denied staff access and revoked membership. Confirm SDK projectId, Console project and deployed rules all match. Record exact test outcome and date in `phase0-report.md`. Failure is not permission to open rules globally.

## 6. Separate Hosting deployment — approval required

`firebase.json` serves `apps/admin-web/dist` with SPA fallback and basic security headers. There is **no automatic deployment**. Once the owner approves the exact test project and separate Hosting URL:

```sh
npm run check
npm run test:rules
# Ensure the intended LIVE .env is set before rebuilding
npm run build
npx firebase deploy --only hosting --project YOUR_CONFIRMED_PROJECT_ID
```

The default `PROJECT_ID.web.app` test hostname is suitable only if confirmed unused/authorized. Do not deploy to `fms.flowb.io` or attach its domain. Password reset requires the authorized domain/email template settings for that project. Actual email delivery is unverified until a live test is authorized.

## Spark limits and deferred services

As checked on 12 November 2026, Standard Firestore's Spark allocation includes 1 GiB stored data, 50K document reads/day, 20K writes/day, 20K deletes/day and 10 GiB monthly egress. Hosting includes 10 GB storage and 360 MB/day transfer. Email/password authentication is available. Monitor quotas in Console; budget limits do not replace secure query design.

No Cloud Functions, Storage, Scheduler, Run, App Hosting, paid extensions, image base64 in Firestore, or fake browser scheduling is used. Cloud Storage now requires Blaze. A later approved upgrade preserves Auth UIDs and company paths; it enables trusted adapters and jobs rather than replacing the schema.

Sources checked: https://firebase.google.com/pricing ; https://firebase.google.com/docs/projects/billing/firebase-pricing-plans ; https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 ; https://firebase.google.com/docs/rules/unit-tests ; https://firebase.google.com/docs/emulator-suite/install_and_configure . Recheck quotas before release.
