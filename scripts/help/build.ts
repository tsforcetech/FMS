/**
 * Builds the public Help Center (apps/help-web/dist) from docs/help.
 *
 *   npx tsx scripts/help/build.ts            # validate, then build
 *
 * Only `audience: public` articles are written. Authenticated and internal
 * articles, their screenshots and their manuals are never copied into the
 * output — a static website cannot protect pages by hiding links, so
 * restricted material is simply not published (see docs/help/README.md).
 * The build refuses to run while `validate()` reports problems.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type Article, type Diagram, helpDir, loadArticles, loadManuals, renderMarkdown, root, slug, sortArticles, validate } from './lib.ts';
import { ui, type Lang } from './i18n.ts';

const { problems, site, articles: all, diagrams } = validate();
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p.file}: ${p.message}`);
  console.error(`\n${problems.length} problem(s). Fix them before building (npm run help:check).`);
  process.exit(1);
}
const out = path.join(root, 'apps/help-web/dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const pub = sortArticles(
  all.filter((a) => a.meta.audience === 'public'),
  site.order,
);
const pubIds = new Set(pub.map((a) => a.meta.id));
const commit = (() => {
  try {
    return process.env.GITHUB_SHA?.slice(0, 7) || execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
  } catch {
    return 'local';
  }
})();
const built = new Date().toISOString().slice(0, 10);
const translations = Object.fromEntries(
  site.languages.filter((l) => l.id !== 'en').map((l) => [l.id, new Map(loadArticles(l.id).map((t) => [t.meta.id, t]))]),
) as Record<string, Map<string, Article>>;
const manuals = loadManuals().filter((m) => m.audience === 'public');
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const moduleSlug = (m: string) => slug(m.replace(/&/g, 'and'));
const write = (rel: string, html: string) => {
  const f = path.join(out, rel);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, html);
};
const roleIds = ['owner', 'admin', 'site_manager', 'department_manager', 'supervisor', 'technician', 'staff', 'viewer', 'customer'] as const;

/* ------------------------------------------------------------------ assets */
mkdirSync(path.join(out, 'assets/screens'), { recursive: true });
mkdirSync(path.join(out, 'assets/diagrams'), { recursive: true });
const usedShots = new Set<string>();
for (const a of pub) {
  for (const s of a.meta.screenshots) usedShots.add(s);
  for (const m of a.body.matchAll(/\]\(screens\/([^)\s]+)\)/g)) usedShots.add(m[1]);
}
for (const s of usedShots) copyFileSync(path.join(helpDir, 'assets/screens', s), path.join(out, 'assets/screens', s));
for (const d of diagrams) {
  copyFileSync(path.join(helpDir, 'diagrams/svg', d.id + '.svg'), path.join(out, 'assets/diagrams', d.id + '.svg'));
  copyFileSync(path.join(helpDir, 'diagrams', d.id + '.mmd'), path.join(out, 'assets/diagrams', d.id + '.mmd'));
}
for (const f of ['help.css', 'help.js', 'favicon.svg']) copyFileSync(path.join(root, 'apps/help-web/static', f), path.join(out, 'assets', f));

/* ------------------------------------------------------------------ layout */
type PageOpts = { lang: Lang; rel: string; title: string; body: string; description?: string; sideModule?: string; articleLang?: string; noindex?: boolean };
const langPrefix = (l: Lang) => (l === 'en' ? '' : l + '/');
/** Relative path from page `rel` to the site root. */
const up = (rel: string) => '../'.repeat(rel.split('/').length - 1);
const href = (from: string, to: string) => up(from) + to;
const articlePath = (l: Lang, id: string) => `${langPrefix(l)}a/${id}.html`;
const visibleDiagramArticles = (d: Diagram) => d.articles.filter((id) => pubIds.has(id));

