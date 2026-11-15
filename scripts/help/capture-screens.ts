/**
 * Captures Help Center screenshots from the applications running against the
 * LOCAL EMULATORS with demo data (never live data, never real people).
 * Run through `npm run help:screens`, which first runs the browser test suites
 * so the emulator holds realistic demo records, then this script.
 *
 * Output: docs/help/assets/screens/{admin-<navId>,staff-*,customer-*,platform-*,join}.png
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { renameSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, type Page } from 'playwright';
import { appRoutes, chromiumOptions, helpDir, root } from './lib.ts';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099')
  throw Error('Screenshots are taken from the local emulators only (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST).');
const pw = 'Local-only-123!';
const env = {
  ...process.env,
  VITE_FIREBASE_ENV: 'emulator',
  VITE_FIREBASE_PROJECT_ID: 'demo-facilityos',
  VITE_FIREBASE_API_KEY: 'demo-facilityos',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-facilityos.firebaseapp.com',
  VITE_FIREBASE_APP_ID: 'demo-facilityos-web',
  VITE_ALLOW_LIVE_FIREBASE: 'false',
  VITE_ROUTER_MODE: 'browser',
  VITE_BASE_PATH: '/',
  VITE_STAFF_BASE_PATH: '/',
  VITE_CUSTOMER_BASE_PATH: '/',
  VITE_PLATFORM_BASE_PATH: '/',
};
const serve = (app: string, port: number) =>
  spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: path.join(root, 'apps', app),
    stdio: 'pipe',
    env,
  });
const apps = { admin: 5181, staff: 5182, customer: 5183, platform: 5184 } as const;
const servers = Object.entries(apps).map(([a, p]) => serve(a === 'admin' ? 'admin-web' : `${a}-web`, p));
const url = (a: keyof typeof apps) => `http://127.0.0.1:${apps[a]}`;
const only = process.argv.slice(2);
const out = path.join(helpDir, 'assets/screens');
const taken: string[] = [];
const errors: string[] = [];

async function waitUp() {
  for (const a of Object.keys(apps) as (keyof typeof apps)[])
    for (let n = 0; ; n++) {
      try {
        if ((await fetch(url(a))).ok) break;
      } catch {
        /* starting */
      }
      if (n > 300) throw Error('Vite did not start: ' + a);
      await new Promise((r) => setTimeout(r, 100));
    }
}
async function settle(p: Page) {
  await p.waitForLoadState('networkidle').catch(() => undefined);
  await p.waitForTimeout(900);
  // Never photograph a loading skeleton.
  await p.locator('[aria-label="Loading"]').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined);
}
async function shoot(p: Page, name: string) {
  if (only.length && !only.some((o) => name.startsWith(o))) return;
  await settle(p);
  const file = path.join(out, name + '.png');
  await p.screenshot({ path: file });
  // Palette-quantise (UI screenshots compress ~4x with no visible loss).
  try {
    execFileSync('python3', ['-c', 'import sys;from PIL import Image;i=Image.open(sys.argv[1]).convert("RGB").quantize(256,method=2);i.save(sys.argv[1]+".tmp.png",optimize=True)', file]);
    renameSync(file + '.tmp.png', file);
  } catch {
    /* keep the original PNG */
  }
  taken.push(name);
}

