// Phase 5 end-to-end test of the staff portal against the local emulators only.
// Run with: firebase emulators:exec ... "npx tsx scripts/staff-browser-test.ts"
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
  reviewTask,
} from '../apps/admin-web/src/management/tasksStore';
import {
  createCase,
  emptyCase,
  getCase,
  transitionCase,
} from '../apps/admin-web/src/management/casesStore';

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
  VITE_STAFF_BASE_PATH: '/',
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
const admin = serve('apps/admin-web', '5193');
const staffSrv = serve('apps/staff-web', '5194');
const adminUrl = 'http://127.0.0.1:5193',
  staffUrl = 'http://127.0.0.1:5194';
const evidence = 'docs/evidence/phase5';
const checks: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let page: Page | undefined;
const C = 'local-company-a';
try {
  for (const url of [adminUrl, staffUrl])
    for (let n = 0; n < 150; n++) {
      try {
        if ((await fetch(url)).ok) break;
      } catch {
        /* starting */
      }
      if (n === 149) throw Error('Vite did not start: ' + url);
      await new Promise((r) => setTimeout(r, 100));
    }
  // ---------------------------------------------------------- fixtures through the real data layer (owner session)
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
      code: `S5X${++seq}`,
      name: `Record ${seq}`,
      ...v,
    });
  const site = await create('sites', {
    name: 'Marina Tower',
    timeZone: 'Asia/Dubai',
  });
  const otherSite = await create('sites', { name: 'Harbour Mall' });
  const floor = await create('locations', { siteId: site, name: 'Floor 2' });
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
  const other = await create('employees', {
    name: 'Other Person',
    joiningDate: '2026-01-05',
    departmentId: dep,
    designationId: des,
    primarySiteId: site,
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
  const cat = await create('taskCategories', { name: 'HVAC' });
  const tpl = await create('taskTemplates', {
    categoryId: cat,
    name: 'AC inspection',
  });
  const c0 = emptyContent('AC inspection');
  const q1 = {
    ...newQuestion('s1', 'pass_fail'),
    id: 'q1',
    label: 'AC cooling normally',
  };
  const q2 = {
    ...newQuestion('s1', 'temperature', [q1]),
    id: 'q2',
    label: 'Supply air temperature',
    min: -10,
    max: 60,
    expectedMin: 12,
    expectedMax: 18,
  };
  const q3 = {
    ...newQuestion('s1', 'text', [q1, q2]),
    id: 'q3',
    label: 'Describe the fault',
    showIf: { questionId: 'q1', equals: 'fail' },
  };
  const q4 = {
    ...newQuestion('s2', 'yes_no', [q1, q2, q3]),
    id: 'q4',
    label: 'Area left clean and safe',
  };
  const content: VersionContent = {
    ...c0,
    instructions: 'Isolate power before opening panels.',
    estimatedMinutes: 25,
    sections: [
      { id: 's1', title: 'Cooling' },
      { id: 's2', title: 'Safety' },
    ],
    questions: [q1, q2, q3, q4],
    raci: [
      {
        id: 'r1',
        letter: 'R',
        kind: 'designation',
        refId: des,
        label: 'AC Technician',
        siteId: '',
      },
      {
        id: 'r2',
        letter: 'A',
        kind: 'designation',
        refId: des,
        label: 'Supervisor',
        siteId: '',
      },
    ],
  };
  const vid = await createDraft(db, C, owner, tpl, content);
  const [v] = await listVersions(db, C, tpl);
  await saveDraft(db, C, owner, v, v.content, true);
  const local = (h: number) =>
    new Date(Date.now() + h * 3600000).toISOString().slice(0, 16);
  // Due times must stay on today's date in the company time zone (Asia/Dubai,
  // UTC+4) whatever time the suite runs: clamp "later today" and "earlier today".
  const dubaiNow = new Date(Date.now() + 4 * 3600000);
  const sinceMidnight = dubaiNow.getUTCHours() + dubaiNow.getUTCMinutes() / 60;
  const later = (h: number) =>
    Math.max(0.05, Math.min(h, 23.9 - sinceMidnight));
  const earlier = (h: number) =>
    -Math.max(0.05, Math.min(h, sinceMidnight - 0.1));
  const base = {
    versionId: vid,
    siteId: site,
    locationId: floor,
    facilityId: '',
    assetId: '',
    departmentId: dep,
    teamId: '',
    notes: '',
    plannedStart: '',
  };
  const t1 = await createTask(db, C, owner, {
    ...base,
    title: 'AC Inspection – Floor 2',
    assigneeIds: [ravi],
    priority: 'medium',
    dueAt: local(later(3)),
  });
  const t2 = await createTask(db, C, owner, {
    ...base,
    title: 'Plant room check',
    assigneeIds: [ravi],
    priority: 'high',
    dueAt: local(earlier(2)),
  });
  await createTask(db, C, owner, {
    ...base,
    title: 'Someone else’s task',
    assigneeIds: [other],
    priority: 'medium',
    dueAt: local(later(2)),
  });
  const wo = await createCase(db, C, owner, 'workOrders', {
    ...emptyCase('workOrders'),
    title: 'Replace corridor light',
    siteId: site,
    locationId: floor,
    priority: 'high',
  });
  await transitionCase(
    db,
    C,
    owner,
    (await getCase(db, C, 'workOrders', wo.id))!,
    'assign',
    { assigneeIds: [ravi] },
  );
  void otherSite;

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

  // ---------------------------------------------------------- admin links the login to the employee
  const ap = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  ap.setDefaultTimeout(15000);
  ap.on('pageerror', (e) => errors.push('admin: ' + e.message));
  await ap.goto(adminUrl);
  await ap.getByLabel('Email address').fill('owner@example.test');
  await ap.getByLabel('Password', { exact: true }).fill('Local-only-123!');
  await ap.getByRole('button', { name: 'Sign in', exact: true }).click();
  await ap.getByText(/Good (morning|afternoon|evening)/).waitFor();
  await ap.goto(adminUrl + '/staff-access');
  await ap.getByRole('button', { name: 'Link a login' }).click();
  await ap
    .getByLabel('Login (company member)')
    .selectOption({ label: 'localtech · Technician' });
  await ap
    .getByRole('dialog')
    .getByLabel(/^Employee/)
    .click();
  await ap
    .locator('.picker-panel [role=option]', { hasText: 'Ravi Kumar' })
    .first()
    .click();
  await ap
    .getByRole('dialog')
    .getByLabel(/^Add site/)
    .click();
  await ap
    .locator('.picker-panel [role=option]', { hasText: 'Marina Tower' })
    .first()
    .click();
  await shoot(ap, '01-admin-link-login');
  await ap.getByRole('button', { name: 'Link login' }).click();
  await ap.getByText('Login linked to the employee.').waitFor();
  await ap.getByRole('cell', { name: 'Ravi Kumar' }).waitFor();
  checks.push(
    'Admin links a provisioned technician login to one employee and site through Staff access',
  );

  // ---------------------------------------------------------- unlinked staff are denied
  const sp = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  sp.setDefaultTimeout(15000);
  sp.on('pageerror', (e) => errors.push('staff: ' + e.message));
  const login = async (email: string) => {
    await sp.goto(staffUrl);
    await sp.getByLabel('Email address').fill(email);
    await sp.getByLabel('Password', { exact: true }).fill('Local-only-123!');
    await sp.getByRole('button', { name: 'Sign in', exact: true }).click();
  };
  await sp.goto(staffUrl);
  await sp
    .getByRole('heading', { name: 'Sign in to start your day' })
    .waitFor();
  await shoot(sp, '02-staff-login');
  await login('staff@example.test');
  await sp
    .getByRole('heading', {
      name: 'Your login is not linked to an employee yet',
    })
    .waitFor();
  await shoot(sp, '03-not-linked');
  await sp.getByRole('button', { name: 'Sign out' }).click();
  checks.push('Login without a linked employee is refused with guidance');

  // ---------------------------------------------------------- my day
  await login('tech@example.test');
  await sp
    .getByRole('heading', { name: /Good (morning|afternoon|evening), Ravi/ })
    .waitFor();
  await sp.getByText('AC Inspection – Floor 2').first().waitFor();
  await sp.getByText('Plant room check').first().waitFor();
  assert.equal(
    await sp.getByText('Someone else’s task').count(),
    0,
    'Other employee task must not be visible',
  );
  await sp.getByText(/Day shift · 07:00–16:00/).waitFor();
  await noOverflow(sp, 'my day');
  await shoot(sp, '04-my-day', true);
  checks.push(
    'My Day: own tasks only, overdue first, shift from records, start-next action',
  );

  // ---------------------------------------------------------- checklist execution
  await sp
    .getByRole('link', { name: 'AC Inspection – Floor 2' })
    .first()
    .click();
  await sp
    .getByRole('heading', { level: 1, name: 'AC Inspection – Floor 2' })
    .waitFor();
  await shoot(sp, '05-task-detail', true);
  await sp.getByRole('button', { name: 'Start task' }).click();
  await sp.getByText('Step 1 of 2').waitFor();
  await sp.getByRole('radio', { name: 'Fail' }).click();
  await sp.getByRole('button', { name: 'Next', exact: true }).click();
  await sp.getByText('Complete the highlighted answers first.').waitFor();
  await sp.getByLabel('Describe the fault').fill('Drain pan overflowing');
  await sp.getByLabel('Supply air temperature').fill('24');
  await shoot(sp, '06-checklist-step', true);
  await sp.getByRole('button', { name: 'Save progress' }).click();
  await sp.getByText('Progress saved.').first().waitFor();
  await sp.getByRole('button', { name: 'Next', exact: true }).click();
  await sp.getByText('Step 2 of 2').waitFor();
  await sp.getByRole('radio', { name: 'Yes' }).click();
  await sp.getByRole('button', { name: 'Review answers' }).click();
  await sp.getByRole('heading', { name: 'Failed checks' }).waitFor();
  await noOverflow(sp, 'review');
  await shoot(sp, '07-review', true);
  await sp.getByRole('button', { name: 'Submit for approval' }).click();
  await sp
    .getByText('Submitted. Your supervisor will review it.')
    .first()
    .waitFor();
  await sp.getByText('Waiting for approval').first().waitFor();
  assert.equal((await getTask(db, C, t1))!.status, 'awaiting_approval');
  checks.push(
    'Start, conditional and range validation, save progress, review summary with failed checks, submit for approval',
  );

  // ---------------------------------------------------------- report an issue from a task
  await sp.goto(staffUrl + '/#/task/' + t2);
  await sp.getByRole('button', { name: 'Start task' }).click();
  await sp.getByText('Step 1 of 2').waitFor();
  await sp.getByRole('button', { name: 'Back', exact: true }).first().click();
  await sp.getByRole('link', { name: 'Report problem' }).click();
  await sp.getByText('Plant room check').first().waitFor();
  await sp.getByRole('button', { name: 'Plumbing' }).click();
  await sp.getByRole('button', { name: 'Urgent / unsafe' }).click();
  await sp
    .getByLabel('What is the problem?')
    .fill('Water leaking near chiller pump');
  await shoot(sp, '08-report-issue', true);
  await sp.getByRole('button', { name: 'Send report' }).click();
  await sp.getByRole('heading', { name: 'Problem reported' }).waitFor();
  await sp.getByText(/WO-/).first().waitFor();
  await shoot(sp, '09-issue-confirmation');
  checks.push(
    'Issue reported from a task with carried site/location and a linked work order reference',
  );

  // ---------------------------------------------------------- supervisor review in the existing admin app → rework
  await reviewTask(
    db,
    C,
    owner,
    (await getTask(db, C, t1))!,
    'request_rework',
    'Photograph the drain pan and re-measure supply air',
  );
  await sp.goto(staffUrl + '/#/notifications');
  await sp.getByText('Rework required').first().waitFor();
  await shoot(sp, '10-notifications');
  await sp.getByText('Rework required').first().click();
  await sp.getByText('Work returned for correction').first().waitFor();
  await sp
    .getByText('Photograph the drain pan and re-measure supply air')
    .first()
    .waitFor();
  await shoot(sp, '11-rework', true);
  await sp.getByRole('button', { name: 'Start correction' }).click();
  await sp.getByRole('radio', { name: 'Pass' }).click();
  await sp.getByLabel('Supply air temperature').fill('15');
  await sp.getByRole('button', { name: 'Next', exact: true }).click();
  await sp.getByRole('radio', { name: 'Yes' }).click();
  await sp.getByRole('button', { name: 'Review answers' }).click();
  await sp.getByText('All checks passed.').waitFor();
  await sp.getByRole('button', { name: 'Submit for approval' }).click();
  await sp
    .getByText('Submitted. Your supervisor will review it.')
    .first()
    .waitFor();
  await reviewTask(db, C, owner, (await getTask(db, C, t1))!, 'approve', '');
  await sp.goto(staffUrl + '/#/notifications');
  await sp.getByText('Task approved').first().waitFor();
  assert.equal((await getTask(db, C, t1))!.attempt, 2);
  checks.push(
    'Supervisor rework reaches the technician; correction resubmitted as attempt 2 and approved with notification',
  );

  // ---------------------------------------------------------- work orders
  await sp.goto(staffUrl + '/#/work-orders');
  await sp.getByText('Replace corridor light').waitFor();
  await sp.getByText('Replace corridor light').click();
  await sp.getByRole('button', { name: 'Start work' }).click();
  await sp.getByRole('button', { name: 'Send' }).click();
  await sp
    .getByText(/Start work — Done/)
    .first()
    .waitFor();
  await sp.getByRole('button', { name: 'Request assistance' }).click();
  await sp.getByLabel('Reason').fill('Need a taller ladder');
  await sp.getByRole('button', { name: 'Send' }).click();
  await sp.getByText('Assistance requested: Need a taller ladder').waitFor();
  await sp.getByRole('button', { name: 'Mark resolved' }).click();
  await sp.getByLabel('Reason').fill('Replaced tube and starter');
  await sp.getByRole('button', { name: 'Send' }).click();
  await sp.getByText('resolved').first().waitFor();
  assert.equal(
    await sp.getByRole('button', { name: 'Verify fix' }).count(),
    0,
    'Technician cannot verify',
  );
  await shoot(sp, '12-work-order', true);
  checks.push(
    'Work order start, assistance request and resolution within the state machine; no verify for technicians',
  );

  // ---------------------------------------------------------- calendar, history, profile, language, sign-out
  await sp.goto(staffUrl + '/#/calendar');
  await sp.getByRole('tab', { name: 'Month' }).click();
  await sp.locator('.s-cal.month').waitFor();
  await shoot(sp, '13-calendar');
  await sp.goto(staffUrl + '/#/history');
  await sp.getByText('AC Inspection – Floor 2').first().waitFor();
  await sp.goto(staffUrl + '/#/profile');
  await sp.getByText('Day shift').first().waitFor();
  await sp.getByRole('radio', { name: /العربية/ }).click();
  await sp.waitForFunction(() => document.documentElement.dir === 'rtl');
  await sp.locator('.s-bottom').getByRole('link', { name: 'الرئيسية' }).click();
  await sp.getByText('عمل اليوم').first().waitFor();
  await noOverflow(sp, 'arabic my day');
  await shoot(sp, '14-arabic-rtl', true);
  await sp.goto(staffUrl + '/#/profile');
  await sp.getByRole('radio', { name: 'English' }).click();
  checks.push(
    'Calendar, history, shift profile and Arabic right-to-left layout',
  );

  for (const [name, w, h] of [
    ['320', 320, 640],
    ['375', 375, 812],
    ['390', 390, 844],
    ['768', 768, 1024],
    ['1024', 1024, 768],
    ['1440', 1440, 900],
  ] as const) {
    await sp.setViewportSize({ width: w, height: h });
    await sp.goto(staffUrl + '/#/');
    await sp.getByText('Plant room check').first().waitFor();
    await noOverflow(sp, `my day ${name}`);
    await shoot(sp, `my-day-${name}`);
    await sp.goto(staffUrl + '/#/task/' + t2);
    await sp
      .getByRole('heading', { level: 1, name: 'Plant room check' })
      .waitFor();
    await noOverflow(sp, `task ${name}`);
    await sp.goto(staffUrl + '/#/report');
    await sp.getByRole('heading', { name: /Report a problem/ }).waitFor();
    await noOverflow(sp, `report ${name}`);
  }
  checks.push('No horizontal overflow at 320, 375, 390, 768, 1024 and 1440 px');

  await sp.goto(staffUrl + '/#/profile');
  await sp.getByRole('button', { name: 'Sign out' }).click();
  await sp
    .getByRole('heading', { name: 'Sign in to start your day' })
    .waitFor();
  await sp.goto(staffUrl + '/#/task/' + t1);
  await sp
    .getByRole('heading', { name: 'Sign in to start your day' })
    .waitFor();
  checks.push('Signed-out sessions return to sign-in, including deep links');
  assert.deepEqual(errors, [], 'Unexpected browser exceptions');
  await writeFile(
    `${evidence}/staff-browser-results.json`,
    JSON.stringify(
      { checks, environment: 'local demo emulators only' },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ passed: checks.length, checks }));
} catch (error) {
  if (page || browser) {
    await mkdir(evidence, { recursive: true });
    const pages = browser?.contexts().flatMap((c) => c.pages()) || [];
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
  admin.kill('SIGTERM');
  staffSrv.kill('SIGTERM');
  process.exit(process.exitCode ?? 0);
}
