// @vitest-environment jsdom
import { beforeAll, afterAll, it, expect } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  inMemoryPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  terminate,
} from 'firebase/firestore';
import {
  initializeApp as initAdmin,
  deleteApp as deleteAdmin,
} from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb, Timestamp } from 'firebase-admin/firestore';
import App from '../../apps/admin-web/src/App';
import type { FirebaseServices } from '../../apps/admin-web/src/firebase';
let admin: ReturnType<typeof initAdmin>;
const client = initializeApp(
  {
    projectId: 'demo-facilityos',
    apiKey: 'demo-facilityos',
    appId: 'demo-web',
  },
  'ui-test',
);
const auth = getAuth(client),
  db = getFirestore(client);
let services: FirebaseServices;
beforeAll(async () => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
  )
    throw new Error('Emulators required');
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  services = {
    auth,
    db,
    ready: setPersistence(auth, inMemoryPersistence),
    mode: 'emulator',
  };
  await services.ready;
  admin = initAdmin({ projectId: 'demo-facilityos' }, 'ui-test-admin');
  const store = adminDb(admin),
    meta = {
      schemaVersion: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: 'test',
      updatedBy: 'test',
    };
  for (const [uid, role] of [
    ['ui-owner', 'owner'],
    ['ui-staff', 'staff'],
  ]) {
    await adminAuth(admin).createUser({
      uid,
      email: uid + '@example.test',
      password: 'Local-only-123!',
    });
    await store.doc('users/' + uid).set({ ...meta, uid, displayName: uid });
    for (const companyId of ['ui-company-a', 'ui-company-b']) {
      await store.doc('companies/' + companyId).set({
        ...meta,
        companyId,
        name: companyId,
        status: 'active',
        timeZone: 'Asia/Dubai',
      });
      await store
        .doc(`companies/${companyId}/members/${uid}`)
        .set({ ...meta, companyId, uid, role, status: 'active' });
      await store
        .doc(`users/${uid}/companyAccess/${companyId}`)
        .set({ companyId });
    }
  }
});
afterAll(async () => {
  cleanup();
  await terminate(db);
  await deleteApp(client);
  if (admin) await deleteAdmin(admin);
});
it('protects routes, authenticates, switches companies, denies revoked access and logs out', async () => {
  const user = userEvent.setup();
  window.history.replaceState({}, '', '/');
  render(<App services={services} />);
  await screen.findByRole('heading', { name: 'Sign in to your workspace' });
  await user.type(
    screen.getByLabelText('Email address'),
    'ui-owner@example.test',
  );
  await user.type(screen.getByLabelText('Password'), 'wrong-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Your company workspace')).toBe(null);
  await user.clear(screen.getByLabelText('Password'));
  await user.type(screen.getByLabelText('Password'), 'Local-only-123!');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: 'Your company workspace' });
  await screen.findByRole('heading', { name: 'ui-company-a' });
  await user.selectOptions(
    screen.getByLabelText('Current company'),
    'ui-company-b',
  );
  await screen.findByRole('heading', { name: 'ui-company-b' });
  expect(screen.queryByRole('heading', { name: 'ui-company-a' })).toBe(null);
  await user.click(screen.getByRole('link', { name: /Companies & sites/ }));
  await screen.findByRole('heading', { name: 'Coming in Phase 1' });
  await adminDb(admin)
    .doc('companies/ui-company-b/members/ui-owner')
    .update({ status: 'inactive' });
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Coming in Phase 1' })).toBe(
      null,
    ),
  );
  await user.click(screen.getByLabelText('Profile menu'));
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('heading', { name: 'Sign in to your workspace' });
  await user.type(
    screen.getByLabelText('Email address'),
    'ui-staff@example.test',
  );
  await user.type(screen.getByLabelText('Password'), 'Local-only-123!');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: 'Access denied' });
  expect(screen.queryByLabelText('Current company')).toBe(null);
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('heading', { name: 'Sign in to your workspace' });
}, 30000);
