/**
 * Server scheduler job (runs in GitHub Actions on a timer, independent of any
 * open browser). It signs in as a dedicated scheduler account and calls the
 * same runner as the admin "Run now" button, so every write still goes through
 * the deployed Firestore security rules. No service-account key is used.
 *
 * Required environment (GitHub Actions secrets):
 *   SCHEDULER_EMAIL, SCHEDULER_PASSWORD   – dedicated account, owner/admin member
 *                                           of each company it should process
 * Optional:
 *   SCHEDULER_COMPANIES   – comma-separated company IDs (default: all active
 *                           memberships listed under users/{uid}/companyAccess)
 *   SCHEDULER_HORIZON_DAYS (default 7), SCHEDULER_DRY_RUN=true (sign in and list only)
 *   FIREBASE_EMULATOR=true – use local emulators (tests)
 * Public web configuration comes from .env.live.example (not secret).
 */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  memoryLocalCache,
  query,
} from 'firebase/firestore';
import { runScheduler } from '../apps/admin-web/src/management/scheduling';

function publicConfig() {
  const env: Record<string, string> = {};
  for (const line of readFileSync('.env.live.example', 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  const emulator = process.env.FIREBASE_EMULATOR === 'true';
  return {
    emulator,
    options: {
      apiKey: emulator ? 'demo-key' : env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: emulator
        ? process.env.FIREBASE_PROJECT || 'demo-facilityos'
        : env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    },
  };
}

async function main() {
  const email = process.env.SCHEDULER_EMAIL;
  const password = process.env.SCHEDULER_PASSWORD;
  if (!email || !password) {
    console.log(
      'Scheduler is not activated: SCHEDULER_EMAIL / SCHEDULER_PASSWORD secrets are not configured. Nothing was run.',
    );
    return;
  }
  const cfg = publicConfig();
  const app = initializeApp(cfg.options);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  if (cfg.emulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as scheduler account ${user.uid}`);
  let companies = (process.env.SCHEDULER_COMPANIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!companies.length)
    companies = (
      await getDocs(
        query(collection(db, 'users', user.uid, 'companyAccess'), limit(50)),
      )
    ).docs.map((d) => d.id);
  let failures = 0;
  for (const c of companies) {
    const member = await getDoc(doc(db, 'companies', c, 'members', user.uid));
    const m = member.data();
    if (!m || m.status !== 'active' || !['owner', 'admin'].includes(m.role)) {
      console.log(`${c}: skipped (scheduler account is not an active admin)`);
      continue;
    }
    if (process.env.SCHEDULER_DRY_RUN === 'true') {
      console.log(`${c}: dry run, not generating`);
      continue;
    }
    try {
      const r = await runScheduler(db, c, user.uid, {
        mode: 'server',
        horizonDays: Number(process.env.SCHEDULER_HORIZON_DAYS || 7),
        log: (line) => console.log(`${c}: ${line}`),
      });
      if (r.status !== 'ok') failures++;
    } catch (e) {
      failures++;
      console.error(`${c}: run failed: ${(e as Error).message}`);
    }
  }
  await auth.signOut();
  if (failures) process.exitCode = 1;
}
main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
