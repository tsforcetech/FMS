import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  canOpenAdmin,
  companySchema,
  memberSchema,
  profileSchema,
} from './index';
import { parseFirebaseConfig } from '../../config/src';
const metadata = {
  schemaVersion: 1,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  createdBy: 'operator',
  updatedBy: 'operator',
};
const c = companySchema.parse({
  ...metadata,
  companyId: 'a',
  name: 'A',
  status: 'active',
  timeZone: 'Asia/Dubai',
});
const m = memberSchema.parse({
  ...metadata,
  companyId: 'a',
  uid: 'u',
  role: 'owner',
  status: 'active',
});
describe('authorization boundary', () => {
  it('allows active matching owner', () =>
    expect(canOpenAdmin(m, c, 'u')).toBe(true));
  it.each([
    'staff',
    'technician',
    'viewer',
    'customer',
    'supervisor',
    'site_manager',
  ] as const)('rejects %s in admin portal', (role) =>
    expect(canOpenAdmin({ ...m, role }, c, 'u')).toBe(false),
  );
  it('rejects mismatched user, tenant, disabled member and company', () => {
    expect(canOpenAdmin(m, c, 'other')).toBe(false);
    expect(canOpenAdmin({ ...m, companyId: 'b' }, c, 'u')).toBe(false);
    expect(canOpenAdmin({ ...m, status: 'inactive' }, c, 'u')).toBe(false);
    expect(canOpenAdmin(m, { ...c, status: 'suspended' }, 'u')).toBe(false);
  });
  it('rejects privilege fields in profile', () =>
    expect(
      profileSchema.safeParse({
        ...metadata,
        uid: 'u',
        displayName: 'Name',
        role: 'owner',
      }).success,
    ).toBe(false));
  it('rejects dates represented as strings', () =>
    expect(
      companySchema.safeParse({ ...c, createdAt: '2026-11-12' }).success,
    ).toBe(false));
  it('validates time zones', () =>
    expect(
      companySchema.safeParse({ ...c, timeZone: 'Not/AZone' }).success,
    ).toBe(false));
});
const env = {
  VITE_FIREBASE_ENV: 'emulator',
  VITE_FIREBASE_API_KEY: 'demo-facilityos',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-facilityos.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-facilityos',
  VITE_FIREBASE_APP_ID: 'demo-web',
};
describe('environment isolation', () => {
  it('allows local demo project', () =>
    expect(parseFirebaseConfig(env).mode).toBe('emulator'));
  it('rejects a real project in emulator mode', () =>
    expect(() =>
      parseFirebaseConfig({
        ...env,
        VITE_FIREBASE_PROJECT_ID: 'actual-project',
      }),
    ).toThrow());
  it('requires live opt-in', () =>
    expect(() =>
      parseFirebaseConfig({
        ...env,
        VITE_FIREBASE_ENV: 'live',
        VITE_FIREBASE_PROJECT_ID: 'actual-project',
      }),
    ).toThrow());
  it('rejects placeholders', () =>
    expect(() =>
      parseFirebaseConfig({
        ...env,
        VITE_FIREBASE_API_KEY: 'replace-with-key',
      }),
    ).toThrow());
  it('rejects missing configuration', () =>
    expect(() => parseFirebaseConfig({})).toThrow());
});
