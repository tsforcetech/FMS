/**
 * Renders every docs/help/diagrams/*.mmd to diagrams/svg/<id>.svg with Mermaid
 * running in headless Chromium (no network needed). Fails on any syntax error.
 *   npx tsx scripts/help/diagrams.ts [wf-01 ...]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { chromiumOptions, helpDir, loadDiagrams, root } from './lib.ts';

const only = process.argv.slice(2);
const out = path.join(helpDir, 'diagrams/svg');
mkdirSync(out, { recursive: true });
const mermaidJs = readFileSync(path.join(root, 'node_modules/mermaid/dist/mermaid.min.js'), 'utf8');
const browser = await chromium.launch(chromiumOptions());
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: mermaidJs });
await page.evaluate(() => {
  // @ts-expect-error mermaid global
  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    theme: 'base',
    fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
    flowchart: { htmlLabels: false, curve: 'basis', useMaxWidth: true },
    themeVariables: { primaryColor: '#e8f1fb', primaryBorderColor: '#2f6fb3', lineColor: '#5b6b7d', fontSize: '14px' },
  });
});
let failed = 0;
for (const d of loadDiagrams().filter((x) => !only.length || only.includes(x.id))) {
  const src = d.source
    .split('\n')
    .filter((l) => !/^%%\s*(title|articles|sources):/.test(l))
    .join('\n');
  const res = await page.evaluate(
    async ({ id, src }) => {
      try {
        // @ts-expect-error mermaid global
        const { svg } = await window.mermaid.render('m' + id.replace(/\W/g, ''), src);
        return { svg };
      } catch (e) {
        return { error: String((e as Error).message || e) };
      }
    },
    { id: d.id, src },
  );
  if (res.error || !res.svg) {
    failed++;
    console.error(`✗ ${d.id}: ${res.error}`);
    continue;
  }
  // Mermaid already sets role/aria attributes; add a title element for accessibility and validate as XML below.
  const svg = res.svg.replace(/(<svg[^>]*>)/, `$1<title>${d.title.replace(/[<&]/g, '')}</title>`);
  writeFileSync(path.join(out, d.id + '.svg'), `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generated from ${d.file} by npm run help:diagrams. Edit the .mmd source, not this file. -->\n${svg}\n`);
  const xmlError = await page.evaluate((x) => {
    const doc = new DOMParser().parseFromString(x, 'image/svg+xml');
    return doc.querySelector('parsererror')?.textContent || '';
  }, svg);
  if (xmlError) {
    failed++;
    console.error(`✗ ${d.id}: SVG is not valid XML: ${xmlError}`);
    continue;
  }
  console.log(`✓ ${d.id} ${d.title}`);
}
await browser.close();
if (failed) {
  console.error(`${failed} diagram(s) failed`);
  process.exit(1);
}
