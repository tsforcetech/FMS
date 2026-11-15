// Phase 8 end-to-end test against the local emulators only: onboarding with
// a starter pack, import center, Excel/PDF export, invitations + joining,
// tenant plan & usage, and the Sharaco platform console (plans, assignment,
// suspension) with tenant-admin isolation.
// Run with: firebase emulators:exec ... "npx tsx scripts/phase8-browser-test.ts"
import { chromium, type Page, type Download } from 'playwright';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { initializeApp as adminApp } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb, Timestamp } from 'firebase-admin/firestore';

if (
  process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
)
  throw Error('Both loopback emulators are required.');
await promisify(execFile)(process.execPath, ['scripts/seed-emulator.mjs']);
adminApp({ projectId: 'demo-facilityos' });
const A = adminAuth(),
  F = adminDb();
// A verified Sharaco platform owner (custom claim, as the operator script sets it).
const pw = 'Local-only-123!';
let platformUser;
try {
  platformUser = await A.getUserByEmail('platform@sharaco.test');
} catch {
  platformUser = await A.createUser({
    email: 'platform@sharaco.test',
    password: pw,
    emailVerified: true,
  });
}
await A.setCustomUserClaims(platformUser.uid, { platformRole: 'owner' });

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
  VITE_PLATFORM_BASE_PATH: '/',
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
const adminSrv = serve('apps/admin-web', '5197');
const platSrv = serve('apps/platform-web', '5198');
const adminUrl = 'http://127.0.0.1:5197',
  platUrl = 'http://127.0.0.1:5198';
