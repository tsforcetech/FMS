import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
} from 'firebase/firestore';
import { parseFirebaseConfig } from '@facilityos/config';
export function createFirebase() {
  const config = parseFirebaseConfig(import.meta.env);
  const app = initializeApp(config.options);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  if (config.mode === 'emulator') {
    if (!['localhost', '127.0.0.1', '::1'].includes(location.hostname))
      throw new Error('Emulator mode is restricted to a local browser.');
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  const ready = setPersistence(auth, browserLocalPersistence);
  return { auth, db, ready, mode: config.mode };
}
export type FirebaseServices = ReturnType<typeof createFirebase>;
