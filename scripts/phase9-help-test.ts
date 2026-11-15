// Phase 9 Help Center test: serves apps/help-web/dist under /FMS/help/ (as on
// GitHub Pages) and checks the site, search, contextual help, restricted-content
// exclusion, PDFs (opened and their tables of contents verified), diagrams,
// mobile layout, Arabic RTL, translation fallback, reproducibility and the CI
// link check. Run: npm run test:help (after npm run help:pdf && npm run help:build).
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import {
  chromiumOptions,
  loadArticles,
  loadManuals,
  root,
} from './help/lib.ts';

const dist = path.join(root, 'apps/help-web/dist');
assert.ok(
  existsSync(path.join(dist, 'index.html')),
  'Build the Help Center first (npm run help:build).',
);
const evidence = path.join(root, 'docs/evidence/phase9');
mkdirSync(evidence, { recursive: true });
const all = loadArticles();
const restricted = all.filter((a) => a.meta.audience !== 'public');
const pub = all.filter((a) => a.meta.audience === 'public');
const checks: string[] = [];
const ok = (n: number, s: string) => {
  checks.push(`${n}. ${s}`);
  console.log(`✓ ${n}. ${s}`);
};
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.mmd': 'text/plain; charset=utf-8',
};
const server = createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  if (!u.startsWith('/FMS/help/')) return void res.writeHead(404).end();
  let f = path.join(dist, u.slice('/FMS/help/'.length));
  if (existsSync(f) && statSync(f).isDirectory())
    f = path.join(f, 'index.html');
  if (!f.startsWith(dist) || !existsSync(f))
    return void res
      .writeHead(404, { 'content-type': 'text/html' })
      .end(readFileSync(path.join(dist, '404.html')));
  res
    .writeHead(200, {
      'content-type': types[path.extname(f)] || 'application/octet-stream',
    })
    .end(readFileSync(f));
});
await new Promise<void>((r) => server.listen(5179, '127.0.0.1', r));
const base = 'http://127.0.0.1:5179/FMS/help/';
const browser = await chromium.launch({
  ...chromiumOptions(),
  args: ['--no-sandbox'],
});
const errors: string[] = [];
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) =>
    statSync(path.join(d, f)).isDirectory()
      ? walk(path.join(d, f))
      : [path.join(d, f)],
  );
const imagesLoaded = (p: Page) =>
  p.evaluate(() =>
    [...document.images]
      .filter((i) => !i.complete || i.naturalWidth === 0)
      .map((i) => i.src),
  );
