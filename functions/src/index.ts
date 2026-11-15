/**
 * FacilityOS Cloud Functions (requires the Blaze plan).
 *
 * scheduledTaskGenerator — every 30 minutes, generates recurring task
 * occurrences and due/overdue/SLA notifications for every company the
 * scheduler service account belongs to. It calls exactly the same runner as
 * the admin "Run scheduler now" button (apps/admin-web/src/management/
 * scheduling.ts), and it writes through the Firestore client SDK signed in as
 * the scheduler account, so every write is still checked by the deployed
 * security rules. No password, API secret or service-account key is stored:
 * the function mints a short-lived custom token for the fixed scheduler uid
 * with its own runtime identity.
 *
 * The scheduler only processes companies where an operator has made it an
 * active admin member (scripts/provision-scheduler.mjs). Removing that
 * membership stops it for that company immediately.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp as adminApp } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithCustomToken,
  signOut,
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
  terminate,
} from 'firebase/firestore';
import { runScheduler } from '../../apps/admin-web/src/management/scheduling';

/** Fixed uid of the scheduler service account (no password, no email). */
export const SCHEDULER_UID = 'facilityos-scheduler';
// Public web configuration (not secret), injected at build time from .env.live.example.
declare const __FIREBASE_WEB_CONFIG__: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

adminApp();

export const scheduledTaskGenerator = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
    maxInstances: 1,
    retryCount: 0,
  },
  async () => {
    const token = await adminAuth().createCustomToken(SCHEDULER_UID, {
      scheduler: true,
    });
    const emulated = !!process.env.FIRESTORE_EMULATOR_HOST;
    const app = initializeApp(
      emulated
        ? {
            ...__FIREBASE_WEB_CONFIG__,
            apiKey: 'demo-key',
            projectId: process.env.GCLOUD_PROJECT || 'demo-facilityos',
          }
        : __FIREBASE_WEB_CONFIG__,
      `scheduler-${Date.now()}`,
    );
    const auth = getAuth(app);
    const db = initializeFirestore(app, { localCache: memoryLocalCache() });
    // Local emulators (tests): the client SDK must talk to them too.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST)
      connectAuthEmulator(
        auth,
        `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,
        { disableWarnings: true },
      );
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
      connectFirestoreEmulator(db, host, Number(port));
    }
    let failures = 0;
    try {
      const { user } = await signInWithCustomToken(auth, token);
      const companies = (
        await getDocs(
          query(collection(db, 'users', user.uid, 'companyAccess'), limit(100)),
        )
      ).docs.map((d) => d.id);
      if (!companies.length)
        logger.info(
          'No companies: the scheduler account is not a member of any company yet (scripts/provision-scheduler.mjs).',
        );
      for (const c of companies) {
        const m = (
          await getDoc(doc(db, 'companies', c, 'members', user.uid))
        ).data();
        if (
          !m ||
          m.status !== 'active' ||
          !['owner', 'admin'].includes(m.role)
        ) {
          logger.info(
            `${c}: skipped (scheduler is not an active admin member)`,
          );
          continue;
        }
        try {
          const r = await runScheduler(db, c, user.uid, {
            mode: 'server',
            horizonDays: 7,
            log: (line) => logger.info(`${c}: ${line}`),
          });
          logger.info(
            `${c}: ${r.status} — ${r.created} created, ${r.existing} existing, ${r.unassigned} unassigned, ${r.notifications} notifications`,
          );
          if (r.status !== 'ok') failures++;
        } catch (e) {
          failures++;
          logger.error(`${c}: run failed: ${(e as Error).message}`);
        }
      }
    } finally {
      await signOut(auth).catch(() => undefined);
      await terminate(db).catch(() => undefined);
      await deleteApp(app).catch(() => undefined);
    }
    if (failures)
      throw new Error(
        `${failures} company run(s) failed — see the logs and Scheduler monitor.`,
      );
  },
);
