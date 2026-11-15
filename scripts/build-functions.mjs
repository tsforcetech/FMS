// Bundles functions/src/index.ts (and the app code it reuses) into
// functions/lib/index.js. firebase, firebase-admin and firebase-functions stay
// external and are installed by Cloud Build from functions/package.json.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.live.example', 'utf8')
    .split('\n')
    .map((l) => /^([A-Z_]+)=(.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
await build({
  entryPoints: ['functions/src/index.ts'],
  outfile: 'functions/lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: false,
  external: [
    'firebase',
    'firebase/*',
    'firebase-admin',
    'firebase-admin/*',
    'firebase-functions',
    'firebase-functions/*',
  ],
  define: { __FIREBASE_WEB_CONFIG__: JSON.stringify(config) },
  logLevel: 'info',
});
