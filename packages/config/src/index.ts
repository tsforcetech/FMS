import { z } from 'zod';
const schema = z.object({
  VITE_FIREBASE_ENV: z.enum(['emulator', 'live']),
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
  VITE_ALLOW_LIVE_FIREBASE: z.string().optional(),
});
export function parseFirebaseConfig(input: Record<string, unknown>) {
  const e = schema.parse(input);
  if (Object.values(e).some((v) => v.startsWith('replace-with-')))
    throw new Error('Firebase configuration still contains placeholders.');
  if (
    e.VITE_FIREBASE_ENV === 'emulator' &&
    e.VITE_FIREBASE_PROJECT_ID !== 'demo-facilityos'
  )
    throw new Error('Emulator mode requires demo-facilityos.');
  if (
    e.VITE_FIREBASE_ENV === 'live' &&
    (e.VITE_ALLOW_LIVE_FIREBASE !== 'true' ||
      e.VITE_FIREBASE_PROJECT_ID.startsWith('demo-'))
  )
    throw new Error(
      'Live Firebase access requires an explicit project and opt-in.',
    );
  return {
    mode: e.VITE_FIREBASE_ENV,
    options: {
      apiKey: e.VITE_FIREBASE_API_KEY,
      authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: e.VITE_FIREBASE_PROJECT_ID,
      appId: e.VITE_FIREBASE_APP_ID,
    },
  };
}