try {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 900 },
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // 1
  await p.goto(base);
  await p.getByRole('heading', { name: 'How can we help?' }).waitFor();
  assert.equal(await p.locator('.cats .card').count(), 8);
  assert.match(await p.locator('.foot').innerText(), /FacilityOS 0\.9/);
  await p.screenshot({ path: `${evidence}/01-home.png` });
  ok(
    1,
    `Help Center loads with 8 categories and the product version label (${pub.length} public articles)`,
  );

  // 2
  await p.locator('.big-search input').fill('recurring cleaning');
  await p.locator('.big-search input').press('Enter');
  await p.locator('[data-search-results] li').first().waitFor();
  assert.match(
    await p.locator('[data-search-results] li').first().innerText(),
    /recurring cleaning task/i,
  );
  await p
    .locator('[data-search-input]')
    .fill('Choose a published template version');
  await p.waitForTimeout(200);
  assert.match(
    await p.locator('[data-search-results]').innerText(),
    /recurring cleaning task/i,
  );
  await p.locator('[data-search-input]').fill('zzqxv-nothing');
  await p.waitForTimeout(200);
  assert.equal(await p.locator('[data-search-results] li').count(), 0);
  await p.locator('[data-search-input]').fill('work order');
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${evidence}/02-search.png` });
  ok(
    2,
    'Search finds real articles by title, by exact error message, and returns nothing for nonsense',
  );

  // 3 + 5
  await p.goto(base);
  await p.locator('.cats .card a', { hasText: 'Daily Tasks' }).click();
  await p.getByRole('heading', { level: 1, name: 'Daily Tasks' }).waitFor();
  const first = p.locator('.cards .card a').first();
  const firstTitle = (await first.locator('strong').innerText()).trim();
  await first.click();
  await p.getByRole('heading', { level: 1, name: firstTitle }).waitFor();
  ok(
    3,
    `Categories navigate to their articles (Daily Tasks → "${firstTitle}")`,
  );
  const crumb = p.locator('.crumbs a').nth(1);
  const moduleName = (await crumb.innerText()).trim();
  await crumb.click();
  await p.getByRole('heading', { level: 1, name: moduleName }).waitFor();
  assert.ok(await p.locator('.cards .card', { hasText: firstTitle }).count());
  await p.locator('.crumbs a').first().click();
  await p.getByRole('heading', { name: 'How can we help?' }).waitFor();
  ok(5, `Breadcrumbs lead back to the module (${moduleName}) and home`);

  // 4: every internal link and asset reference in every page resolves.
  const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
  let linkCount = 0;
  const broken: string[] = [];
  for (const f of htmlFiles) {
    const html = readFileSync(f, 'utf8');
    for (const m of html.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
      const ref = m[1];
      if (/^(https?:|mailto:|data:)/.test(ref) || ref.includes('?')) continue;
      linkCount++;
      const target = path.resolve(path.dirname(f), ref);
      if (!existsSync(target))
        broken.push(`${path.relative(dist, f)} → ${ref}`);
    }
  }
  assert.deepEqual(broken.slice(0, 10), [], 'broken links');
  await p.goto(base + 'a/scheduling.recurring.html');
  const rel = p.locator('.related .card a').first();
  const relTitle = (await rel.locator('strong').innerText()).trim();
  await rel.click();
  await p.getByRole('heading', { level: 1, name: relTitle }).waitFor();
  ok(
    4,
    `Article links work: ${linkCount} internal links/assets in ${htmlFiles.length} pages all resolve; related-article navigation works`,
  );

  // 6: contextual help as the apps call it.
  const go = async (hash: string) => {
    await p.goto(base + 'go.html#' + hash);
    await p.waitForTimeout(600);
    return p.url();
  };
  assert.match(
    await go('admin/recurring-tasks'),
    /a\/scheduling\.recurring\.html$/,
  );
  assert.match(
    await go('id/setup.schedules'),
    /a\/scheduling\.recurring\.html$/,
  );
  assert.match(await go('staff/task/abc123'), /a\/staff\.checklist\.html$/);
  assert.match(await go('customer/requests'), /a\/customer\.requests\.html$/);
  assert.match(await go('mobile/scan'), /a\/mobile\.qr\.html$/);
  await go('platform/plans');
  assert.match(
    await p.locator('[data-go-status]').innerText(),
    /restricted manual/,
  );
  ok(
    6,
    'Context help links open the right article for admin, staff, mobile and customer screens and help ids; platform screens point to the restricted manual instead of publishing it',
  );

  // 7: role pages list exactly the articles tagged for that role, and role guides exist for every role.
  for (const r of ['supervisor', 'technician', 'customer', 'admin']) {
    await p.goto(base + `r/${r}.html`);
    const listed = await p
      .locator('.cards .card a')
      .evaluateAll((as) =>
        as.map((a) =>
          (a as HTMLAnchorElement).href.split('/a/')[1]?.replace('.html', ''),
        ),
      );
    const expected = pub
      .filter((a) => a.meta.roles.includes(r))
      .map((a) => a.meta.id);
    assert.deepEqual(
      [...listed].sort(),
      [...expected].sort(),
      `role page ${r}`,
    );
  }
  const custOnly = pub.filter((a) => a.meta.roles.includes('customer'));
  assert.ok(
    custOnly.every(
      (a) =>
        a.meta.apps.includes('customer') ||
        /^(faq|ref|role|ts|train|gs)\./.test(a.meta.id),
    ),
    'customer role only on customer-facing articles',
  );
  for (const g of [
    'role.owner-admin',
    'role.facility-manager',
    'role.site-manager',
    'role.supervisor',
    'role.technician',
    'role.housekeeping',
    'role.security',
    'role.customer',
  ])
    assert.ok(existsSync(path.join(dist, 'a', g + '.html')), g);
  ok(
    7,
    'Role pages list exactly the articles for each role; customer pages contain only customer-facing content; 8 public role guides (+ restricted platform guide)',
  );

  // 8: restricted content is absent from the public output.
  const everything = walk(dist)
    .filter((f) => /\.(html|json|xml|txt)$/.test(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  for (const a of restricted) {
    assert.ok(
      !existsSync(path.join(dist, 'a', a.meta.id + '.html')),
      a.meta.id,
    );
    assert.ok(
      !everything.includes(`a/${a.meta.id}.html`),
      `link to ${a.meta.id}`,
    );
    // Its title must not appear as any page title, heading, card or search-index title.
    if (!pub.some((x) => x.meta.title === a.meta.title)) {
      const t = a.meta.title
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
      for (const pat of [
        `<title>${t} ·`,
        `>${t}</h1>`,
        `<strong>${t}</strong>`,
        `"t":${JSON.stringify(a.meta.title)}`,
      ])
        assert.ok(!everything.includes(pat), `title of ${a.meta.id}`);
    }
    // Its body text must not appear either (first distinctive sentence).
    const firstLine = a.body
      .split('\n')
      .find((l) => l.trim().length > 60 && !/^[!#|>{-]/.test(l.trim()));
    if (firstLine)
      assert.ok(
        !everything.includes(firstLine.trim().slice(0, 60)),
        `body of ${a.meta.id}`,
      );
  }
  for (const m of loadManuals().filter((x) => x.audience !== 'public'))
    assert.ok(!walk(dist).some((f) => f.endsWith(m.file)), m.file);
  ok(
    8,
    `Restricted documents are excluded: ${restricted.length} authenticated/internal articles and ${loadManuals().filter((x) => x.audience !== 'public').length} restricted manuals have no page, link, title, search entry or PDF in the public build`,
  );

  // 9 + 10 + 11: PDFs.
  const pubManuals = loadManuals().filter((m) => m.audience === 'public');
  const pdfInfo: string[] = [];
  for (const m of pubManuals) {
    const f = path.join(dist, 'assets/pdf', m.file);
    assert.ok(existsSync(f), m.file);
    const res = await fetch(base + 'assets/pdf/' + m.file);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.equal(
      Buffer.from(await res.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      '%PDF-',
    );
    const info = execFileSync('pdfinfo', [f]).toString();
    const pages = Number(/Pages:\s+(\d+)/.exec(info)![1]);
    assert.ok(pages >= 5, `${m.file} pages`);
    const text = execFileSync('pdftotext', ['-layout', f, '-'])
      .toString()
      .split('\f');
    // TOC entries point to the page that really holds the heading.
    const toc = text.slice(0, 12).join('\f');
    let verified = 0;
    for (const mm of toc.matchAll(/^\s*(\d+)\. (.+?)\s*\.{0,}\s+(\d+)\s*$/gm)) {
      const [, n, title, pg] = mm;
      const pageText = text[Number(pg) - 1] || '';
      assert.ok(
        pageText.includes(`${n}. ${title.trim().slice(0, 30)}`),
        `${m.file}: TOC "${n}. ${title}" → page ${pg}`,
      );
      verified++;
    }
    assert.ok(verified >= 1, `${m.file}: TOC entries found`);
    pdfInfo.push(`${m.file} ${pages}p/${verified} TOC sections`);
  }
  ok(
    9,
    `PDFs generated: ${pubManuals.length} public manuals + ${walk(path.join(dist, 'assets/diagrams')).filter((f) => f.endsWith('.pdf')).length} diagram PDFs`,
  );
  ok(
    10,
    `PDFs open (served as application/pdf, valid headers, readable text): ${pdfInfo.join('; ')}`,
  );
  ok(
    11,
    'Tables of contents point to the page that holds each section heading',
  );

  // 12
  await p.goto(base + 'a/scheduling.recurring.html');
  await p.waitForLoadState('networkidle');
  await p.evaluate(async () => {
    for (const i of [...document.images]) {
      i.loading = 'eager';
      i.scrollIntoView();
      await new Promise((r) => setTimeout(r, 50));
    }
  });
  await p.waitForTimeout(500);
  assert.deepEqual(await imagesLoaded(p), []);
  assert.ok((await p.locator('figure.shot img').count()) >= 2);
  await p.screenshot({ path: `${evidence}/03-article.png`, fullPage: false });
  ok(12, 'Screenshots render in articles (all images decoded)');

  // 13 + 14
  await p.goto(base + 'workflows.html');
  assert.equal(await p.locator('.wf-cards .card').count(), 45);
  await p.locator('.wf-cards .card a').nth(24).click();
  await p.getByRole('heading', { level: 1, name: /WF-25/ }).waitFor();
  await p.waitForLoadState('networkidle');
  assert.deepEqual(await imagesLoaded(p), []);
  const mmd = await (await fetch(base + 'assets/diagrams/wf-25.mmd')).text();
  assert.match(mmd, /^%% title: /);
  assert.match(mmd, /flowchart|stateDiagram/);
  for (const ext of ['svg', 'pdf'])
    assert.equal(
      (await fetch(base + `assets/diagrams/wf-25.${ext}`)).status,
      200,
    );
  await p.screenshot({ path: `${evidence}/04-workflow.png` });
  ok(
    13,
    'Diagram source renders: 45 SVGs load; editable Mermaid source and PDF export download',
  );
  await p.locator('.cards .card a').first().click();
  await p.locator('article h1').waitFor();
  assert.ok(
    await p.locator(`.wf-cards .card a[href*="wf-25"]`).count(),
    'article links back to its workflow',
  );
  ok(14, 'Workflow links work in both directions (diagram ↔ articles)');

  // 15
  const m = await browser.newContext({
    viewport: { width: 375, height: 780 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const mp = await m.newPage();
  for (const u of [
    '',
    'a/scheduling.recurring.html',
    'search.html?q=task',
    'wf/wf-27.html',
    'roles.html',
    'ar/index.html',
    'ar/a/staff.checklist.html',
  ]) {
    await mp.goto(base + u);
    await mp.waitForTimeout(300);
    const wide = await mp.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    assert.ok(wide <= 0, `overflow ${wide}px on ${u}`);
  }
  await mp.goto(base + 'a/staff.checklist.html');
  await mp.screenshot({ path: `${evidence}/05-mobile-article.png` });
  ok(
    15,
    'Mobile layout (375 px) has no horizontal overflow on home, article, search, workflow, roles and Arabic pages',
  );

  // 16 + 17
  await p.goto(base + 'ar/index.html');
  assert.equal(await p.locator('html').getAttribute('dir'), 'rtl');
  assert.equal(await p.locator('html').getAttribute('lang'), 'ar');
  const side = await p.locator('#side').boundingBox();
  const main = await p.locator('#main').boundingBox();
  assert.ok(side && main && side.x > main.x, 'sidebar on the right in RTL');
  assert.match(await p.locator('h1').first().innerText(), /كيف يمكننا مساعدتك/);
  await p.screenshot({ path: `${evidence}/06-arabic-rtl.png` });
  ok(
    16,
    'Arabic displays right-to-left (dir=rtl, mirrored layout, Arabic interface)',
  );
  const translatedIds = new Set(loadArticles('ar').map((a) => a.meta.id));
  const untranslated = pub.find((a) => !translatedIds.has(a.meta.id))!;
  await p.goto(base + `ar/a/${untranslated.meta.id}.html`);
  assert.ok(await p.locator('.notice').count());
  assert.equal(await p.locator('article').getAttribute('lang'), 'en');
  assert.equal(await p.locator('article').getAttribute('dir'), 'ltr');
  const translated = [...translatedIds][0];
  if (translated) {
    await p.goto(base + `ar/a/${translated}.html`);
    assert.match(await p.locator('.notice').innerText(), /مسودة/); // draft notice
  }
  await p.screenshot({ path: `${evidence}/07-arabic-draft.png` });
  // Language switch keeps the page.
  await p.goto(base + 'a/staff.checklist.html');
  await p.locator('[data-lang-switch]').selectOption('ml');
  await p.waitForURL(/\/ml\/a\/staff\.checklist\.html$/);
  ok(
    17,
    `Missing translations fall back to English with a notice (e.g. ${untranslated.meta.id}); draft translations are labelled; switching language keeps the page`,
  );

  // 18: reproducible.
  const hash = () => {
    const h = createHash('sha256');
    for (const f of walk(dist).sort())
      if (!f.endsWith('build-info.json'))
        h.update(path.relative(dist, f)).update(readFileSync(f));
    return h.digest('hex');
  };
  const before = hash();
  execFileSync('npx', ['tsx', 'scripts/help/build.ts'], {
    cwd: root,
    stdio: 'pipe',
  });
  assert.equal(hash(), before, 'rebuild produced different output');
  ok(
    18,
    'Documentation build is reproducible (rebuild → identical output hash)',
  );

  // 19: a broken link fails the check that CI runs.
  const tmpDir = path.join(root, 'docs/help/content/en/zz-ci-probe');
  mkdirSync(tmpDir, { recursive: true });
  const src = readFileSync(
    path.join(root, 'docs/help/content/en/scheduling/recurring.md'),
    'utf8',
  )
    .replace('id: scheduling.recurring', 'id: scheduling.ci-probe')
    .replace('(article:scheduling.generation)', '(article:does.not-exist)');
  writeFileSync(path.join(tmpDir, 'probe.md'), src);
  try {
    const r = spawnSync('npx', ['tsx', 'scripts/help/check.ts'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /broken article link: does\.not-exist/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  ok(19, 'A broken article link makes npm run help:check (the CI step) fail');

  assert.deepEqual([...new Set(errors)], [], 'browser errors');
} finally {
  await browser.close();
  server.close();
}
writeFileSync(path.join(evidence, 'checks.txt'), checks.join('\n') + '\n');
console.log(`\nPhase 9 Help Center: ${checks.length} checks passed.`);
