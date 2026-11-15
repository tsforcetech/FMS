/**
 * Generates the PDF manuals and per-diagram PDFs from docs/help with headless
 * Chromium — the same articles, screenshots and diagrams as the website.
 *
 *   npx tsx scripts/help/pdf.ts [manualId ...]
 *
 * Public manuals and diagram PDFs → apps/help-web/pdf/ (copied into the site by
 * the build). Authenticated/internal manuals → docs/help/.restricted/ (git-ignored,
 * never published). Each manual has a cover, revision information, a contents
 * page with page numbers (two-pass render), numbered sections, a glossary and
 * page numbers in the footer.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { type Article, chromiumOptions, helpDir, loadManuals, manualContents, renderMarkdown, root, validate } from './lib.ts';

const { problems, site, articles, diagrams } = validate();
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p.file}: ${p.message}`);
  console.error(`${problems.length} documentation problem(s) — fix them first (npm run help:check).`);
  process.exit(1);
}
const only = process.argv.slice(2);
const pubOut = path.join(root, 'apps/help-web/pdf');
const restrictedOut = path.join(helpDir, '.restricted');
const tmp = path.join(root, 'apps/help-web/.pdf-tmp');
for (const d of [pubOut, restrictedOut, tmp]) mkdirSync(d, { recursive: true });
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fileUrl = (p: string) => pathToFileURL(p).href;
const commit = (() => {
  try {
    return process.env.GITHUB_SHA?.slice(0, 7) || execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
  } catch {
    return 'local';
  }
})();
const generated = new Date().toISOString().slice(0, 10);
const byId = new Map(articles.map((a) => [a.meta.id, a]));
const css = `
@page { size: A4; margin: 18mm 16mm 20mm 16mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 'Noto Sans', 'DejaVu Sans', Arial, sans-serif; color: #17212b; margin: 0; }
h1, h2, h3, h4 { line-height: 1.25; color: #10243a; }
a { color: #1f5a98; text-decoration: none; }
.cover { height: 255mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
.cover .band { background: #2f6fb3; color: #fff; padding: 28mm 14mm 16mm; border-radius: 6px; }
.cover h1 { color: #fff; font-size: 30pt; margin: 0 0 6mm; }
.cover .sub { font-size: 14pt; opacity: .92; }
.cover .facts td { padding: 2mm 6mm 2mm 0; }
.class { display: inline-block; padding: 1mm 4mm; border-radius: 3mm; font-weight: 700; border: 1px solid; }
.class-public { color: #1d6b3f; } .class-restricted { color: #a3361b; }
.page { page-break-after: always; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { display: flex; align-items: baseline; gap: 2mm; margin: 1mm 0; }
.toc li.sec { font-weight: 700; margin-top: 3mm; }
.toc li .dots { flex: 1; border-bottom: 1px dotted #9aa8b6; transform: translateY(-1mm); }
.toc li.art { padding-left: 8mm; font-size: 9.5pt; }
.toc .pg { min-width: 8mm; text-align: right; }
section.sec { page-break-before: always; }
section.sec > h1 { font-size: 22pt; border-bottom: 2px solid #2f6fb3; padding-bottom: 2mm; }
article { margin-top: 8mm; }
article + article { page-break-before: always; }
article > h2 { font-size: 16pt; margin: 0 0 1mm; }
.desc { color: #5b6b7d; margin: 0 0 3mm; }
.mark { font-size: 1px; color: #fff; }
.facts-box { border: 1px solid #dbe3ec; border-radius: 2mm; padding: 1mm 4mm; margin: 2mm 0; font-size: 9.5pt; }
.facts-box h4 { margin: 2mm 0 1mm; }
.prose h3 { font-size: 13pt; margin-top: 6mm; }
.prose h4 { font-size: 11pt; }
.prose img, figure img { max-width: 100%; max-height: 120mm; display: block; margin: 0 auto; border: 1px solid #dbe3ec; border-radius: 2mm; }
figure { margin: 4mm 0; page-break-inside: avoid; }
figcaption { font-size: 8.5pt; color: #5b6b7d; text-align: center; margin-top: 1mm; }
.diagram-embed img { max-height: 200mm; border: 0; }
.callout { border-left: 3pt solid #2f6fb3; background: #eef4fb; padding: 1mm 4mm; margin: 3mm 0; page-break-inside: avoid; }
.callout-warning { border-color: #c27c0e; background: #fff6e6; } .callout-tip { border-color: #2e8b57; background: #ebf7f0; }
.table-wrap { margin: 3mm 0; }
table { border-collapse: collapse; width: 100%; font-size: 9pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #dbe3ec; padding: 1.2mm 2mm; text-align: left; vertical-align: top; }
th { background: #eef3f9; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: 9pt; background: #f1f4f8; padding: 0 1mm; }
.wf-page { page-break-before: always; }
.wf-page img { max-height: 225mm; max-width: 100%; display: block; margin: 0 auto; }
.muted { color: #5b6b7d; }
`;

function articleBlock(a: Article, num: string, inManual: Set<string>, restricted: boolean) {
  const r = renderMarkdown(a.body, {
    link: (id) => (inManual.has(id) ? `#a-${id}` : byId.get(id)?.meta.audience === 'public' ? `${site.baseUrl}a/${id}.html` : '#'),
    shot: (f) => fileUrl(path.join(helpDir, 'assets/screens', f)),
    diagram: (id) => {
      const d = diagrams.find((x) => x.id === id)!;
      return `<figure><img src="${fileUrl(path.join(helpDir, 'diagrams/svg', id + '.svg'))}" alt="${esc(d.title)}" /><figcaption>${esc(id.toUpperCase())} · ${esc(d.title)}</figcaption></figure>`;
    },
  });
  // Demote article headings one level below the article title.
  const html = r.html.replace(/<(\/?)h([1-5])(\s|>)/g, (_m, s: string, n: string, e: string) => `<${s}h${Math.min(6, Number(n) + 1)}${e}`);
  const m = a.meta;
  const box = (h: string, x?: string[]) => (x?.length ? `<h4>${esc(h)}</h4><ul>${x.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
  const facts = box('Before you start', m.prerequisites) + box('Who can do this', m.permissions);
  void restricted;
  return `<article id="a-${esc(m.id)}"><span class="mark">§§${esc(m.id)}§§</span><h2>${esc(num)} ${esc(m.title)}</h2><p class="desc">${esc(m.description)}</p>${facts ? `<div class="facts-box">${facts}</div>` : ''}<div class="prose">${html}</div><p class="muted" style="font-size:8pt">Article ${esc(m.id)} · applies to ${esc(site.product)} ${esc(m.version)}+ · reviewed ${esc(m.reviewed)}</p></article>`;
}

const browser = await chromium.launch({ ...chromiumOptions(), args: ['--no-sandbox'] });
const page = await browser.newPage();
const results: { file: string; pages: number; audience: string }[] = [];

async function render(html: string, out: string, title: string, restricted: boolean, landscape = false) {
  const f = path.join(tmp, path.basename(out) + '.html');
  writeFileSync(f, html);
  await page.goto(fileUrl(f), { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r))))));
  });
  const small = 'font-size:7.5pt;color:#5b6b7d;width:100%;padding:0 16mm;font-family:Arial,sans-serif;display:flex;justify-content:space-between';
  await page.pdf({
    path: out,
    format: 'A4',
    landscape,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="${small}"><span>${esc(title)}</span><span>${restricted ? 'RESTRICTED — not for public distribution' : esc(site.versionLabel)}</span></div>`,
    footerTemplate: `<div style="${small}"><span>${esc(site.company)} · ${esc(site.product)} ${esc(site.version)}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    margin: { top: '18mm', bottom: '18mm', left: '0', right: '0' },
    outline: true,
    tagged: true,
  } as Parameters<typeof page.pdf>[0]);
}
const pagesOf = (pdf: string) => execFileSync('pdftotext', ['-layout', pdf, '-']).toString().split('\f');

for (const man of loadManuals().filter((m) => !only.length || only.includes(m.id))) {
  const restricted = man.audience !== 'public';
  const sections = manualContents(man, articles, diagrams, site.order);
  const inManual = new Set(sections.flatMap((s) => s.articles.map((a) => a.meta.id)));
  const glossary = byId.get('ref.glossary');
  if (glossary && !inManual.has('ref.glossary')) {
    sections.push({ title: 'Glossary', articles: [glossary], diagrams: [] });
    inManual.add('ref.glossary');
  }
  const numbered = sections.map((s, i) => ({ ...s, n: i + 1 }));
  const toc = (pages: Map<string, number>) =>
    `<section class="page toc"><h1>Contents</h1><ol>${numbered
      .map(
        (s) =>
          `<li class="sec"><a href="#s-${s.n}">${s.n}. ${esc(s.title)}</a><span class="dots"></span><span class="pg">${pages.get(`s${s.n}`) ?? ''}</span></li>` +
          s.articles.map((a, j) => `<li class="art"><a href="#a-${esc(a.meta.id)}">${s.n}.${j + 1} ${esc(a.meta.title)}</a><span class="dots"></span><span class="pg">${pages.get(a.meta.id) ?? ''}</span></li>`).join('') +
          s.diagrams.map((d, j) => `<li class="art"><a href="#d-${d.id}">${s.n}.${s.articles.length + j + 1} ${esc(d.id.toUpperCase())} ${esc(d.title)}</a><span class="dots"></span><span class="pg">${pages.get(d.id) ?? ''}</span></li>`).join(''),
      )
      .join('')}</ol></section>`;
  const cover = `<section class="cover"><div class="band"><div style="font-size:11pt;letter-spacing:.08em">${esc(site.product.toUpperCase())} · ${esc(site.company.toUpperCase())}</div><h1>${esc(man.title)}</h1><div class="sub">${esc(man.subtitle)}</div></div>
<table class="facts"><tr><td>Product version</td><td><strong>${esc(site.versionLabel)}</strong></td></tr><tr><td>Published</td><td>${esc(site.published)}</td></tr><tr><td>Generated</td><td>${esc(generated)} from documentation build ${esc(commit)}</td></tr><tr><td>Classification</td><td><span class="class ${restricted ? 'class-restricted' : 'class-public'}">${restricted ? (man.audience === 'internal' ? 'INTERNAL — Sharaco staff only' : 'RESTRICTED — Sharaco platform staff') : 'PUBLIC'}</span></td></tr><tr><td>Online version</td><td>${restricted ? 'Not published online' : `<a href="${site.baseUrl}">${esc(site.baseUrl)}</a>`}</td></tr></table></section>`;
  const revision = `<section class="page"><h1>Revision information</h1><table><thead><tr><th>Document</th><th>Value</th></tr></thead><tbody><tr><td>Title</td><td>${esc(man.title)}</td></tr><tr><td>Applies to</td><td>${esc(site.versionLabel)}</td></tr><tr><td>Generated</td><td>${esc(generated)} (build ${esc(commit)})</td></tr><tr><td>Content</td><td>${inManual.size} articles, ${numbered.reduce((n, s) => n + s.diagrams.length, 0)} workflow diagrams</td></tr><tr><td>Source</td><td>Generated from the FacilityOS Help Center sources (docs/help). The website and this manual always contain the same text.</td></tr></tbody></table>
<h2>Product revision history</h2><table><thead><tr><th>Version</th><th>Date</th><th>Changes</th></tr></thead><tbody>${site.whatsNew.map((w) => `<tr><td>${esc(w.version)}</td><td>${esc(w.date)}</td><td>${esc(w.text)}</td></tr>`).join('')}</tbody></table>
<h2>Conventions</h2><p>Menu paths are shown in bold, for example <strong>Task management → Recurring tasks</strong>. Notes, tips and warnings are shown in coloured boxes. In workflow diagrams the responsible role is shown in brackets, for example [Supervisor]; steps marked "(pending activation)" depend on infrastructure that is not switched on yet.</p>
${restricted ? '<p><strong>Restricted document.</strong> Do not publish or forward outside Sharaco. It contains procedures only — never passwords, keys or customer data.</p>' : ''}</section>`;
  const body = numbered
    .map(
      (s) =>
        `<section class="sec" id="s-${s.n}"><span class="mark">§§s${s.n}§§</span><h1>${s.n}. ${esc(s.title)}</h1>` +
        s.articles.map((a, j) => articleBlock(a, `${s.n}.${j + 1}`, inManual, restricted)).join('') +
        s.diagrams
          .map((d, j) => {
            const arts = d.articles.filter((id) => inManual.has(id) || byId.get(id)?.meta.audience === 'public');
            return `<div class="wf-page" id="d-${d.id}"><span class="mark">§§${d.id}§§</span><h2>${s.n}.${s.articles.length + j + 1} ${esc(d.id.toUpperCase())} · ${esc(d.title)}</h2><img src="${fileUrl(path.join(helpDir, 'diagrams/svg', d.id + '.svg'))}" alt="${esc(d.title)}" />${arts.length ? `<p class="muted">Described in: ${arts.map((id) => esc(byId.get(id)!.meta.title)).join(' · ')}</p>` : ''}</div>`;
          })
          .join('') +
        '</section>',
    )
    .join('');
  const doc = (pages: Map<string, number>) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(man.title)}</title><style>${css}</style></head><body>${cover}${revision}${toc(pages)}${body}</body></html>`;
  const out = path.join(restricted ? restrictedOut : pubOut, man.file);
  // Pass 1: find the page of every section/article/diagram marker.
  await render(doc(new Map()), out, man.title, restricted);
  const pages = new Map<string, number>();
  pagesOf(out).forEach((text, i) => {
    for (const m of text.matchAll(/§§([a-z0-9.-]+)§§/g)) if (!pages.has(m[1])) pages.set(m[1], i + 1);
  });
  // Pass 2: same layout, with page numbers filled in.
  await render(doc(pages), out, man.title, restricted);
  const final = pagesOf(out);
  const missing = [...inManual].filter((id) => !pages.has(id));
  if (missing.length) throw Error(`${man.id}: articles not found in the PDF: ${missing.join(', ')}`);
  results.push({ file: path.relative(root, out), pages: final.length - (final.at(-1)?.trim() ? 0 : 1), audience: man.audience });
  console.log(`✓ ${man.title}: ${results.at(-1)!.pages} pages, ${inManual.size} articles → ${path.relative(root, out)}`);
}

// One PDF per workflow diagram (public; diagrams describe product behaviour only).
if (!only.length || only.includes('diagrams'))
  for (const d of diagrams) {
    const svg = readFileSync(path.join(helpDir, 'diagrams/svg', d.id + '.svg'), 'utf8');
    const vb = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg);
    const landscape = !!vb && Number(vb[1]) > Number(vb[2]) * 1.1;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 14mm; } body{display:flex;flex-direction:column;height:${landscape ? 180 : 265}mm} img{flex:1;min-height:0;object-fit:contain;width:100%}</style></head><body><h2 style="margin:0 0 2mm">${esc(d.id.toUpperCase())} · ${esc(d.title)}</h2><p class="muted" style="margin:0 0 3mm;font-size:8.5pt">${esc(site.versionLabel)} · generated from ${esc(d.file)} · ${esc(generated)}</p><img src="${fileUrl(path.join(helpDir, 'diagrams/svg', d.id + '.svg'))}" alt="${esc(d.title)}"></body></html>`;
    const f = path.join(tmp, d.id + '.html');
    writeFileSync(f, html);
    await page.goto(fileUrl(f));
    await page.pdf({ path: path.join(pubOut, d.id + '.pdf'), format: 'A4', landscape, printBackground: true, preferCSSPageSize: true });
  }
await browser.close();
rmSync(tmp, { recursive: true, force: true });
writeFileSync(path.join(pubOut, 'manifest.json'), JSON.stringify({ generated, commit, version: site.version, manuals: results.filter((r) => r.audience === 'public') }, null, 2));
console.log(`PDF manuals: ${results.length}; diagram PDFs: ${only.length && !only.includes('diagrams') ? 0 : diagrams.length}.`);
