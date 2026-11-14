// Isolated local-only end-to-end verification of Phase 1 and Phase 2 in the
// redesigned admin UI; never targets a live Firebase project.
import { chromium } from 'playwright';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
if (
  process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
)
  throw Error('Both loopback emulators are required.');
await promisify(execFile)(process.execPath, ['scripts/seed-emulator.mjs']);
const vite = spawn(
  process.execPath,
  [
    path.resolve('node_modules/vite/bin/vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    '5193',
    '--strictPort',
  ],
  {
    cwd: 'apps/admin-web',
    stdio: 'pipe',
    env: {
      ...process.env,
      VITE_FIREBASE_ENV: 'emulator',
      VITE_FIREBASE_PROJECT_ID: 'demo-facilityos',
      VITE_FIREBASE_API_KEY: 'demo-facilityos',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-facilityos.firebaseapp.com',
      VITE_FIREBASE_APP_ID: 'demo-facilityos-web',
      VITE_ALLOW_LIVE_FIREBASE: 'false',
      VITE_ROUTER_MODE: 'browser',
      VITE_BASE_PATH: '/',
    },
  },
);
const origin = 'http://127.0.0.1:5193';
const evidence = 'docs/evidence/phase2';
let browser;
let page;
const checks = [];
try {
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {
      /* Development server is still starting. */
    }
    if (n === 99) throw Error('Vite did not start');
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    args: ['--no-sandbox'],
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mkdir(evidence, { recursive: true });

  const button = (name) => page.getByRole('button', { name, exact: true });
  const nav = async (label) => {
    await page.getByRole('link', { name: label, exact: true }).click();
    await page.getByRole('heading', { level: 1, name: label }).waitFor();
  };
  const drawer = () => page.getByRole('dialog');
  const add = (singular) => button(`Add ${singular}`).first().click();
  const basic = async (code, name) => {
    await drawer()
      .getByLabel(/^(Code|Contract reference|Employee ID|Asset code)/)
      .fill(code);
    await drawer()
      .getByLabel(/^(Name|Full name)/)
      .fill(name);
  };
  const exact = (label) =>
    new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\*?$');
  const pick = async (label, option) => {
    const scope = (await drawer().count()) ? drawer() : page;
    await scope.getByLabel(exact(label)).click();
    await page
      .getByRole('option', { name: new RegExp(option) })
      .first()
      .click();
  };
  const select = (label, value) =>
    drawer().getByLabel(exact(label)).selectOption(value);
  const save = async (singular, verb = 'created') => {
    await button(`Save ${singular}`).click();
    await page
      .getByText(
        `${singular.charAt(0).toUpperCase() + singular.slice(1)} ${verb}.`,
      )
      .first()
      .waitFor();
    await drawer().waitFor({ state: 'detached' });
  };
  const open = (name) => button(name).first().click();
  const back = (title) => button(`Back to ${title}`).click();
  const noOverflow = async (label) => {
    const wide = await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth
        ? []
        : [...document.querySelectorAll('body *')]
            .filter(
              (e) =>
                e.getBoundingClientRect().right > window.innerWidth + 1 &&
                getComputedStyle(e).visibility !== 'hidden',
            )
            .slice(0, 6)
            .map((e) => e.tagName + '.' + e.className)
            .concat(['scrollWidth ' + document.documentElement.scrollWidth]),
    );
    assert.deepEqual(wide, [], `${label} has horizontal page overflow`);
  };
  const shoot = async (name, full = false) => {
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: full });
  };

  // ---------------------------------------------------------- authentication
  await page.goto(origin);
  await page
    .getByRole('heading', { name: 'Sign in to your workspace' })
    .waitFor();
  await shoot('01-login');
  await page.getByLabel('Email address').fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await button('Sign in').click();
  await page.getByRole('alert').waitFor();
  await page.getByLabel('Password', { exact: true }).fill('Local-only-123!');
  await button('Sign in').click();
  await page.getByText(/Good (morning|afternoon|evening)/).waitFor();
  await page.reload();
  await page.getByText(/Good (morning|afternoon|evening)/).waitFor();
  checks.push('Login error, sign-in, dashboard and refresh persistence');

  // ---------------------------------------------------------- property
  await nav('Sites');
  await add('site');
  await basic('SITE001', 'Marina Campus');
  assert.equal(await drawer().getByLabel('Client', { exact: true }).count(), 0);
  await button('Mon').click();
  await button('Tue').click();
  await shoot('02-site-form');
  await save('site');
  checks.push('Site created with no client or contract field');
  await nav('Locations');
  await add('location');
  await basic('LOC001', 'Tower A');
  await pick('Site', 'Marina Campus');
  await save('location');
  await open('Tower A');
  await button('Add child location').click();
  await basic('LOC002', 'First floor');
  await select('Location type', 'Floor');
  await save('location');
  await back('locations');
  await nav('Facility types');
  await add('facility type');
  await basic('POOL', 'Swimming pool');
  await save('facility type');
  await nav('Facilities');
  await add('facility');
  await basic('FAC001', 'Main pool');
  await pick('Site', 'Marina Campus');
  await pick('Location', 'First floor');
  await pick('Facility type', 'Swimming pool');
  await save('facility');
  await page
    .getByRole('button', { name: 'Edit Main pool', exact: true })
    .click();
  await select('Condition', 'Fair');
  await select('Status', 'under_maintenance');
  await save('facility', 'updated');
  await open('Main pool');
  await page.getByRole('tab', { name: 'History' }).click();
  await page.getByText('Revision 2').waitFor();
  await back('facilities');
  checks.push(
    'Locations, child location, facility type, facility and condition history',
  );

  // ---------------------------------------------------------- commercial
  await nav('Clients');
  await add('client');
  await button('Save client').click();
  await drawer().getByRole('alert').first().waitFor();
  await basic('CL001', 'Northstar Services');
  await select('Client type', 'Company');
  await save('client');
  await nav('Contracts');
  await add('contract');
  await basic('CT001', 'Annual services');
  await pick('Client', 'Northstar Services');
  await drawer().getByLabel('Start date').fill('2026-01-01');
  await drawer().getByLabel('End date').fill('2026-12-31');
  await save('contract');
  await nav('Contract allocations');
  await add('allocation');
  await basic('AL001', 'Whole-site service');
  await pick('Contract', 'Annual services');
  await drawer().getByText('Client taken from the contract').waitFor();
  await drawer().getByText('Northstar Services').waitFor();
  await pick('Site', 'Marina Campus');
  await drawer().getByLabel('Start date').fill('2026-01-01');
  await drawer().getByLabel('End date').fill('2026-12-31');
  await save('allocation');
  checks.push(
    'Client, contract and whole-site allocation with client derived from contract',
  );

  // ---------------------------------------------------------- people
  await nav('Departments');
  await add('department');
  await basic('OPS', 'Operations');
  await save('department');
  await nav('Designations');
  await add('designation');
  await basic('TECH', 'Technician');
  await pick('Department', 'Operations');
  await save('designation');
  await nav('Employees');
  await add('employee');
  await basic('E001', 'Asha Rao');
  await drawer().getByLabel('Joining date').fill('2026-01-05');
  await pick('Department', 'Operations');
  await pick('Designation', 'Technician');
  await pick('Primary site', 'Marina Campus');
  await shoot('03-employee-form');
  await save('employee');
  await nav('Shifts');
  await add('shift');
  await basic('NIGHT', 'Night shift');
  await pick('Site', 'Marina Campus');
  await drawer().getByLabel('Start time').fill('22:00');
  await drawer().getByLabel('End time').fill('06:00');
  await button('Sun').click();
  await save('shift');
  await button('Shift assignments').click();
  await add('shift assignment');
  await pick('Employee', 'Asha Rao');
  await pick('Shift', 'Night shift');
  await drawer().getByLabel('Effective from').fill('2026-02-01');
  await save('shift assignment');
  await page.getByText('Asha Rao · Night shift').waitFor();
  await nav('Teams');
  await add('team');
  await basic('TEAM1', 'Facilities crew');
  await pick('Department', 'Operations');
  await pick('Team leader', 'Asha Rao');
  await save('team');
  await nav('Leave & holidays');
  await add('leave record');
  await pick('Employee', 'Asha Rao');
  await drawer().getByLabel('First day').fill('2026-04-01');
  await drawer().getByLabel('Last day').fill('2026-04-03');
  await save('leave record');
  await nav('Departments');
  await page
    .getByRole('button', { name: 'Archive Operations', exact: true })
    .click();
  await button('Archive').click();
  await page
    .getByText(/Archive or reassign active linked records first/)
    .waitFor();
  checks.push(
    'Department, designation, employee, overnight shift and assignment, team, leave and archive protection',
  );

  // ---------------------------------------------------------- assets
  await nav('Categories');
  await add('asset category');
  await basic('HVAC', 'HVAC');
  await save('asset category');
  await nav('Asset register');
  await add('asset');
  await basic('AC-001', 'Chiller unit');
  await pick('Category', 'HVAC');
  await drawer().getByLabel('Serial number').fill('SN-77812');
  await pick('Site', 'Marina Campus');
  await pick('Location', 'Tower A');
  await drawer().getByLabel('Purchase cost').fill('12500.00');
  await save('asset');
  await nav('Furniture & fixtures');
  await add('asset');
  await basic('CHAIR-B1', 'Lobby chairs');
  await pick('Category', 'HVAC');
  await select('Tracking', 'batch');
  await drawer().getByLabel('Quantity').fill('40');
  await pick('Site', 'Marina Campus');
  await pick('Location', 'First floor');
  await save('asset');
  await page.getByText('Lobby chairs').waitFor();
  await nav('Asset register');
  await open('Chiller unit');
  await button('Transfer').click();
  await pick('Destination location', 'First floor');
  await drawer().getByLabel('Reason').fill('Moved to plant room');
  await button('Confirm transfer').click();
  await page.getByText('Chiller unit transferred.').waitFor();
  await page.getByRole('tab', { name: 'Transfers' }).click();
  await page.getByText('Moved to plant room').waitFor();
  await button('QR label').click();
  await page.getByRole('img', { name: /QR code for AC-001/ }).waitFor();
  await shoot('04-asset-qr');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  checks.push(
    'Equipment, furniture batch, atomic transfer with history and QR label',
  );

  // ---------------------------------------------------------- inventory
  await nav('Material categories');
  await add('material category');
  await basic('CLEAN', 'Cleaning');
  await save('material category');
  await nav('Materials');
  await add('material');
  await basic('MAT-01', 'Floor cleaner');
  await pick('Category', 'Cleaning');
  await select('Unit of measure', 'litre');
  await drawer().getByLabel('Reorder level').fill('5');
  await save('material');
  await nav('Stores');
  for (const [code, name] of [
    ['ST-A', 'Main store'],
    ['ST-B', 'Tower store'],
  ]) {
    await add('store');
    await basic(code, name);
    await pick('Site', 'Marina Campus');
    await save('store');
  }
  await nav('Stock transactions');
  const post = async (type, fields, quantity, extra) => {
    await button('New transaction').click();
    await button(type).click();
    await pick('Material', 'Floor cleaner');
    for (const [label, value] of fields) await pick(label, value);
    await drawer().getByLabel('Quantity').fill(quantity);
    if (extra) await drawer().getByLabel('Reason').fill(extra);
    await drawer()
      .getByRole('button', { name: /^Post / })
      .click();
  };
  await post('Opening stock', [['Destination store', 'Main store']], '20.5');
  await page.getByText('Opening stock posted.').waitFor();
  await post('Receipt', [['Destination store', 'Main store']], '4.25');
  await page.getByText('Receipt posted.').waitFor();
  await post('Issue', [['Source store', 'Main store']], '100');
  await drawer()
    .getByText(/Not enough stock/)
    .waitFor();
  await button('Cancel').click();
  await post('Issue', [['Source store', 'Main store']], '0.755');
  await page.getByText('Issue posted.').waitFor();
  await post(
    'Transfer',
    [
      ['Source store', 'Main store'],
      ['Destination store', 'Tower store'],
    ],
    '20',
  );
  await page.getByText('Transfer posted.').waitFor();
  await post(
    'Adjustment (decrease)',
    [['Source store', 'Tower store']],
    '0.5',
    'Spillage',
  );
  await page.getByText('Adjustment (decrease) posted.').waitFor();
  await page.getByRole('button', { name: 'Reverse' }).first().click();
  await button('Post reversal').click();
  await page.getByText('Transaction reversed.').waitFor();
  await shoot('05-stock-ledger');
  await nav('Stock balance');
  await page.getByText('3.995').waitFor();
  await page.getByText('20.000').waitFor();
  await page.getByText('Reorder').first().waitFor();
  checks.push(
    'Opening, receipt, rejected over-issue, issue, transfer, adjustment, reversal and exact balances with reorder flag',
  );

  // ---------------------------------------------------------- admin
  await nav('Roles & permissions');
  await page.getByText('Prepared').first().waitFor();
  await nav('User access');
  await page.getByText('You').first().waitFor();
  checks.push('Roles matrix and read-only user access');

  // ---------------------------------------------------------- responsive
  const views = [
    ['desktop', 1440, 1000],
    ['tablet', 768, 1024],
    ['mobile', 390, 844],
  ];
  for (const [device, width, height] of views) {
    await page.setViewportSize({ width, height });
    await page.goto(origin + '/');
    await page.getByText(/Good (morning|afternoon|evening)/).waitFor();
    await noOverflow(device + ' dashboard');
    await shoot(`dashboard-${device}`);
    await page.goto(origin + '/assets');
    await page.getByText('Chiller unit').first().waitFor();
    await noOverflow(device + ' list');
    await shoot(`list-${device}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await button('Toggle navigation').click();
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await add('employee');
  await noOverflow('mobile form');
  await shoot('form-mobile');
  await button('Cancel').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  checks.push(
    'Desktop, tablet and mobile dashboard, list and form without page overflow',
  );

  // ---------------------------------------------------------- isolation & logout
  await page.goto(origin + '/sites');
  await page.getByText('Marina Campus').first().waitFor();
  await page.getByLabel('Current company').selectOption('local-company-b');
  await page.getByText('No sites yet').waitFor();
  assert.equal(await button('Marina Campus').count(), 0);
  checks.push('Company switching without tenant data leakage');
  await page.getByLabel('Profile menu').click();
  await button('Sign out').click();
  await page
    .getByRole('heading', { name: 'Sign in to your workspace' })
    .waitFor();
  for (const email of ['owner@example.test', 'unknown@example.test']) {
    await page.getByLabel('Email address').fill(email);
    await button('Forgot your password?').click();
    await page
      .getByText(
        'If this email is eligible, you will receive password reset instructions.',
        { exact: true },
      )
      .waitFor();
  }
  checks.push('Logout and account-enumeration-safe password reset');
  assert.deepEqual(errors, [], 'Unexpected browser exceptions');
  await writeFile(
    `${evidence}/browser-results.json`,
    JSON.stringify(
      {
        checks,
        viewports: ['1440x1000', '768x1024', '390x844'],
        pageErrors: errors,
        environment: 'local demo emulators only',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ passed: checks.length, checks }));
} catch (error) {
  if (page) {
    await mkdir(evidence, { recursive: true });
    await page
      .screenshot({ path: `${evidence}/failure.png`, fullPage: true })
      .catch(() => {});
    await writeFile(`${evidence}/failure.txt`, String(error));
  }
  throw error;
} finally {
  await browser?.close();
  vite.kill('SIGTERM');
}
