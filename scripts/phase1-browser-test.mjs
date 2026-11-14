// Isolated local-only end-to-end verification; never targets a live Firebase project.
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
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin);
  await page.getByLabel('Email address').fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Local-only-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Your company workspace' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Your company workspace' }).waitFor();
  checks.push('Owner login, company loading and refresh persistence');
  await page.getByRole('link', { name: /Companies & sites/ }).click();
  const button = (name) => page.getByRole('button', { name, exact: true });
  async function basic(code, name) {
    await page.getByLabel(/^Code/).fill(code);
    await page.getByLabel(/^Name/).fill(name);
  }
  async function choose(label, name) {
    await page
      .locator('form')
      .getByRole('button', {
        name: new RegExp('Choose ' + label.toLowerCase()),
      })
      .click();
    await page
      .locator('form')
      .getByRole('button', { name: new RegExp(name) })
      .click();
  }
  async function saved(name) {
    await button(name).click();
    await page.getByText('Changes saved.', { exact: true }).waitFor();
  }
  await button('Add client').click();
  await button('Save client').click();
  await page.getByRole('alert').first().waitFor();
  await basic('CL001', 'Northstar Services');
  await page.getByLabel(/^Client type/).selectOption('Company');
  await page.getByLabel('Email', { exact: true }).fill('team@example.test');
  await saved('Save client');
  await page
    .getByRole('button', { name: 'Edit Northstar Services', exact: true })
    .click();
  await page.getByLabel(/^Name/).fill('Northstar Facilities');
  await saved('Save client');
  checks.push('Client validation, create and edit');
  await button('Contracts').click();
  await button('Add contract').click();
  await page.getByLabel(/^Contract reference/).fill('CT001');
  await page.getByLabel(/^Name/).fill('Annual services');
  await choose('Client', 'Northstar Facilities');
  await page.getByLabel(/^Start date/).fill('2026-01-01');
  await page.getByLabel(/^End date/).fill('2026-12-31');
  await saved('Save contract');
  checks.push('Contract create and client selector');
  await button('Sites').click();
  await button('Add site').click();
  await basic('SITE001', 'Marina Campus');
  await choose('Client', 'Northstar Facilities');
  await choose('Contract', 'Annual services');
  await page.getByLabel('Mon', { exact: true }).check();
  await page.getByLabel('Tue', { exact: true }).check();
  await saved('Save site');
  await button('Marina Campus').click();
  await page
    .getByRole('navigation', { name: 'Site details' })
    .getByRole('button', { name: 'Locations', exact: true })
    .click();
  await button('Add location').click();
  await basic('LOC001', 'Tower A');
  await saved('Save location');
  await button('Add location').click();
  await basic('LOC002', 'First floor');
  await page.getByLabel(/^Location type/).selectOption('Floor');
  await choose('Parent location', 'Tower A');
  await saved('Save location');
  checks.push('Site, working days, root and child location creation');
  await page
    .getByRole('button', { name: 'Archive Tower A', exact: true })
    .click();
  await button('Confirm archive').click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Archive or reassign' })
    .waitFor();
  checks.push('Referenced location archive is blocked with a useful message');
  await page.getByRole('link', { name: /Facilities & locations/ }).click();
  await button('Facility types').click();
  await button('Add facility type').click();
  await basic('POOL', 'Swimming pool');
  await saved('Save facility type');
  await button('Facilities').click();
  await button('Add facility').click();
  await basic('FAC001', 'Main pool');
  await choose('Site', 'Marina Campus');
  await choose('Location', 'First floor');
  await choose('Facility type', 'Swimming pool');
  await saved('Save facility');
  await page
    .getByRole('button', { name: 'Edit Main pool', exact: true })
    .click();
  await page.getByLabel(/^Condition/).selectOption('Fair');
  await page.getByLabel(/^Status/).selectOption('under_maintenance');
  await saved('Save facility');
  await button('Main pool').click();
  await page
    .getByRole('heading', { name: 'Condition & status history' })
    .waitFor();
  await page.getByText(/#2 · Fair/).waitFor();
  checks.push('Facility type, facility create/edit and condition history');
  await mkdir('docs/evidence', { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'docs/evidence/phase1-desktop.png',
    fullPage: true,
  });
  for (const [name, width, height] of [
    ['tablet', 768, 1024],
    ['mobile', 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `docs/evidence/phase1-${name}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      `${name} has page overflow`,
    );
  }
  checks.push(
    'Desktop, tablet and mobile detail layouts without page overflow',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await button('Back to list').click();
  await page
    .getByRole('button', { name: 'Archive Main pool', exact: true })
    .click();
  await button('Confirm archive').click();
  await page.getByText('Changes saved.', { exact: true }).waitFor();
  await page.getByLabel('Current company').selectOption('local-company-b');
  await page
    .getByRole('heading', { name: 'Facilities', exact: true })
    .waitFor();
  await page.getByRole('heading', { name: 'No facilities found' }).waitFor();
  assert.equal(await button('Main pool').count(), 0);
  checks.push('Archive, company switching and no tenant data leakage');
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
  await page.screenshot({
    path: 'docs/evidence/phase1-reset.png',
    fullPage: true,
  });
  checks.push(
    'Logout and account-enumeration-safe password reset for known and unknown email',
  );
  assert.deepEqual(errors, [], 'Unexpected browser exceptions');
  await writeFile(
    'docs/evidence/browser-results.json',
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
    await mkdir('docs/evidence', { recursive: true });
    await page
      .screenshot({ path: 'docs/evidence/failure.png', fullPage: true })
      .catch(() => {});
    await writeFile('docs/evidence/failure.txt', String(error));
  }
  throw error;
} finally {
  await browser?.close();
  vite.kill('SIGTERM');
}
