// Phase 7 end-to-end test: admin reports/administration screens and the
// customer portal, against the local emulators only.
// Run with: firebase emulators:exec ... "npx tsx scripts/phase7-browser-test.ts"
import { chromium, type Page } from 'playwright';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
} from 'firebase/firestore';
import { defaultValues, type Kind, type Values } from '../packages/shared/src';
import { saveRecord } from '../apps/admin-web/src/management/store';
import {
  getCase,
  transitionCase,
} from '../apps/admin-web/src/management/casesStore';
import {
  listServiceRequests,
  saveCustomerLink,
} from '../apps/admin-web/src/management/customerStore';

if (
  process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
)
  throw Error('Both loopback emulators are required.');
await promisify(execFile)(process.execPath, ['scripts/seed-emulator.mjs']);
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
  VITE_CUSTOMER_BASE_PATH: '/',
};
const serve = (cwd: string, port: string) =>
  spawn(
    process.execPath,
    [
      path.resolve('node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      port,
      '--strictPort',
    ],
    { cwd, stdio: 'pipe', env },
  );
const adminSrv = serve('apps/admin-web', '5195');
const custSrv = serve('apps/customer-web', '5196');
const adminUrl = 'http://127.0.0.1:5195',
  custUrl = 'http://127.0.0.1:5196';
const evidence = 'docs/evidence/phase7';
const checks: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const C = 'local-company-a';
const year = new Date().getFullYear();
try {
  for (const url of [adminUrl, custUrl])
    for (let n = 0; n < 150; n++) {
      try {
        if ((await fetch(url)).ok) break;
      } catch {
        /* starting */
      }
      if (n === 149) throw Error('Vite did not start: ' + url);
      await new Promise((r) => setTimeout(r, 100));
    }
  // ------------------------------------------------ fixtures through the real data layer (owner)
  const app = initializeApp({
    apiKey: 'demo-facilityos',
    projectId: 'demo-facilityos',
    authDomain: 'demo-facilityos.firebaseapp.com',
    appId: 'x',
  });
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  await signInWithEmailAndPassword(
    auth,
    'owner@example.test',
    'Local-only-123!',
  );
  const owner = auth.currentUser!.uid;
  let seq = 0;
  const create = (kind: Kind, v: Values = {}) =>
    saveRecord(db, C, owner, kind, {
      ...defaultValues(kind),
      code: `P7B${++seq}`,
      name: `Record ${seq}`,
      ...v,
    });
  const site = await create('sites', {
    name: 'Muteena Business Centre',
    timeZone: 'Asia/Dubai',
  });
  const o201 = await create('locations', { siteId: site, name: 'Office 201' });
  const o202 = await create('locations', { siteId: site, name: 'Office 202' });
  const alpha = await create('clients', { name: 'Alpha Trading LLC' });
  const beta = await create('clients', { name: 'Beta Consulting' });
  const contract = (clientId: string) =>
    create('contracts', {
      clientId,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });
  const kA = await contract(alpha),
    kB = await contract(beta);
  const alloc = (contractId: string, locationId: string) =>
    create('contractAllocations', {
      contractId,
      siteId: site,
      locationId,
      allocationType: 'exclusive_occupancy',
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });
  const o203 = await create('locations', { siteId: site, name: 'Office 203' });
  await alloc(kA, o201);
  await alloc(kA, o202); // Alpha also rents 202, but the login is scoped to 201
  await alloc(kB, o203); // Beta is another tenant in the same building
  await saveCustomerLink(db, C, owner, {
    uid: 'localcust2',
    clientId: beta,
    contactName: 'Beta Office',
    allocationIds: [],
  });

  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    args: ['--no-sandbox'],
  });
  await mkdir(evidence, { recursive: true });
  const errors: string[] = [];
  const shoot = async (p: Page, name: string, full = false) => {
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${evidence}/${name}.png`, fullPage: full });
  };
  const noOverflow = async (p: Page, label: string) => {
    const wide = await p.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth
        ? 0
        : document.documentElement.scrollWidth,
    );
    assert.equal(wide, 0, `${label} has horizontal overflow`);
  };

  // ------------------------------------------------ admin links the customer login, scoped to Office 201
  const ap = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  ap.setDefaultTimeout(15000);
  ap.on('pageerror', (e) => errors.push('admin: ' + e.message));
  await ap.goto(adminUrl);
  await ap.getByLabel('Email address').fill('owner@example.test');
  await ap.getByLabel('Password', { exact: true }).fill('Local-only-123!');
  await ap.getByRole('button', { name: 'Sign in', exact: true }).click();
  await ap.getByText(/Good (morning|afternoon|evening)/).waitFor();
  await ap.goto(adminUrl + '/customer-access');
  await ap.getByRole('button', { name: 'Link a customer login' }).click();
  const dlg = ap.getByRole('dialog');
  await dlg.getByLabel('Customer login').selectOption('localcust1');
  await dlg.getByLabel(/^Client/).click();
  await ap
    .locator('.picker-panel [role=option]', { hasText: 'Alpha Trading LLC' })
    .first()
    .click();
  await dlg.getByLabel('Contact name').fill('Alpha front desk');
  await dlg.getByRole('checkbox', { name: /Office 201/ }).check();
  await shoot(ap, '01-admin-link-customer');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await ap.getByRole('cell', { name: 'Alpha Trading LLC' }).waitFor();
  checks.push(
    'Admin links a provisioned customer login to one client, restricted to Office 201',
  );

  // ------------------------------------------------ customer portal
  const cp = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  cp.setDefaultTimeout(15000);
  cp.on('pageerror', (e) => {
    errors.push('customer: ' + e.message);
    console.error('customer pageerror', e.message);
  });
  const login = async (p: Page, email: string) => {
    await p.goto(custUrl);
    await p.getByLabel('Email').fill(email);
    await p.getByLabel('Password').fill('Local-only-123!');
    await p.getByRole('button', { name: 'Sign in', exact: true }).click();
  };
  // Staff cannot use the customer portal.
  await login(cp, 'tech@example.test');
  await cp
    .getByRole('heading', { name: 'This is not a customer account' })
    .waitFor();
  await cp.getByRole('button', { name: /Sign out/ }).click();
  checks.push('Staff logins are refused by the customer portal');

  await login(cp, 'customer1@example.test');
  await cp.getByRole('heading', { name: 'Alpha Trading LLC' }).waitFor();
  await shoot(cp, '02-customer-overview');
  await cp.goto(custUrl + '/#/locations');
  await cp.getByText('Office 201 · Muteena Business Centre').waitFor();
  assert.equal(await cp.getByText(/Office 202/).count(), 0);
  checks.push('Customer sees only the allocated Office 201, never Office 202');

  await cp.goto(custUrl + '/#/new');
  await cp.getByLabel('What is it about?').selectOption('Air conditioning');
  await cp.getByLabel('How urgent?').selectOption('high');
  await cp
    .getByLabel('Describe the problem')
    .fill('AC is leaking water near the window desk');
  await shoot(cp, '03-customer-new-request');
  await cp.getByRole('button', { name: 'Submit request' }).click();
  await cp.getByText('Request submitted').first().waitFor();
  const reqUrl = cp.url();
  checks.push('Customer raises a service request for their active location');

  // Another tenant of the same building cannot open it.
  const cp2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  cp2.on('pageerror', (e) => errors.push('customer2: ' + e.message));
  await login(cp2, 'customer2@example.test');
  await cp2.getByRole('heading', { name: 'Beta Consulting' }).waitFor();
  await cp2.goto(custUrl + '/#/requests/' + reqUrl.split('/').pop());
  await cp2.getByText('This request is not available.').waitFor();
  await cp2.goto(custUrl + '/#/requests');
  await cp2.getByText('Nothing here.').waitFor();
  checks.push(
    'A different tenant in the same building cannot open or list the request',
  );

  // ------------------------------------------------ admin intake → complaint workflow
  await ap.goto(adminUrl + '/service-requests');
  await ap.getByRole('button', { name: 'Take in' }).click();
  await ap.getByText('Complaint created from request').waitFor();
  await shoot(ap, '04-admin-service-requests');
  const [req] = await listServiceRequests(db, C);
  let cmp = (await getCase(db, C, 'complaints', req.complaintId))!;
  const dep = await create('departments', { name: 'MEP' });
  const des = await create('designations', { departmentId: dep });
  const joseph = await create('employees', {
    name: 'Joseph Mathew',
    joiningDate: '2026-01-05',
    departmentId: dep,
    designationId: des,
    primarySiteId: site,
  });
  await transitionCase(db, C, owner, cmp, 'assign', {
    assigneeIds: [joseph],
    note: 'INTERNAL: tenant complains often; vendor quote 900 AED',
  });
  cmp = (await getCase(db, C, 'complaints', req.complaintId))!;
  await transitionCase(db, C, owner, cmp, 'resolve', {
    note: 'Condensate drain cleared and tested.',
  });
  checks.push(
    'Admin takes the request into the complaint workflow (assigned, resolved)',
  );

  await cp.goto(reqUrl);
  await cp.reload();
  await cp.getByText('Condensate drain cleared and tested.').waitFor();
  const body = await cp.locator('body').innerText();
  assert.doesNotMatch(body, /INTERNAL|900 AED|Joseph/);
  await shoot(cp, '05-customer-resolved', true);
  await cp.getByRole('button', { name: 'Yes, confirm' }).click();
  await cp.getByText(/You confirmed the resolution/).waitFor();
  checks.push(
    'Customer sees progress and the resolution, never internal notes, staff names or costs, and confirms',
  );

  await cp.goto(custUrl + '/#/updates');
  await cp.getByText('Resolved').first().waitFor();
  for (const w of [320, 390, 768, 1024]) {
    await cp.setViewportSize({ width: w, height: 800 });
    for (const route of ['/', '/requests', '/locations', '/new', '/profile']) {
      await cp.goto(custUrl + '/#' + route);
      await cp.waitForTimeout(250);
      await noOverflow(cp, `customer ${route} @${w}`);
    }
  }
  checks.push('Customer portal has no horizontal overflow at 320–1024 px');

  // ------------------------------------------------ admin report & administration screens
  const screens: [string, RegExp | string][] = [
    ['/management', 'Operations at a glance'],
    ['/report-tasks', 'Task performance'],
    ['/report-staff', 'Staff productivity'],
    ['/report-sites', 'Site performance'],
    ['/report-maintenance', 'Recorded costs'],
    ['/report-assets', 'By asset'],
    ['/report-inventory', 'Stock reconciliation'],
    ['/report-attendance', 'By employee'],
    ['/report-sla', 'By record type'],
    ['/compliance', 'Verified means evidenced'],
    ['/operations', 'Health checks'],
    ['/audit', 'How this history is protected'],
    ['/retention', 'Policy only'],
    ['/backup', 'There is no automatic backup today'],
  ];
  for (const [route, text] of screens) {
    await ap.goto(adminUrl + route);
    await ap.getByText(text).first().waitFor();
    await ap
      .locator('[role=status][aria-label=Loading]')
      .first()
      .waitFor({ state: 'detached' })
      .catch(() => undefined);
    const red = await ap.locator('.banner.tone-red').allInnerTexts();
    if (route !== '/backup')
      assert.deepEqual(red, [], `${route} shows an error: ${red.join(' | ')}`);
  }
  await ap.goto(adminUrl + '/report-sla');
  await ap.getByText('By record type').waitFor();
  await shoot(ap, '06-admin-sla-report', true);
  await ap.goto(adminUrl + '/management');
  await ap.getByText('Operations at a glance').waitFor();
  await ap.waitForTimeout(600);
  await shoot(ap, '07-admin-management-dashboard', true);
  checks.push(
    'All report, monitoring, audit, retention and backup screens load without errors',
  );

  // Record a maintenance cost through the UI.
  await ap.goto(adminUrl + '/report-maintenance');
  await ap.getByRole('button', { name: 'Record cost' }).click();
  const cd = ap.getByRole('dialog');
  await cd.getByLabel(/^Site/).click();
  await ap
    .locator('.picker-panel [role=option]', {
      hasText: 'Muteena Business Centre',
    })
    .first()
    .click();
  await cd.getByLabel('Amount').fill('450');
  await cd.getByLabel('Description').fill('AC drain service');
  await cd.getByRole('button', { name: 'Save cost' }).click();
  await ap.getByRole('cell', { name: 'AC drain service' }).waitFor();
  checks.push('Admin records an append-only maintenance cost');

  assert.deepEqual(errors, [], 'Unexpected browser exceptions');
  await writeFile(
    `${evidence}/phase7-browser-results.json`,
    JSON.stringify(
      { checks, environment: 'local demo emulators only' },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ passed: checks.length, checks }));
} catch (error) {
  if (browser) {
    await mkdir(evidence, { recursive: true });
    const pages = browser.contexts().flatMap((c) => c.pages());
    for (const [i, p] of pages.entries())
      await p
        .screenshot({ path: `${evidence}/failure-${i}.png`, fullPage: true })
        .catch(() => {});
    await writeFile(`${evidence}/failure.txt`, String(error));
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  adminSrv.kill('SIGTERM');
  custSrv.kill('SIGTERM');
  process.exit(process.exitCode ?? 0);
}