function layout(o: PageOpts) {
  const t = ui(o.lang);
  const dir = site.languages.find((l) => l.id === o.lang)!.dir;
  const h = (to: string) => href(o.rel, to);
  const lp = langPrefix(o.lang);
  const modules = site.modules
    .filter((m) => pub.some((a) => a.meta.module === m))
    .map((m) => `<li><a href="${h(`${lp}m/${moduleSlug(m)}.html`)}"${m === o.sideModule ? ' aria-current="page"' : ''}>${esc(t.module(m))}</a></li>`)
    .join('');
  const langs = site.languages
    .map((l) => `<option value="${l.id}"${l.id === o.lang ? ' selected' : ''}>${esc(l.label)}</option>`)
    .join('');
  return `<!doctype html>
<html lang="${o.lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(o.title)} · ${esc(t.helpCenter)}</title>
<meta name="description" content="${esc(o.description || t.tagline)}" />
${o.noindex ? '<meta name="robots" content="noindex" />' : ''}
<meta name="facilityos-docs-version" content="${esc(site.version)}" />
<link rel="icon" href="${h('assets/favicon.svg')}" type="image/svg+xml" />
<link rel="stylesheet" href="${h('assets/help.css')}" />
<script>try{var m=localStorage.getItem('fos-help-theme');if(m)document.documentElement.dataset.theme=m}catch(e){}</script>
</head>
<body data-root="${up(o.rel)}" data-lang="${o.lang}" data-lang-prefix="${lp}" data-page="${esc(o.rel.slice(lp.length))}">
<a class="skip" href="#main">${esc(t.skip)}</a>
<header class="top">
  <button class="menu-btn" type="button" aria-label="${esc(t.menu)}" aria-expanded="false" aria-controls="side">☰</button>
  <a class="brand" href="${h(lp + 'index.html')}"><img src="${h('assets/favicon.svg')}" alt="" width="28" height="28" /><span><strong>${esc(site.product)}</strong> ${esc(t.helpCenter)}</span></a>
  <form class="top-search" action="${h(lp + 'search.html')}" role="search">
    <input type="search" name="q" placeholder="${esc(t.searchPlaceholder)}" aria-label="${esc(t.search)}" autocomplete="off" />
  </form>
  <span class="version" title="${esc(site.versionLabel)}">v${esc(site.version)}</span>
  <label class="lang"><span class="sr">${esc(t.language)}</span><select data-lang-switch aria-label="${esc(t.language)}">${langs}</select></label>
  <button class="theme-btn" type="button" data-theme-toggle aria-label="${esc(t.theme)}">◐</button>
</header>
<div class="shell">
<nav id="side" class="side" aria-label="${esc(t.modules)}">
  <p class="side-h">${esc(t.browse)}</p>
  <ul class="side-links">
    <li><a href="${h(lp + 'index.html')}">${esc(t.home)}</a></li>
    <li><a href="${h(lp + 'workflows.html')}">${esc(t.workflows)}</a></li>
    <li><a href="${h(lp + 'manuals.html')}">${esc(t.manuals)}</a></li>
    <li><a href="${h(lp + 'roles.html')}">${esc(t.roles)}</a></li>
  </ul>
  <p class="side-h">${esc(t.modules)}</p>
  <ul class="side-links">${modules}</ul>
</nav>
<main id="main" class="main"${o.articleLang && o.articleLang !== o.lang ? ` lang="${o.articleLang}"` : ''}>
${o.body}
</main>
</div>
<footer class="foot">
  <p>${esc(site.versionLabel)} · ${esc(t.published)} ${esc(site.published)} · ${esc(t.build)} ${esc(commit)}</p>
  <p>${esc(t.footNote)}</p>
  <p>© ${esc(site.company)}</p>
</footer>
<script src="${h('assets/help.js')}" defer></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ pieces */
const card = (l: Lang, from: string, a: Article) => {
  const tr = translations[l]?.get(a.meta.id);
  return `<li class="card"><a href="${href(from, articlePath(l, a.meta.id))}"><strong>${esc(tr?.meta.title || a.meta.title)}</strong><span>${esc(tr?.meta.description || a.meta.description)}</span></a></li>`;
};
const cards = (l: Lang, from: string, list: Article[]) => `<ul class="cards">${list.map((a) => card(l, from, a)).join('')}</ul>`;
const wfCard = (l: Lang, from: string, d: Diagram) =>
  `<li class="card wf"><a href="${href(from, `${langPrefix(l)}wf/${d.id}.html`)}"><img src="${href(from, `assets/diagrams/${d.id}.svg`)}" alt="" loading="lazy" /><strong>${esc(d.id.toUpperCase())} · ${esc(d.title)}</strong></a></li>`;
const roleLabel = (l: Lang, r: string) => ui(l).role(r);
const appLabel = (l: Lang, a: string) => ui(l).app(a);

function articleHtml(l: Lang, a: Article, from: string) {
  const t = ui(l);
  const tr = translations[l]?.get(a.meta.id);
  const src = tr || a;
  const r = renderMarkdown(src.body, {
    link: (id) => href(from, articlePath(l, id)),
    shot: (f) => href(from, 'assets/screens/' + f),
    diagram: (id) => {
      const d = diagrams.find((x) => x.id === id)!;
      return `<figure class="diagram"><a href="${href(from, `${langPrefix(l)}wf/${id}.html`)}"><img src="${href(from, `assets/diagrams/${id}.svg`)}" alt="${esc(d.title)}" loading="lazy" /></a><figcaption>${esc(id.toUpperCase())} · ${esc(d.title)}</figcaption></figure>`;
    },
  });
  const notice =
    l === 'en'
      ? ''
      : !tr
        ? `<p class="notice" role="note">${esc(t.fallbackNotice)}</p>`
        : tr.meta.translationStatus !== 'reviewed'
          ? `<p class="notice" role="note">${esc(t.draftNotice)}</p>`
          : '';
  const m = a.meta;
  const list = (h: string, items?: string[]) => (items?.length ? `<section class="box"><h2>${esc(h)}</h2><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : '');
  const related = (m.related || []).filter((id) => pubIds.has(id)).map((id) => pub.find((x) => x.meta.id === id)!);
  const wfs = [...new Set([...(m.diagrams || [])])].map((id) => diagrams.find((d) => d.id === id)!);
  const siblings = pub.filter((x) => x.meta.module === m.module);
  const toc = r.headings.filter((x) => x.level === 2);
  return {
    title: src.meta.title,
    html: `<nav class="crumbs" aria-label="${esc(t.breadcrumb)}"><a href="${href(from, langPrefix(l) + 'index.html')}">${esc(t.home)}</a> › <a href="${href(from, `${langPrefix(l)}m/${moduleSlug(m.module)}.html`)}">${esc(t.module(m.module))}</a></nav>
<div class="article-grid">
<article class="article" data-article-id="${esc(m.id)}"${!tr && l !== 'en' ? ' lang="en" dir="ltr"' : ''}>
  <h1>${esc(src.meta.title)}</h1>
  <p class="lede">${esc(src.meta.description)}</p>
  ${notice}
  <p class="chips">${m.apps.map((x) => `<span class="chip">${esc(appLabel(l, x))}</span>`).join('')}${m.roles.map((x) => `<span class="chip chip-role">${esc(roleLabel(l, x))}</span>`).join('')}</p>
  ${list(t.prerequisites, m.prerequisites)}
  ${list(t.permissions, m.permissions)}
  <div class="prose">${r.html}</div>
  ${related.length ? `<section class="related"><h2>${esc(t.related)}</h2>${cards(l, from, related)}</section>` : ''}
  ${wfs.length ? `<section class="related"><h2>${esc(t.workflows)}</h2><ul class="cards wf-cards">${wfs.map((d) => wfCard(l, from, d)).join('')}</ul></section>` : ''}
  <p class="meta-line">${esc(t.appliesTo)} ${esc(site.product)} ${esc(m.version)}+ · ${esc(t.reviewed)} ${esc(m.reviewed)} · ${esc(t.owner)}: ${esc(m.owner)} · <span class="mono">${esc(m.id)}</span> · <button type="button" class="link-btn" data-print>${esc(t.print)}</button></p>
</article>
<aside class="aside">
  ${toc.length > 1 ? `<nav class="toc" aria-label="${esc(t.onThisPage)}"><p class="side-h">${esc(t.onThisPage)}</p><ul>${toc.map((x) => `<li><a href="#${x.id}">${esc(x.text)}</a></li>`).join('')}</ul></nav>` : ''}
  <nav class="toc" aria-label="${esc(t.inThisModule)}"><p class="side-h">${esc(t.inThisModule)}</p><ul>${siblings.map((x) => `<li><a href="${href(from, articlePath(l, x.meta.id))}"${x === a ? ' aria-current="page"' : ''}>${esc(translations[l]?.get(x.meta.id)?.meta.title || x.meta.title)}</a></li>`).join('')}</ul></nav>
</aside>
</div>`,
    text: r.text,
    headings: r.headings,
  };
}

