# Phase 6 — Android & iOS app: task execution, QR, photo evidence, GPS, attendance and offline sync

Date: 15 November 2026. Branch `feature/phase6-mobile-apps`, started from `main` at `c2ca25d` (Phase 5 merged, published and recorded).

Firebase stays on **Spark**. No billing change, no Cloud Storage, no Cloud Functions, no new Firebase project or database. `fms.flowb.io` untouched.

## Starting checks

| Check                       | Result                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 5 Staff Web           | Published at https://tsforcetech.github.io/FMS/staff/ (verified live: loads on a phone viewport; an admin login without a staff link is refused). Rules deployed, 185 indexes READY.    |
| Real production staff login | **Not verified** — no live staff login exists and creating production users was not approved. Verified end to end on the emulator (Phase 5 staff browser suite, Phase 6 runtime suite). |
| Automatic scheduler         | **Not active.** The “Task scheduler” workflow exists on `main` but has no recorded runs; repository secrets cannot be read from this environment. Treated as pending activation.        |
| Native mobile               | Not started before this phase (`apps/mobile` held only a placeholder README).                                                                                                           |

## Framework decision

**Capacitor 8** (Android + iOS native shells) over the existing React/TypeScript code.

- The staff portal (Phase 5) is a tested React app on the same Firebase web SDK. Capacitor runs it in the native WebView and adds native plugins: ML Kit barcode scanning, camera, geolocation, network status, Keychain/Keystore secure storage and app preferences.
- React Native/Expo would have required rewriting every screen and the Firebase data layer, i.e. duplicating the task engine and stores the brief says not to duplicate.
- Native-only code lives in `apps/mobile/src/platform.ts`; offline logic in `apps/mobile/src/offline/` (plain TypeScript, unit-tested in Node); screens reuse `@staff/*` and the audited `@admin/management/*` stores.

| Item                   | Value                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Android application ID | `com.sharaco.facilityos`                                                                                              |
| iOS bundle identifier  | `com.sharaco.facilityos`                                                                                              |
| Version                | 0.6.0 (Android versionCode 6)                                                                                         |
| Android SDK            | compile/target 36, min 24                                                                                             |
| Permissions            | INTERNET, CAMERA, ACCESS_FINE/COARSE_LOCATION, ACCESS_NETWORK_STATE; iOS camera and when-in-use location descriptions |
| Backups                | `allowBackup=false` and data-extraction rules exclude all app data from cloud backup and device transfer              |

## Status

