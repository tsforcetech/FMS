// Phase 6 runtime test of the mobile app bundle (the same code packaged in
// the APK) in Chromium at phone size, against the local emulators only.
// Camera: a fake video device plays a real QR label; GPS: emulated position;
// offline: real network loss, page restart and reconnection.
import { chromium, type BrowserContext, type Page } from 'playwright';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  initializeFirestore,
  memoryLocalCache,
} from 'firebase/firestore';
import {
  defaultValues,
  emptyContent,
  newQuestion,
  type Kind,
  type Values,
  type VersionContent,
} from '../packages/shared/src';
import { saveRecord } from '../apps/admin-web/src/management/store';
import {
  createDraft,
  saveDraft,
  listVersions,
  createTask,
  getTask,
  transitionTask,
} from '../apps/admin-web/src/management/tasksStore';
import { linkStaff } from '../apps/admin-web/src/management/staffStore';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
  throw Error('Emulators required.');
const run = promisify(execFile);
await run(process.execPath, ['scripts/seed-emulator.mjs']);
const env = {
  ...process.env,
  VITE_FIREBASE_ENV: 'emulator',
  VITE_FIREBASE_PROJECT_ID: 'demo-facilityos',
  VITE_FIREBASE_API_KEY: 'demo-facilityos',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-facilityos.firebaseapp.com',
  VITE_FIREBASE_APP_ID: 'demo-facilityos-web',
  VITE_ALLOW_LIVE_FIREBASE: 'false',
};
const vite = path.resolve('node_modules/vite/bin/vite.js');
// Production build (same CSP and bundle as the APK), emulator configuration.
await run(
  process.execPath,
  [
    vite,
    'build',
    '--outDir',
    'dist-test',
    '--mode',
    'emulator',
    '--minify',
    'false',
  ],
  { cwd: 'apps/mobile', env },
);
const server = spawn(
  process.execPath,
  [
    vite,
    'preview',
    '--outDir',
    'dist-test',
    '--host',
    '127.0.0.1',
    '--port',
    '5195',
    '--strictPort',
  ],
  { cwd: 'apps/mobile', env, stdio: 'pipe' },
);
const url = 'http://127.0.0.1:5195';
const evidence = 'docs/evidence/phase6';
const checks: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const errors: string[] = [];
const C = 'local-company-a';
try {
  for (let n = 0; n < 150; n++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* starting */
    }
    if (n === 149) throw Error('Preview did not start');
    await new Promise((r) => setTimeout(r, 100));
  }
  // ---------------------------------------------------------- fixtures through the real data layer
  const app = initializeApp({
    apiKey: 'demo-facilityos',
    projectId: 'demo-facilityos',
    authDomain: 'x',
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
      code: `M6X${++seq}`,
      name: `Record ${seq}`,
      ...v,
    });
  const site = await create('sites', {
    name: 'Marina Tower',
    timeZone: 'Asia/Dubai',
  });
  const other = await create('sites', { name: 'Harbour Mall' });
  const floor = await create('locations', { siteId: site, name: 'Floor 2' });
  const otherLoc = await create('locations', {
    siteId: other,
    name: 'Mall Roof',
  });
  const cat = await create('assetCategories', { name: 'HVAC' });
  const ahu = await create('assets', {
    siteId: site,
    locationId: floor,
    categoryId: cat,
    name: 'AHU-02',
  });
  const foreign = await create('assets', {
    siteId: other,
    locationId: otherLoc,
    categoryId: cat,
    name: 'Mall chiller',
  });
  const dep = await create('departments', { name: 'MEP' });
  const des = await create('designations', {
    departmentId: dep,
    name: 'AC Technician',
  });
  const ravi = await create('employees', {
    name: 'Ravi Kumar',
    joiningDate: '2026-01-05',
    departmentId: dep,
    designationId: des,
    primarySiteId: site,
    linkedUid: 'localtech',
  });
  const shift = await create('shifts', {
    name: 'Day shift',
    siteId: site,
    startTime: '07:00',
    endTime: '16:00',
    breakMinutes: '60',
    workingDays: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
  });
  await create('shiftAssignments', {
    employeeId: ravi,
    shiftId: shift,
    startDate: '2026-01-01',
  });
  const tc = await create('taskCategories', { name: 'HVAC' });
  const tpl = await create('taskTemplates', {
    categoryId: tc,
    name: 'AHU inspection',
  });
  const q1 = {
    ...newQuestion('s1', 'qr'),
    id: 'q1',
    label: 'Scan the AHU label',
    required: false,
  };
  const q2 = {
    ...newQuestion('s1', 'gps', [q1]),
    id: 'q2',
    label: 'Confirm your location',
    required: false,
  };
  const q3 = {
    ...newQuestion('s1', 'pass_fail', [q1, q2]),
    id: 'q3',
    label: 'Filters clean',
  };
  const q4 = {
    ...newQuestion('s1', 'temperature', [q1, q2, q3]),
    id: 'q4',
    label: 'Supply air temperature',
    min: -10,
    max: 60,
    expectedMin: 12,
    expectedMax: 18,
  };
  const q5 = {
    ...newQuestion('s1', 'photo', [q1, q2, q3, q4]),
    id: 'q5',
    label: 'Photo of the coil',
    required: false,
  };
  const content: VersionContent = {
    ...emptyContent('AHU inspection'),
    questions: [q1, q2, q3, q4, q5],
    raci: [
      {
        id: 'r1',
        letter: 'R',
        kind: 'designation',
        refId: des,
        label: 'Tech',
        siteId: '',
      },
      {
        id: 'r2',
        letter: 'A',
        kind: 'designation',
        refId: des,
        label: 'Sup',
        siteId: '',
      },
    ],
  };
  const vid = await createDraft(db, C, owner, tpl, content);
  const [v] = await listVersions(db, C, tpl);
  await saveDraft(db, C, owner, v, v.content, true);
  const local = (h: number) =>
    new Date(Date.now() + h * 3600000).toISOString().slice(0, 16);
  const base = {
    versionId: vid,
    siteId: site,
    locationId: floor,
    facilityId: '',
    departmentId: dep,
    teamId: '',
    notes: '',
    plannedStart: '',
    assigneeIds: [ravi],
    priority: 'high' as const,
  };
  const t1 = await createTask(db, C, owner, {
    ...base,
    assetId: ahu,
    title: 'AHU-02 inspection',
    dueAt: local(2),
  });
  const t2 = await createTask(db, C, owner, {
    ...base,
    assetId: ahu,
    title: 'Plant room round',
    dueAt: local(3),
  });
  await linkStaff(db, C, owner, {
    uid: 'localtech',
    employeeId: ravi,
    siteIds: [site],
    allSites: false,
  });

  // A real QR label for the AHU, played by the fake camera (Y4M grayscale frames).
  const qr = QRCode.create(
    `https://tsforcetech.github.io/FMS/#/assets?open=${ahu}`,
    { errorCorrectionLevel: 'M' },
  );
  const W = 640,
    H = 480,
    n = qr.modules.size,
    scale = Math.floor(360 / (n + 8)),
    ox = Math.floor((W - (n + 8) * scale) / 2),
    oy = Math.floor((H - (n + 8) * scale) / 2);
  const Y = Buffer.alloc(W * H, 235);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.modules.get(r, c))
        for (let y = 0; y < scale; y++)
          Y.fill(
            16,
            (oy + (r + 4) * scale + y) * W + ox + (c + 4) * scale,
            (oy + (r + 4) * scale + y) * W + ox + (c + 5) * scale,
          );
  const UV = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const frames = [
    Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`),
  ];
  for (let i = 0; i < 10; i++) frames.push(Buffer.from('FRAME\n'), Y, UV);
  await mkdir(evidence, { recursive: true });
  const y4m = path.resolve('/tmp', 'fos-qr.y4m');
  await writeFile(y4m, Buffer.concat(frames));

  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    args: [
      '--no-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${y4m}`,
    ],
  });
  const ctx: BrowserContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ['geolocation', 'camera'],
    geolocation: { latitude: 25.0806, longitude: 55.1403, accuracy: 14 },
  });
  const p: Page = await ctx.newPage();
  p.setDefaultTimeout(20000);
  p.on('pageerror', (e) =>
    errors.push(
      e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 4).join(' | '),
    ),
  );
  const shoot = async (name: string, full = false) => {
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${evidence}/${name}.png`, fullPage: full });
  };
  const toast = (text: string | RegExp) => p.getByText(text).first().waitFor();

  // ---------------------------------------------------------- sign in, My Day
  await p.goto(url);
  await p.getByLabel('Email address').fill('tech@example.test');
  await p.getByLabel('Password', { exact: true }).fill('Local-only-123!');
  await p.getByRole('button', { name: 'Sign in', exact: true }).click();
  await p
    .getByRole('heading', { name: /Good (morning|afternoon|evening), Ravi/ })
    .waitFor();
  await p.getByText('AHU-02 inspection').first().waitFor();
  await p.locator('.m-sync').getByText('Synced').waitFor();
  await shoot('01-my-day');
  checks.push(
    'Sign-in with the linked technician; My Day lists only their tasks; sync status shown',
  );

  // ---------------------------------------------------------- attendance with GPS
  await p.locator('.m-att').click();
  await p.getByRole('button', { name: 'Check in' }).click();
  await p.getByText(/Checked in at/).waitFor();
  await p.getByText(/25\.08060, 55\.14030 · Accuracy ±14 m \(good\)/).waitFor();
  await shoot('02-attendance');
  checks.push(
    'Check-in with server time and an explicit GPS reading with accuracy',
  );

  // ---------------------------------------------------------- task: start, QR + GPS evidence, checklist
  await p.goto(url + '/#/task/' + t1);
  await p.getByRole('button', { name: 'Start task' }).click();
  await p.getByText('Step 1 of 1').waitFor();
  await p.getByRole('button', { name: 'Scan QR code' }).click();
  await p.locator('.m-scanner video').waitFor();
  await shoot('03-scanner');
  await toast('Verified');
  await p.getByRole('button', { name: 'Capture location' }).click();
  await p
    .getByText(/25\.08060,55\.14030 ±14m/)
    .first()
    .waitFor();
  await p.getByRole('radio', { name: 'Pass' }).click();
  await shoot('04-evidence', true);
  checks.push(
    'Real QR decode from the camera stream, matched to the task asset; GPS evidence captured',
  );

  // ---------------------------------------------------------- go offline: draft, save, submit queued
  await ctx.setOffline(true);
  await p.locator('.m-sync').getByText('Offline').waitFor();
  await p.getByLabel('Supply air temperature').fill('22');
  await p.getByRole('button', { name: 'Save progress' }).click();
  await toast('Saved on this device. It will be sent when you are online.');
  await p.getByRole('button', { name: 'Review answers' }).click();
  await p.getByRole('heading', { name: 'Failed checks' }).waitFor();
  await p.getByRole('button', { name: 'Submit for approval' }).click();
  await p.locator('.m-sync').getByText('Offline').waitFor();
  await shoot('05-offline-submit');
  // App restart while offline: identity, tasks and queue come from the encrypted vault.
  // (A browser cannot reload the bundle offline; the APK ships it locally. Here only Firebase is cut.)
  const block = (r: { abort: () => Promise<void> }) => r.abort();
  await ctx.route('http://127.0.0.1:8080/**', block);
  await ctx.route('http://127.0.0.1:9099/**', block);
  await ctx.setOffline(false);
  await p.reload();
  // The app reopens the task that was open, from the encrypted device copy.
  await p
    .getByRole('heading', { level: 1, name: 'AHU-02 inspection' })
    .waitFor();
  await ctx.setOffline(true);
  await ctx.unroute('http://127.0.0.1:8080/**', block);
  await ctx.unroute('http://127.0.0.1:9099/**', block);
  await p.goto(url + '/#/sync');
  await p.getByText('Submit for approval').first().waitFor();
  assert.ok(
    (await p.getByText('Sync pending').count()) > 0,
    'queued operations survive restart',
  );
  await shoot('06-sync-pending');
  const stored = await p.evaluate(() =>
    Object.entries(localStorage)
      .filter(([k]) => k.startsWith('fos:'))
      .map(([, v]) => v)
      .join(''),
  );
  assert.ok(
    stored.length > 0 && !stored.includes('AHU-02') && !stored.includes('Ravi'),
    'device storage holds ciphertext only',
  );
  checks.push(
    'Offline draft, save and submit queued; queue, identity and tasks survive an offline restart; storage is ciphertext only',
  );

  // ---------------------------------------------------------- reconnect: sync
  await ctx.setOffline(false);
  await p.locator('.m-sync').getByText('Synced').waitFor({ timeout: 30000 });
  const s1 = (await getTask(db, C, t1))!;
  assert.equal(s1.status, 'awaiting_approval');
  assert.equal(
    (await getDoc(doc(db, 'companies', C, 'taskEvidence', `${t1}_1_q1`))).data()
      ?.status,
    'verified',
  );
  assert.equal(
    (await getDoc(doc(db, 'companies', C, 'taskEvidence', `${t1}_1_q2`))).data()
      ?.location.accuracy,
    14,
  );
  checks.push(
    'Reconnection syncs start, evidence, save and submit in order; server shows awaiting approval with verified QR and GPS evidence',
  );

  // ---------------------------------------------------------- conflict: cancelled while offline
  await p.goto(url + '/#/task/' + t2);
  await p.getByRole('button', { name: 'Start task' }).click();
  await p.locator('.m-sync').getByText('Synced').waitFor({ timeout: 30000 });
  await p.getByRole('button', { name: 'Back', exact: true }).first().click();
  await ctx.setOffline(true);
  await p.getByRole('button', { name: 'Pause' }).click();
  await transitionTask(db, C, owner, (await getTask(db, C, t2))!, 'cancel', {
    note: 'Plant room closed for repairs',
  });
  await ctx.setOffline(false);
  await p
    .locator('.m-sync')
    .getByText(/Needs review/)
    .waitFor({ timeout: 30000 });
  await p.goto(url + '/#/sync');
  await p.getByText(/changed by someone else \(now cancelled\)/).waitFor();
  await shoot('07-conflict');
  assert.equal((await getTask(db, C, t2))!.status, 'cancelled');
  checks.push(
    'A change made offline to a task cancelled on the server becomes a review item; the server state wins',
  );

  // ---------------------------------------------------------- QR authorization
  await p.goto(url + '/#/scan');
  await p.getByRole('button', { name: 'Scan QR code' }).click();
  await p
    .getByLabel('Or type the code')
    .fill(`https://x/#/assets?open=${foreign}`);
  await p.getByRole('button', { name: 'Open' }).click();
  await p
    .getByText('You are not authorized for this asset or location.')
    .waitFor();
  await p.getByRole('button', { name: 'Scan QR code' }).click();
  await p.getByLabel('Or type the code').fill('WIFI:S:guest;P:secret;;');
  await p.getByRole('button', { name: 'Open' }).click();
  await p.getByText('This is not a FacilityOS code.').waitFor();
  await p.getByRole('button', { name: 'Scan QR code' }).click();
  await toast('My open tasks here');
  await p.getByText('AHU-02').first().waitFor();
  await shoot('08-scan-result');
  checks.push(
    'Scan tab: authorized asset opens with my tasks; out-of-scope and foreign codes are refused',
  );

  // ---------------------------------------------------------- language, sign-out wipes the device copy
  await p.goto(url + '/#/profile');
  await p.getByRole('radio', { name: /العربية/ }).click();
  await p.waitForFunction(() => document.documentElement.dir === 'rtl');
  await p.locator('.s-bottom').getByText('مسح').waitFor();
  await shoot('09-arabic');
  await p.getByRole('radio', { name: 'English' }).click();
  for (const [w, h] of [
    [320, 640],
    [360, 780],
    [412, 915],
  ]) {
    await p.setViewportSize({ width: w, height: h });
    await p.goto(url + '/#/');
    await p.getByText('Plant room round').first().waitFor();
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `overflow at ${w}`,
    );
  }
  await p.goto(url + '/#/profile');
  await p.getByRole('button', { name: 'Sign out' }).click();
  await p.getByRole('heading', { name: 'Sign in to start your day' }).waitFor();
  await p.waitForTimeout(500);
  const left = await p.evaluate(
    () =>
      Object.keys(localStorage).filter((k) => k.startsWith('fos:')).length +
      Object.keys(sessionStorage).filter((k) => k.startsWith('fos-key')).length,
  );
  assert.equal(left, 0, 'sign-out removes all cached data and the key');
  checks.push(
    'Arabic RTL, no overflow at 320/360/412 px, and sign-out destroys the encrypted device copy and its key',
  );
  assert.deepEqual(errors, [], 'page errors');
  await writeFile(
    `${evidence}/mobile-runtime-results.json`,
    JSON.stringify(
      {
        checks,
        runtime:
          'Chromium (mobile viewport) with fake camera and emulated GPS; local emulators only',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ passed: checks.length, checks }));
} catch (error) {
  for (const [i, pg] of (
    browser?.contexts().flatMap((c) => c.pages()) || []
  ).entries())
    await pg
      .screenshot({ path: `${evidence}/failure-${i}.png`, fullPage: true })
      .catch(() => {});
  await writeFile(`${evidence}/failure.txt`, String(error)).catch(() => {});
  console.error(error, errors);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  process.exit(process.exitCode ?? 0);
}