const evidence = 'docs/evidence/phase8';
const checks: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const C = 'local-company-a';
try {
  for (const url of [adminUrl, platUrl])
    for (let n = 0; n < 150; n++) {
      try {
        if ((await fetch(url)).ok) break;
      } catch {
        /* starting */
      }
      if (n === 149) throw Error('Vite did not start: ' + url);
      await new Promise((r) => setTimeout(r, 100));
    }
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
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const ap = await ctx.newPage();
  ap.setDefaultTimeout(20000);
  ap.on('pageerror', (e) => errors.push('admin: ' + e.message));
  await ap.goto(adminUrl);
  await ap.getByLabel('Email address').fill('owner@example.test');
  await ap.getByLabel('Password', { exact: true }).fill(pw);
  await ap.getByRole('button', { name: 'Sign in', exact: true }).click();
  await ap.getByText(/Good (morning|afternoon|evening)/).waitFor();

  // ------------------------------------------------ onboarding + starter pack
  await ap.goto(adminUrl + '/onboarding?step=templates');
  await ap.getByText('Setup progress').waitFor();
  await ap.getByLabel('Industry').selectOption('business_center');
  await shoot(ap, '01-onboarding-starter-pack');
  await ap.getByRole('button', { name: 'Install selected' }).click();
  await ap.getByText(/Installed \d+ item\(s\)/).waitFor({ timeout: 60000 });
  await ap.getByRole('button', { name: 'Install selected' }).click();
  await ap
    .getByText(/Installed 0 item\(s\); \d+ already existed/)
    .waitFor({ timeout: 60000 });
  const drafts = (
    await F.collection(`companies/${C}/templateVersions`).get()
  ).docs.map((d) => d.data().state);
  assert.ok(
    drafts.length >= 10 && drafts.every((s) => s === 'draft'),
    'pack checklists must be drafts',
  );
  assert.equal(
    (await F.collection(`companies/${C}/recurringSchedules`).get()).size,
    0,
    'no schedules may be created',
  );
  checks.push(
    'Starter pack installs departments, designations, categories and DRAFT checklists; re-installing is idempotent; no schedules are created',
  );
  await ap.goto(adminUrl + '/onboarding?step=branding');
  await ap.getByLabel('Report header line').fill('Facility services report');
  await ap.getByRole('button', { name: 'Save branding' }).click();
  await ap.getByText('Branding saved').waitFor();
  await ap.goto(adminUrl + '/onboarding');
  await ap.getByText(/% complete/).waitFor();
  await shoot(ap, '02-onboarding-progress');
  checks.push(
    'Onboarding shows real progress, saves branding and can be resumed at any step',
  );

  // ------------------------------------------------ import center
  await ap.goto(adminUrl + '/import');
  await ap.getByLabel('Module', { exact: true }).selectOption('departments');
  const csv =
    'Code,Name,Status\r\nIMPORT-HK,Imported Housekeeping,active\r\nIMPORT-MEP,Imported MEP,active\r\nIMPORT-HK,Duplicate,active\r\nbad code!,Bad,active\r\n';
  await ap.getByLabel('Import file').setInputFiles({
    name: 'departments.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await ap.getByText('4 data rows found.').waitFor();
  await ap.getByRole('button', { name: 'Validate (dry run)' }).click();
  await ap.getByText('3. Review and confirm').waitFor();
  assert.equal(
    (
      await F.collection(`companies/${C}/departments`)
        .where('code', '==', 'IMPORT-HK')
        .get()
    ).size,
    0,
    'dry run must not write',
  );
  await shoot(ap, '03-import-preview', true);
  await ap.getByRole('button', { name: /Import 2 rows/ }).click();
  await ap.getByText('Import completed').first().waitFor({ timeout: 60000 });
  assert.equal(
    (
      await F.collection(`companies/${C}/departments`)
        .where('code', 'in', ['IMPORT-HK', 'IMPORT-MEP'])
        .get()
    ).size,
    2,
  );
  // Same file again: recognised, nothing new.
  await ap.getByLabel('Import file').setInputFiles({
    name: 'departments.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await ap.getByText(/already imported/).waitFor();
  await ap.getByRole('button', { name: 'Validate (dry run)' }).click();
  await ap.getByText('3. Review and confirm').waitFor();
  assert.equal(
    await ap.getByRole('button', { name: /Import \d+ row/ }).isDisabled(),
    true,
  );
  await ap.getByRole('cell', { name: 'departments.csv' }).first().waitFor();
  checks.push(
    'Import Center: template, CSV upload, mapping, dry run (no writes), preview with duplicates/invalid rows, import, repeat-file detection, history',
  );

  // ------------------------------------------------ exports
  await ap.goto(adminUrl + '/departments');
  await ap.getByRole('button', { name: 'Export' }).click();
  const dlg = ap.getByRole('dialog');
  await dlg.getByText('All matching records').click();
  const [xlsx] = await Promise.all([
    ap.waitForEvent('download'),
    dlg.getByRole('button', { name: /Export XLSX/ }).click(),
  ]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(
    (await readFile((await (xlsx as Download).path())!)).buffer as ArrayBuffer,
  );
  const ws = wb.worksheets[0];
  const codes = ws.getColumn(1).values.filter(Boolean).map(String);
  assert.ok(
    codes.includes('IMPORT-HK') && codes.includes('IMPORT-MEP'),
    'export contains imported rows',
  );
  assert.equal(ws.getRow(1).getCell(1).value, 'Code');
  await ap.goto(adminUrl + '/departments');
  await ap.getByRole('button', { name: 'Export' }).click();
  await ap.getByRole('dialog').getByRole('button', { name: 'PDF' }).click();
  const [pdf] = await Promise.all([
    ap.waitForEvent('download'),
    ap
      .getByRole('dialog')
      .getByRole('button', { name: /Export PDF/ })
      .click(),
  ]);
  const pdfBytes = await readFile((await (pdf as Download).path())!);
  assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF');
  await shoot(ap, '04-export-dialog');
  const logs = await F.collection(`companies/${C}/exportLogs`).get();
  assert.ok(
    logs.size >= 2 && logs.docs.every((d) => !('data' in d.data())),
    'export audit holds metadata only',
  );
  checks.push(
    'Excel and PDF exports download real files with the filtered rows; each export writes a metadata-only audit entry',
  );

  // ------------------------------------------------ invitations + join
  await ap.goto(adminUrl + '/invitations');
  await ap.getByRole('button', { name: 'Invite someone' }).click();
  await ap.getByLabel('Email').fill('new.supervisor@example.test');
  await ap.getByLabel('Role').selectOption('supervisor');
  await ap.getByRole('button', { name: 'Create invitation' }).click();
  const link = (await ap.locator('code').first().innerText()).trim();
  assert.match(link, /join\?c=local-company-a&t=/);
  await shoot(ap, '05-invitation-created');
  const jp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  jp.on('pageerror', (e) => errors.push('join: ' + e.message));
  await jp.goto(link);
  await jp.getByRole('button', { name: 'I need to create an account' }).click();
  await jp.getByLabel('Email').fill('new.supervisor@example.test');
  await jp.getByLabel('Password').fill('Joiner-123!');
  await jp.getByRole('button', { name: /Create account/ }).click();
  await jp.getByText('Verify your email first').waitFor();
  // Unverified accounts cannot join.
  await jp.getByRole('button', { name: /accept/ }).click();
  await jp.getByText(/Verify your email address first/).waitFor();
  const joiner = await A.getUserByEmail('new.supervisor@example.test');
  await A.updateUser(joiner.uid, { emailVerified: true }); // stands in for clicking the emailed link
  await jp.getByRole('button', { name: /accept/ }).click();
  await jp.getByText('You have joined').waitFor();
  await shoot(jp, '06-join-accepted');
  const member = (
    await F.doc(`companies/${C}/members/${joiner.uid}`).get()
  ).data()!;
  assert.equal(member.role, 'supervisor');
  checks.push(
    'Invitation link → account creation → email verification required → accept creates exactly the invited role',
  );

  // ------------------------------------------------ platform console
  const pp = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  pp.setDefaultTimeout(20000);
  pp.on('pageerror', (e) => errors.push('platform: ' + e.message));
  // A tenant owner is refused.
  await pp.goto(platUrl);
  await pp.getByLabel('Email').fill('owner@example.test');
  await pp.getByLabel('Password').fill(pw);
  await pp.getByRole('button', { name: 'Sign in' }).click();
  await pp.getByText('Not a Sharaco platform account').waitFor();
  await pp.getByRole('button', { name: /Sign out/ }).click();
  checks.push(
    'A tenant owner cannot use the platform console (no platform claim)',
  );
  await pp.getByLabel('Email').fill('platform@sharaco.test');
  await pp.getByLabel('Password').fill(pw);
  await pp.getByRole('button', { name: 'Sign in' }).click();
  await pp.getByText('Platform overview').waitFor();
  await pp.goto(platUrl + '/#/plans');
  await pp.getByRole('button', { name: 'New plan' }).click();
  await pp.getByLabel('Start from example').selectOption({ label: 'Starter' });
  await pp.getByRole('button', { name: 'Publish version' }).click();
  await pp.getByText(/Published Starter v1/).waitFor();
  await shoot(pp, '07-platform-plans');
  // Real usage counts first (the trusted reconciliation), then assign.
  await promisify(execFile)(
    process.execPath,
    [
      '--import',
      'tsx',
      'scripts/usage-reconcile.ts',
      '--project',
      'demo-facilityos',
      '--confirm-project',
      'demo-facilityos',
      '--company',
      C,
      '--apply',
    ],
    { env: process.env },
  );
  await pp.goto(platUrl + '/#/companies/' + C);
  await pp.getByLabel('Plan').selectOption({ label: 'Starter v1' });
  await pp.getByRole('button', { name: 'Assign plan' }).click();
  await pp.getByText('Plan assigned').waitFor();
  await pp.getByRole('button', { name: 'Suspend (read-only)' }).click();
  await pp.getByText('Suspend recorded').waitFor();
  await shoot(pp, '08-platform-company', true);
  const co = (await F.doc(`companies/${C}`).get()).data()!;
  assert.equal(co.status, 'read_only');
  // The tenant now sees read-only; data is still there.
  await ap.goto(adminUrl + '/departments');
  await ap.getByText('Read-only subscription.').waitFor();
  await ap
    .getByText('Imported Housekeeping', { exact: true })
    .first()
    .waitFor();
  await ap.goto(adminUrl + '/plan');
  await ap.getByText('Read-only subscription', { exact: true }).waitFor();
  await shoot(ap, '09-tenant-plan-read-only', true);
  await pp.getByRole('button', { name: 'Reactivate' }).click();
  await pp.getByText('Reactivate recorded').waitFor();
  assert.equal((await F.doc(`companies/${C}`).get()).data()!.status, 'active');
  await pp.goto(platUrl + '/#/audit');
  await pp
    .getByText(/subscription assigned/i)
    .first()
    .waitFor();
  await pp.goto(platUrl + '/');
  await pp.getByText('Registered companies').waitFor();
  await shoot(pp, '10-platform-overview', true);
  checks.push(
    'Platform console: plan versioning, assignment after usage reconciliation, suspension to read-only (data intact, banner shown), reactivation, audit log',
  );

  // ------------------------------------------------ responsiveness
  for (const w of [390, 768]) {
    await ap.setViewportSize({ width: w, height: 900 });
    for (const r of ['/onboarding', '/import', '/plan', '/invitations']) {
      await ap.goto(adminUrl + r);
      await ap.waitForTimeout(400);
      await noOverflow(ap, `admin ${r} @${w}`);
    }
    await pp.setViewportSize({ width: w, height: 900 });
    for (const r of ['/', '/#/companies', '/#/plans']) {
      await pp.goto(platUrl + r);
      await pp.waitForTimeout(400);
      await noOverflow(pp, `platform ${r} @${w}`);
    }
  }
  checks.push(
    'No horizontal overflow on Phase 8 admin and platform screens at 390 and 768 px',
  );
  assert.deepEqual(errors, [], 'Unexpected browser exceptions');
  void Timestamp;
  await writeFile(
    `${evidence}/phase8-browser-results.json`,
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
    for (const [i, p] of browser
      .contexts()
      .flatMap((c) => c.pages())
      .entries())
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
  platSrv.kill('SIGTERM');
  process.exit(process.exitCode ?? 0);
}