| Capability                                                                   | Status                                            | Evidence                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android app builds                                                           | **Implemented, built**                            | Debug APK `app-debug.apk` (31.7 MB, SHA-256 `9e0ae971380706bdf5515490b57023a69b72ba74d06b9914a59885c3b0eeee2f`), verified with `aapt2`/`apksigner`. CI workflow `Android app` builds it on every push and uploads it as an artifact.                                                                     |
| Android device/emulator run                                                  | **Blocked here**                                  | This build machine has no KVM and no attached device, so the APK was not installed on Android. The same bundle was exercised in Chromium (the engine of Android's WebView) with a mobile viewport, a real camera stream and emulated GPS — see the runtime suite. Install on a device: see _Installing_. |
| iOS project                                                                  | **Implemented (source)**                          | `apps/mobile/ios` generated by Capacitor with bundle ID and usage descriptions. **Not built**: needs macOS + Xcode; IPA/TestFlight need an Apple Developer account and signing — not available.                                                                                                          |
| Login, session persistence, company selection, revocation                    | Implemented, tested                               | Reuses the Phase 5 identity model; mobile adds an offline-aware resolver (last verified identity, encrypted) and wipes device data on denial or sign-out                                                                                                                                                 |
| My Day, My Tasks (offline-first)                                             | Implemented, tested                               |                                                                                                                                                                                                                                                                                                          |
| Checklist execution (step-by-step, validation, save, review, submit, rework) | Implemented, tested                               | Same template snapshot, validation and transitions as web; queued                                                                                                                                                                                                                                        |
| QR scanning                                                                  | Implemented, tested                               | ML Kit on device; camera + jsQR in the WebView fallback; manual entry. Real decode from a live video stream in the runtime suite                                                                                                                                                                         |
| Camera photo evidence                                                        | **Implemented; remote upload pending activation** | Capture → compress (≤1280 px, JPEG 60%) → AES-GCM encrypted on device. Upload adapter is wired but inactive: Cloud Storage needs Blaze. Photos are never marked uploaded and never stored in Firestore.                                                                                                  |
| GPS verification                                                             | Implemented, tested                               | One reading per explicit action, with accuracy and timestamp; never continuous                                                                                                                                                                                                                           |
| Attendance check-in/out                                                      | Implemented, tested                               | Server time is authoritative; supervisor/admin corrections with reason                                                                                                                                                                                                                                   |
| Offline drafts, queue, sync, conflicts                                       | Implemented, tested                               | See below                                                                                                                                                                                                                                                                                                |
| Issue reporting & escalation                                                 | Implemented, tested                               | Queued issue from a task (idempotent); standalone reports and escalations via the Phase 5 screens (online)                                                                                                                                                                                               |
| Work orders                                                                  | Implemented (Phase 5 screens, online)             | Start, hold, resume, update, request assistance, resolve; verify/close stay with supervisors                                                                                                                                                                                                             |
| Supervisor views                                                             | Implemented                                       | Approvals queue and in-task review (online), site-scoped by rules                                                                                                                                                                                                                                        |
| Push notifications                                                           | **Blocked / pending activation**                  | Needs FCM configuration (`google-services.json` / APNs key) and a trusted sender (Cloud Functions on Blaze or another server). The in-app notification centre and badge work. No push plugin is shipped so nothing claims delivery.                                                                      |
| Localization                                                                 | Implemented                                       | English complete; Malayalam, Hindi, Arabic (RTL) for core actions, marked preview                                                                                                                                                                                                                        |

## Security and data protection

- **Identity:** a mobile login never has more authority than the same user's Staff Web access — the same Firestore rules apply. The employee ID always comes from the server-side link.
- **Tokens:** Firebase Auth keeps its session in the app's private WebView storage (app sandbox, OS file encryption). Passwords are never stored. A Keychain-backed native auth plugin is a possible hardening step.
- **Device data:** tasks, drafts, the offline queue, place names and photos are stored only as AES-256-GCM ciphertext; the key is per user and kept in the Android Keystore-backed / iOS Keychain secure store. Sign-out, account switch, revoked access or a server denial deletes the ciphertext **and** the key. Switching company drops the previous company's cached data.
- **Offline access** is limited to tasks the server returned for this employee during a previous sync; a never-synced task cannot be opened offline.
- **Rules added (Phase 6):**
  - `attendance/{employeeId}_{date}`: create only by the linked employee, for today, in a scope site, with `checkInAt == request.time`; check-out once with server time; supervisors (in scope, never for themselves) and admins correct times with a reason; readable by the employee, scoped supervisors and admins.
  - `taskEvidence/{taskId}_{attempt}_{questionId}`: create-only by the assignee while the task is in progress; a QR record must match the task's own asset/location/facility; GPS records carry bounded coordinates and accuracy.
- **Location retention:** coordinates exist only in attendance and evidence records (access-restricted as above); nothing is collected in the background. Retention/deletion schedules for these records are a policy decision for Phase 7 reporting.
- **Local evidence retention:** photos stay encrypted on the device until upload is activated, and are destroyed on sign-out/account switch. Recommended policy once upload exists: delete after confirmed upload, and at most 30 days after capture.

## Offline sync architecture

1. Every change (start, pause, resume, restart, save progress, submit, evidence, issue report) becomes an **operation**: id, company, user, employee, task, type, base revision, created time, payload version, status, attempts, last error.
2. The operation is applied immediately to the encrypted local copy (optimistic) and the engine runs when online (app start, reconnection, every 2 minutes, manual “Sync now”). Background execution is not relied on (Android/iOS limits); sync resumes in the foreground.
3. Before applying anything, the engine re-checks identity with the server (`revalidate`). A revoked user's queue is **blocked** and the device copy wiped.
4. Each operation re-reads the server task. If the revision matches, it runs through the same store functions and rules as the web. If not:
   - the same user's identical change already applied (lost acknowledgement) → recognised as a **duplicate**;
   - otherwise → **conflict**: nothing is overwritten, the server state wins, and later changes to the same task are held for review.
5. Network errors keep the operation pending; an app killed mid-sync resumes it. Issues use the operation ID as their record ID, so retries can never create a second report or work order.

## Verification (executed)

| Suite                                                 | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| format, lint, typecheck, build (admin, staff, mobile) | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Unit (`npm test`)                                     | 71 tests incl. QR parsing, attendance/lateness/accuracy helpers, encrypted vault (ciphertext only, per-user isolation, unreadable after destroy), queue persistence across restart, ordered sync with network loss and retry, conflict propagation, revocation blocking                                                                                                                                                                                                                                                                                                                                                                               |
| Emulator rules (`npm run test:rules`)                 | 89 tests incl. 8 new Phase 6 suites: attendance once per day, forged identity/site/date/time refused, idempotent check-out, staff cannot rewrite times or read others', supervisor correction with reason, no self-correction; QR evidence only when matching the task's asset and in progress, forged evidence refused, other staff denied; offline session applied once, lost acknowledgements recognised, cancellation while offline → conflict, Staff Web submission never overwritten, queued issue sent once, revocation blocks queued work; encrypted task cache isolation                                                                     |
| Mobile runtime (`npm run test:mobile-runtime`)        | 8 checks in Chromium (390×844, touch, fake camera with a real QR label, emulated GPS, real network loss): sign-in and My Day; check-in with GPS accuracy; QR decoded from the camera stream and verified against the task asset; GPS evidence; offline draft/save/submit queued; offline app restart restores identity, tasks and queue with ciphertext-only storage; reconnection syncs and the server holds verified QR and GPS evidence; cancellation-while-offline conflict; out-of-scope and foreign QR codes refused; Arabic RTL; no overflow at 320/360/412 px; sign-out wipes data and key. Evidence: [docs/evidence/phase6](evidence/phase6) |
| Admin (20) and Staff (10) browser suites, migration   | Pass (Phase 0–5 regression)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Installing the Android test build

1. Download the `facilityos-android-debug-apk` artifact from the latest **Android app** workflow run — first green run: https://github.com/tsforcetech/FMS/actions/runs/43660578424 (artifact kept until 13 Feb 2027) — or use the APK attached to this delivery.
2. On the Android phone allow “Install unknown apps” for the browser/files app, open the APK and install.
3. Sign in with a staff login that an admin has linked under Administration → Staff access. The build talks to the live `facilityos-43386` project.

Release (Play Store) build: provide `FOS_KEYSTORE_FILE`, `FOS_KEYSTORE_PASSWORD`, `FOS_KEY_ALIAS`, `FOS_KEY_PASSWORD` and run `./gradlew bundleRelease` in `apps/mobile/android`.

iOS: on a Mac with Xcode 16+, `npm ci && npm run build -w @facilityos/mobile && npx cap sync ios`, open `apps/mobile/ios/App/App.xcodeproj`, choose the team and run on a simulator or device; archive for TestFlight with an Apple Developer account.

## Required credentials / infrastructure

| Needed for              | Requirement                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Device testing          | An Android phone (or a machine with KVM for the emulator); a Mac with Xcode for iOS                                  |
| Play Store / TestFlight | Android upload keystore; Apple Developer Program membership and signing                                              |
| Photo upload            | Cloud Storage → Firebase Blaze plan, Storage security rules, size/type limits                                        |
| Push                    | FCM (Android `google-services.json`, APNs key) and a trusted sender (Cloud Functions on Blaze or an approved server) |
| Live acceptance         | A real staff login linked to a real employee in GBH                                                                  |

## Limitations

- Attendance needs a connection (the server clock is the record); GPS is approximate and not proof of presence; QR scans are not proof against deliberate misuse.
- Work orders, calendar, notifications, standalone reports and approvals are online features in the app.
- Translations other than English cover core actions only; checklist answer buttons (Pass/Fail/Yes/No) come from the shared checklist and are English.
- Phase 7 has not been started.