/* ------------------------------------------------------------------ pages */
const sitemap: string[] = [];
const searchIndex: Record<string, unknown[]> = {};
for (const lang of site.languages) {
  const l = lang.id as Lang;
  const t = ui(l);
  const lp = langPrefix(l);
  const idx: unknown[] = [];
  const add = (rel: string, html: string, title: string, o: Partial<PageOpts> = {}) => {
    write(rel, layout({ lang: l, rel, title, body: html, ...o }));
    if (!o.noindex) sitemap.push(site.baseUrl + rel);
  };

  // Articles
  for (const a of pub) {
    const rel = articlePath(l, a.meta.id);
    const r = articleHtml(l, a, rel);
    add(rel, r.html, r.title, { description: a.meta.description, sideModule: a.meta.module });
    const tr = translations[l]?.get(a.meta.id);
    idx.push({
      u: rel.slice(lp.length),
      t: r.title,
      d: tr?.meta.description || a.meta.description,
      m: a.meta.module,
      k: [...(a.meta.keywords || []), ...(a.meta.helpIds || []), a.meta.id].join(' '),
      h: r.headings.map((x) => x.text).join(' · '),
      b: r.text.slice(0, 2500),
      r: a.meta.roles,
      a: a.meta.apps,
    });
  }
  // Modules
  for (const mod of site.modules) {
    const list = pub.filter((a) => a.meta.module === mod);
    if (!list.length) continue;
    const rel = `${lp}m/${moduleSlug(mod)}.html`;
    const wfs = diagrams.filter((d) => visibleDiagramArticles(d).some((id) => list.some((a) => a.meta.id === id)));
    add(
      rel,
      `<nav class="crumbs"><a href="${href(rel, lp + 'index.html')}">${esc(t.home)}</a></nav><h1>${esc(t.module(mod))}</h1><p class="lede">${esc(t.articlesCount(list.length))}</p>${cards(l, rel, list)}${wfs.length ? `<h2>${esc(t.workflows)}</h2><ul class="cards wf-cards">${wfs.map((d) => wfCard(l, rel, d)).join('')}</ul>` : ''}`,
      t.module(mod),
      { sideModule: mod },
    );
  }
  // Categories
  for (const c of site.categories) {
    const list = pub.filter((a) => a.meta.category === c.id);
    const rel = `${lp}c/${c.id}.html`;
    const groups = site.modules
      .map((m) => [m, list.filter((a) => a.meta.module === m)] as const)
      .filter(([, x]) => x.length)
      .map(([m, x]) => `<h2>${esc(t.module(m))}</h2>${cards(l, rel, x)}`)
      .join('');
    add(rel, `<nav class="crumbs"><a href="${href(rel, lp + 'index.html')}">${esc(t.home)}</a></nav><h1>${esc(t.category(c.id, c.label))}</h1>${groups || `<p>${esc(t.noArticles)}</p>`}`, t.category(c.id, c.label));
  }
  // Roles
  {
    const rel = `${lp}roles.html`;
    const guides = pub.filter((a) => a.meta.module === 'Role Guides');
    const per = roleIds
      .map((r) => {
        const n = pub.filter((a) => a.meta.roles.includes(r)).length;
        return `<li class="card"><a href="${href(rel, `${lp}r/${r}.html`)}"><strong>${esc(roleLabel(l, r))}</strong><span>${esc(t.articlesCount(n))}</span></a></li>`;
      })
      .join('');
    add(rel, `<h1>${esc(t.roles)}</h1><p class="lede">${esc(t.rolesIntro)}</p><h2>${esc(t.roleGuides)}</h2>${cards(l, rel, guides)}<h2>${esc(t.byRole)}</h2><ul class="cards">${per}</ul>`, t.roles);
    for (const r of roleIds) {
      const relR = `${lp}r/${r}.html`;
      const list = pub.filter((a) => a.meta.roles.includes(r));
      const groups = site.modules
        .map((m) => [m, list.filter((a) => a.meta.module === m)] as const)
        .filter(([, x]) => x.length)
        .map(([m, x]) => `<h2>${esc(t.module(m))}</h2>${cards(l, relR, x)}`)
        .join('');
      add(relR, `<nav class="crumbs"><a href="${href(relR, lp + 'roles.html')}">${esc(t.roles)}</a></nav><h1>${esc(roleLabel(l, r))}</h1>${groups}`, roleLabel(l, r));
    }
  }
  // Workflows
  {
    const rel = `${lp}workflows.html`;
    add(rel, `<h1>${esc(t.workflows)}</h1><p class="lede">${esc(t.workflowsIntro)}</p><ul class="cards wf-cards">${diagrams.map((d) => wfCard(l, rel, d)).join('')}</ul>`, t.workflows);
    for (const d of diagrams) {
      const relW = `${lp}wf/${d.id}.html`;
      const arts = visibleDiagramArticles(d).map((id) => pub.find((a) => a.meta.id === id)!);
      add(
        relW,
        `<nav class="crumbs"><a href="${href(relW, lp + 'workflows.html')}">${esc(t.workflows)}</a></nav>
<h1>${esc(d.id.toUpperCase())} · ${esc(d.title)}</h1>
<figure class="diagram diagram-full"><img src="${href(relW, `assets/diagrams/${d.id}.svg`)}" alt="${esc(d.title)}" /></figure>
<p class="downloads"><a class="btn" href="${href(relW, `assets/diagrams/${d.id}.svg`)}" download>SVG</a> <a class="btn" href="${href(relW, `assets/diagrams/${d.id}.pdf`)}" download>PDF</a> <a class="btn" href="${href(relW, `assets/diagrams/${d.id}.mmd`)}" download>${esc(t.mermaidSource)}</a></p>
<p class="muted">${esc(t.legend)}</p>
${arts.length ? `<h2>${esc(t.relatedArticles)}</h2>${cards(l, relW, arts)}` : ''}`,
        d.title,
      );
      idx.push({ u: `wf/${d.id}.html`, t: `${d.id.toUpperCase()} · ${d.title}`, d: t.workflowDiagram, m: t.workflows, k: d.id, h: '', b: '', r: [], a: [] });
    }
  }
  // Manuals
  {
    const rel = `${lp}manuals.html`;
    const items = manuals
      .map((m) => `<li class="card"><a href="${href(rel, `assets/pdf/${m.file}`)}" download><strong>${esc(m.title)}</strong><span>${esc(m.subtitle)}</span><span class="pdf-meta" data-pdf="${esc(m.file)}">PDF</span></a></li>`)
      .join('');
    add(rel, `<h1>${esc(t.manuals)}</h1><p class="lede">${esc(t.manualsIntro)}</p><ul class="cards">${items}</ul><p class="muted">${esc(t.manualsNote)}</p>`, t.manuals);
  }
  // Search page
  add(`${lp}search.html`, `<h1>${esc(t.search)}</h1><form class="big-search" role="search"><input type="search" name="q" data-search-input placeholder="${esc(t.searchPlaceholder)}" aria-label="${esc(t.search)}" autofocus /></form><p class="muted" data-search-status data-word="${esc(t.results)}" data-none="${esc(t.noResults)}" aria-live="polite"></p><ol class="results" data-search-results></ol>`, t.search, { noindex: true });
  // Home
  {
    const rel = `${lp}index.html`;
    const byId = (id: string) => pub.find((a) => a.meta.id === id)!;
    const cats = site.categories
      .map((c) => `<li class="card cat"><a href="${href(rel, `${lp}c/${c.id}.html`)}"><span class="icon icon-${c.icon}" aria-hidden="true"></span><strong>${esc(t.category(c.id, c.label))}</strong><span>${esc(t.articlesCount(pub.filter((a) => a.meta.category === c.id).length))}</span></a></li>`)
      .join('');
    const news = site.whatsNew
      .map((w) => `<li><strong>${esc(site.product)} ${esc(w.version)}</strong> <span class="muted">${esc(w.date)}</span><br />${esc(w.text)} ${w.articles.map((id) => `<a href="${href(rel, articlePath(l, id))}">${esc(byId(id).meta.title)}</a>`).join(' · ')}</li>`)
      .join('');
    add(
      rel,
      `<section class="hero"><h1>${esc(t.heroTitle)}</h1><p>${esc(t.tagline)}</p><form class="big-search" action="${href(rel, lp + 'search.html')}" role="search"><input type="search" name="q" placeholder="${esc(t.searchPlaceholder)}" aria-label="${esc(t.search)}" /><button class="btn btn-primary" type="submit">${esc(t.search)}</button></form><p class="muted">${esc(site.versionLabel)}</p></section>
<h2>${esc(t.categories)}</h2><ul class="cards cats">${cats}</ul>
<div class="two"><section><h2>${esc(t.popular)}</h2>${cards(l, rel, site.home.popular.map(byId))}</section><section><h2>${esc(t.gettingStarted)}</h2>${cards(l, rel, site.home.gettingStarted.map(byId))}</section></div>
<h2>${esc(t.keyWorkflows)}</h2><ul class="cards wf-cards">${site.home.workflows.map((id) => wfCard(l, rel, diagrams.find((d) => d.id === id)!)).join('')}</ul>
<div class="two"><section><h2>${esc(t.whatsNew)}</h2><ul class="news">${news}</ul></section><section><h2>${esc(t.manuals)}</h2><ul class="plain">${manuals.map((m) => `<li><a href="${href(rel, `assets/pdf/${m.file}`)}" download>${esc(m.title)}</a></li>`).join('')}</ul><p><a href="${href(rel, lp + 'manuals.html')}">${esc(t.allManuals)} →</a></p></section></div>`,
      t.helpCenter,
    );
  }
  // Contextual help resolver
  add(`${lp}go.html`, `<h1>${esc(t.opening)}</h1><p data-go-status data-restricted="${esc(t.restricted)}">${esc(t.openingText)}</p><noscript><p><a href="${href(`${lp}go.html`, lp + 'index.html')}">${esc(t.home)}</a></p></noscript>`, t.opening, { noindex: true });
  add(`${lp}404.html`, `<h1>${esc(t.notFound)}</h1><p>${esc(t.notFoundText)}</p><p><a class="btn" href="${href(`${lp}404.html`, lp + 'search.html')}">${esc(t.search)}</a></p>`, t.notFound, { noindex: true });
  searchIndex[l] = idx;
}
// 404 at root must work from any depth: GitHub Pages serves /FMS/404.html only for the whole site,
// so the Help Center's own 404 is reachable for links inside it.