// Demo Sharaco platform account (emulator only), as scripts/grant-platform-role.mjs would set it.
initializeApp({ projectId: 'demo-facilityos' });
const auth = getAuth();
const platformUser = await auth.getUserByEmail('platform@sharaco.test').catch(() =>
  auth.createUser({ email: 'platform@sharaco.test', password: pw, emailVerified: true }),
);
await auth.setCustomUserClaims(platformUser.uid, { platformRole: 'owner' });
const company = 'local-company-a';
await waitUp();
const browser = await chromium.launch({ ...chromiumOptions(), args: ['--no-sandbox'] });
try {
  // ---------------------------------------------------------------- platform
  const pp = await (await browser.newContext({ viewport: { width: 1366, height: 860 } })).newPage();
  pp.on('pageerror', (e) => errors.push('platform: ' + e.message));
  await pp.goto(url('platform'));
  await pp.getByLabel('Email').fill('platform@sharaco.test');
  await pp.getByLabel('Password').fill(pw);
  await pp.getByRole('button', { name: 'Sign in' }).click();
  await pp.waitForTimeout(2500);
  // A demo plan, published and assigned through the console the way an operator would.
  await pp.goto(`${url('platform')}/#/plans`);
  if (!(await pp.getByText(/Starter v1/).count())) {
    await pp.getByRole('button', { name: 'New plan' }).click();
    await pp.getByLabel('Start from example').selectOption({ label: 'Starter' });
    await pp.getByRole('button', { name: 'Publish version' }).click();
    await pp.getByText(/Published Starter v1/).waitFor();
    await promisify(execFile)(process.execPath, ['--import', 'tsx', 'scripts/usage-reconcile.ts', '--project', 'demo-facilityos', '--confirm-project', 'demo-facilityos', '--company', company, '--apply'], { cwd: root, env: process.env });
    await pp.goto(`${url('platform')}/#/companies/${company}`);
    await pp.getByLabel('Plan').selectOption({ label: 'Starter v1' });
    await pp.getByRole('button', { name: 'Assign plan' }).click();
    await pp.getByText('Plan assigned').waitFor();
  }
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  // ---------------------------------------------------------------- admin
  const ap = await ctx.newPage();
  ap.on('pageerror', (e) => errors.push('admin: ' + e.message));
  await ap.goto(url('admin'));
  await ap.getByLabel('Email address').fill('owner@example.test');
  await ap.getByLabel('Password', { exact: true }).fill(pw);
  await ap.getByRole('button', { name: 'Sign in', exact: true }).click();
  await ap.locator('nav').first().waitFor();
  await settle(ap);
  for (const id of [...appRoutes().admin].filter((x) => x !== 'join')) {
    await ap.goto(`${url('admin')}/${id}`);
    await shoot(ap, `admin-${id || 'home'}`);
  }
  // Join page (opened without an invitation; shows the explanation).
  const jp = await (await browser.newContext({ viewport: { width: 1366, height: 860 } })).newPage();
  await jp.goto(`${url('admin')}/join`);
  await shoot(jp, 'join');

  // ---------------------------------------------------------------- staff (phone and desktop)
  const sctx = await browser.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const sp = await sctx.newPage();
  sp.on('pageerror', (e) => errors.push('staff: ' + e.message));
  await sp.goto(url('staff'));
  await shoot(sp, 'staff-sign-in');
  await sp.getByLabel('Email address').fill('tech@example.test');
  await sp.getByLabel('Password', { exact: true }).fill(pw);
  await sp.getByRole('button', { name: 'Sign in', exact: true }).click();
  await sp.waitForTimeout(2500);
  for (const [name, r] of [
    ['staff-my-day', '/'],
    ['staff-tasks', '/tasks'],
    ['staff-calendar', '/calendar'],
    ['staff-work-orders', '/work-orders'],
    ['staff-report', '/report'],
    ['staff-history', '/history'],
    ['staff-notifications', '/notifications'],
    ['staff-profile', '/profile'],
  ]) {
    await sp.goto(`${url('staff')}/#${r}`);
    await shoot(sp, name);
  }

  // ---------------------------------------------------------------- customer
  const cctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const cp = await cctx.newPage();
  cp.on('pageerror', (e) => errors.push('customer: ' + e.message));
  await cp.goto(url('customer'));
  await shoot(cp, 'customer-sign-in');
  await cp.getByLabel('Email').fill('customer1@example.test');
  await cp.getByLabel('Password').fill(pw);
  await cp.getByRole('button', { name: 'Sign in', exact: true }).click();
  await cp.waitForTimeout(2500);
  for (const [name, r] of [
    ['customer-home', '/'],
    ['customer-locations', '/locations'],
    ['customer-requests', '/requests'],
    ['customer-new', '/new'],
    ['customer-history', '/history'],
    ['customer-updates', '/updates'],
    ['customer-profile', '/profile'],
  ]) {
    await cp.goto(`${url('customer')}/#${r}`);
    await shoot(cp, name);
  }

  // ---------------------------------------------------------------- platform (screens)
  for (const [name, r] of [
    ['platform-overview', '/'],
    ['platform-companies', '/companies'],
    ['platform-plans', '/plans'],
    ['platform-subscriptions', '/subscriptions'],
    ['platform-billing', '/billing'],
    ['platform-audit', '/audit'],
    ['platform-health', '/health'],
    ['platform-settings', '/settings'],
  ]) {
    await pp.goto(`${url('platform')}/#${r}`);
    await shoot(pp, name);
  }
  await pp.goto(`${url('platform')}/#/companies/${company}`);
  await shoot(pp, 'platform-company');
} finally {
  await browser.close();
  for (const s of servers) s.kill();
}
console.log(`Captured ${taken.length} screenshots into ${path.relative(root, out)}.`);
if (errors.length) console.warn('Page errors:\n' + [...new Set(errors)].join('\n'));