/* ------------------------------------------------------------------ data */
const helpMap = {
  version: site.version,
  screens: site.screens,
  helpIds: Object.fromEntries(pub.flatMap((a) => [[a.meta.id, a.meta.id], ...(a.meta.helpIds || []).map((h) => [h, a.meta.id])])),
  public: [...pubIds],
  restricted: all.filter((a) => a.meta.audience !== 'public').map((a) => a.meta.id),
};
write('assets/help-map.json', JSON.stringify(helpMap));
for (const [l, idx] of Object.entries(searchIndex)) write(`assets/search-${l}.json`, JSON.stringify(idx));
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${site.published}</lastmod></url>`).join('\n')}\n</urlset>\n`,
);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}sitemap.xml\n`);
const info = {
  product: site.product,
  version: site.version,
  versionLabel: site.versionLabel,
  published: site.published,
  built,
  commit,
  articles: { public: pub.length, restrictedExcluded: all.length - pub.length },
  diagrams: diagrams.length,
  screenshots: usedShots.size,
  languages: Object.fromEntries(site.languages.map((x) => [x.id, x.id === 'en' ? pub.length : [...(translations[x.id]?.values() || [])].filter((t) => pubIds.has(t.meta.id)).length])),
};
write('build-info.json', JSON.stringify(info, null, 2));
// Generated PDFs (help:pdf) are copied in when present.
const pdfDir = path.join(root, 'apps/help-web/pdf');
if (existsSync(pdfDir)) {
  mkdirSync(path.join(out, 'assets/pdf'), { recursive: true });
  for (const f of readdirSync(pdfDir)) {
    const target = f.startsWith('wf-') ? path.join(out, 'assets/diagrams', f) : path.join(out, 'assets/pdf', f);
    copyFileSync(path.join(pdfDir, f), target);
  }
}
// Guard: nothing restricted may have leaked into the output.
const leaked = all.filter((a) => a.meta.audience !== 'public').filter((a) => existsSync(path.join(out, 'a', a.meta.id + '.html')));
const indexText = Object.values(searchIndex).map((x) => JSON.stringify(x)).join('');
const leakedIds = all.filter((a) => a.meta.audience !== 'public').filter((a) => indexText.includes(`"a/${a.meta.id}.html"`));
if (leaked.length || leakedIds.length) {
  console.error('Restricted article leaked into the public build:', [...leaked, ...leakedIds].map((a) => a.meta.id));
  process.exit(1);
}
console.log(`Help Center built: ${pub.length} public articles (${all.length - pub.length} restricted excluded), ${diagrams.length} diagrams, ${usedShots.size} screenshots, ${site.languages.length} languages → ${path.relative(root, out)}`);
