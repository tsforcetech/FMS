/**
 * Phase 9 documentation pipeline — shared loader and validator.
 * Reads docs/help (articles, translations, diagrams, screenshots, site.yaml,
 * manuals.yaml) and the real application routes, and reports every problem
 * that would make the Help Center or the manuals wrong or broken.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Marked, type Tokens } from 'marked';

export const root = path.resolve(import.meta.dirname, '../..');
export const helpDir = path.join(root, 'docs/help');
export type Audience = 'public' | 'authenticated' | 'internal';
export const roles = ['owner', 'admin', 'site_manager', 'department_manager', 'supervisor', 'technician', 'staff', 'viewer', 'customer', 'platform'] as const;
export const appsList = ['admin', 'staff', 'mobile', 'customer', 'platform'] as const;

export type Meta = {
  id: string;
  title: string;
  module: string;
  category: string;
  audience: Audience;
  apps: string[];
  roles: string[];
  version: string;
  reviewed: string;
  owner: string;
  description: string;
  routes: string[];
  helpIds?: string[];
  prerequisites?: string[];
  permissions?: string[];
  screenshots: string[];
  diagrams?: string[];
  related?: string[];
  sources: string[];
  keywords?: string[];
  // translations
  translationOf?: string;
  translatedFrom?: string;
  translationStatus?: 'draft' | 'reviewed';
};
export type Article = { meta: Meta; body: string; file: string; lang: string };
export type Diagram = { id: string; title: string; articles: string[]; sources: string[]; source: string; file: string };
export type Site = {
  product: string;
  company: string;
  version: string;
  versionLabel: string;
  published: string;
  languages: { id: string; label: string; dir: 'ltr' | 'rtl' }[];
  modules: string[];
  categories: { id: string; label: string; icon: string }[];
  home: { popular: string[]; gettingStarted: string[]; workflows: string[] };
  whatsNew: { version: string; date: string; text: string; articles: string[] }[];
  screens: Record<string, Record<string, string>>;
};
export type Manual = { id: string; title: string; subtitle: string; audience: Audience; file: string; sections: { title: string; articles?: string[]; modules?: string[]; diagrams?: string[] | 'all'; roles?: string[] }[] };

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });
}
export function splitFrontMatter(text: string, file: string): { meta: Meta; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${file}: missing front matter`);
  return { meta: parseYaml(m[1]) as Meta, body: m[2] };
}
export function loadSite(): Site {
  return parseYaml(readFileSync(path.join(helpDir, 'site.yaml'), 'utf8')) as Site;
}
export function loadManuals(): Manual[] {
  return (parseYaml(readFileSync(path.join(helpDir, 'manuals.yaml'), 'utf8')) as { manuals: Manual[] }).manuals;
}
export function loadArticles(lang = 'en'): Article[] {
  const dir = lang === 'en' ? path.join(helpDir, 'content/en') : path.join(helpDir, 'locales', lang);
  return walk(dir).map((file) => {
    const { meta, body } = splitFrontMatter(readFileSync(file, 'utf8'), file);
    return { meta, body, file: path.relative(root, file), lang };
  });
}
export function loadDiagrams(): Diagram[] {
  const dir = path.join(helpDir, 'diagrams');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.mmd'))
    .sort()
    .map((f) => {
      const source = readFileSync(path.join(dir, f), 'utf8');
      const head = (k: string) => (new RegExp(`^%%\\s*${k}:\\s*(.*)$`, 'm').exec(source)?.[1] || '').trim();
      return {
        id: f.replace(/\.mmd$/, ''),
        title: head('title'),
        articles: head('articles').split(',').map((s) => s.trim()).filter(Boolean),
        sources: head('sources').split(',').map((s) => s.trim()).filter(Boolean),
        source,
        file: path.relative(root, path.join(dir, f)),
      };
    });
}
export function screenshotFiles() {
  const dir = path.join(helpDir, 'assets/screens');
  return new Set(existsSync(dir) ? readdirSync(dir) : []);
}

/** Routes that really exist in the applications (from their source). */
export function appRoutes(): Record<string, Set<string>> {
  const nav = readFileSync(path.join(root, 'apps/admin-web/src/nav.ts'), 'utf8');
  const admin = new Set<string>();
  // Page ids: entries that carry a label (group ids are skipped by requiring `icon`).
  for (const m of nav.matchAll(/\{\s*id:\s*'([^']*)',\s*label:\s*'[^']+',\s*icon:/g)) admin.add(m[1]);
  for (const m of nav.matchAll(/id:\s*'([^']*)',\s*\n\s*label:\s*'[^']+',\s*\n\s*icon:/g)) admin.add(m[1]);
  admin.add('join');
  const routesIn = (file: string) => {
    const s = readFileSync(path.join(root, file), 'utf8');
    return new Set([...s.matchAll(/<Route\s+path="([^"*]+)"/g)].map((m) => m[1]));
  };
  return {
    admin,
    staff: routesIn('apps/staff-web/src/App.tsx'),
    mobile: routesIn('apps/mobile/src/App.tsx'),
    customer: routesIn('apps/customer-web/src/App.tsx'),
    platform: routesIn('apps/platform-web/src/App.tsx'),
  };
}
const routeKey = (app: string, r: string) => (app === 'admin' ? r.replace(/^\//, '').split('?')[0] : r);

/** Markdown links and embeds used in a body. */
export function refsOf(body: string) {
  return {
    articles: [...body.matchAll(/\]\(article:([a-z0-9.-]+)(?:#[^)]*)?\)/g)].map((m) => m[1]),
    screens: [...body.matchAll(/\]\(screens\/([^)\s]+)\)/g)].map((m) => m[1]),
    diagrams: [...body.matchAll(/^\{\{diagram (wf-\d+)\}\}\s*$/gm)].map((m) => m[1]),
    placeholders: [...body.matchAll(/\b(TODO|TBD|lorem ipsum|coming soon|placeholder)\b/gi)].map((m) => m[0]),
  };
}

export type Problem = { file: string; message: string };
const required: (keyof Meta)[] = ['id', 'title', 'module', 'category', 'audience', 'apps', 'roles', 'version', 'reviewed', 'owner', 'description', 'routes', 'screenshots', 'sources'];
/**
 * Validates everything. Returns problems (empty = good). Used by the build
 * (which refuses to publish with problems) and by CI.
 */
export function validate() {
  const problems: Problem[] = [];
  const site = loadSite();
  const articles = loadArticles();
  const diagrams = loadDiagrams();
  const shots = screenshotFiles();
  const routes = appRoutes();
  const byId = new Map<string, Article>();
  const p = (file: string, message: string) => problems.push({ file, message });
  for (const a of articles) {
    const m = a.meta;
    for (const k of required) if (m[k] === undefined || m[k] === null || m[k] === '') p(a.file, `missing ${k}`);
    if (!/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(m.id || '')) p(a.file, `invalid id ${m.id}`);
    if (byId.has(m.id)) p(a.file, `duplicate id ${m.id} (also ${byId.get(m.id)!.file})`);
    byId.set(m.id, a);
    if (!site.modules.includes(m.module)) p(a.file, `unknown module "${m.module}"`);
    if (!site.categories.some((c) => c.id === m.category)) p(a.file, `unknown category "${m.category}"`);
    if (!['public', 'authenticated', 'internal'].includes(m.audience)) p(a.file, `invalid audience ${m.audience}`);
    for (const x of m.apps || []) if (!(appsList as readonly string[]).includes(x)) p(a.file, `unknown app ${x}`);
    for (const x of m.roles || []) if (!(roles as readonly string[]).includes(x)) p(a.file, `unknown role ${x}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(m.reviewed))) p(a.file, 'reviewed must be YYYY-MM-DD');
    for (const r of m.routes || []) {
      const app = (m.apps || []).find((x) => routes[x]?.has(routeKey(x, r)));
      if (!app) p(a.file, `route ${r} does not exist in ${(m.apps || []).join('/')}`);
    }
    for (const s of m.sources || []) if (!existsSync(path.join(root, s))) p(a.file, `source not found: ${s}`);
    for (const s of m.screenshots || []) if (!shots.has(s)) p(a.file, `screenshot missing: ${s}`);
    if (m.audience !== 'internal' && !(m.screenshots || []).length && !/^(faq|ref|ts)\./.test(m.id)) p(a.file, 'needs at least one screenshot');
    const refs = refsOf(a.body);
    for (const s of refs.screens) if (!shots.has(s)) p(a.file, `body screenshot missing: ${s}`);
    for (const d of [...(m.diagrams || []), ...refs.diagrams]) if (!diagrams.some((x) => x.id === d)) p(a.file, `diagram missing: ${d}`);
    for (const ph of refs.placeholders) p(a.file, `placeholder text: "${ph}"`);
    if (a.body.trim().length < 400 && !/^(ref)\./.test(m.id)) p(a.file, 'article body too short to be useful');
  }
  for (const a of articles) {
    const links = [...(a.meta.related || []), ...refsOf(a.body).articles];
    for (const id of links) {
      const t = byId.get(id);
      if (!t) p(a.file, `broken article link: ${id}`);
      else if (a.meta.audience === 'public' && t.meta.audience !== 'public') p(a.file, `public article links to ${t.meta.audience} article ${id}`);
    }
  }
  for (const d of diagrams) {
    if (!d.title) p(d.file, 'missing %% title');
    for (const id of d.articles) if (!byId.has(id)) p(d.file, `diagram references unknown article ${id}`);
    for (const s of d.sources) if (!existsSync(path.join(root, s))) p(d.file, `source not found: ${s}`);
    if (!existsSync(path.join(helpDir, 'diagrams/svg', d.id + '.svg'))) p(d.file, 'SVG export missing (run npm run help:diagrams)');
  }
  // Coverage: every implemented screen maps to an existing article.
  for (const [app, set] of Object.entries(routes))
    for (const r of set) {
      const key = app === 'admin' ? r : r;
      const id = site.screens[app]?.[key];
      if (!id) p('docs/help/site.yaml', `screen not covered: ${app} ${r || '/'}`);
      else if (!byId.has(id)) p('docs/help/site.yaml', `coverage for ${app} ${r} points to missing article ${id}`);
    }
  for (const id of [...site.home.popular, ...site.home.gettingStarted, ...site.whatsNew.flatMap((w) => w.articles)])
    if (byId.get(id)?.meta.audience !== 'public') p('docs/help/site.yaml', `home/what's new references non-public or missing article ${id}`);
  for (const d of site.home.workflows) if (!diagrams.some((x) => x.id === d)) p('docs/help/site.yaml', `home workflow missing ${d}`);
  // Help ids used in the apps must resolve.
  for (const id of usedHelpIds()) if (!articles.some((a) => a.meta.id === id || (a.meta.helpIds || []).includes(id))) p('apps', `contextual help id has no article: ${id}`);
  // Manuals.
  for (const man of loadManuals())
    for (const s of man.sections) for (const id of s.articles || []) if (!byId.has(id)) p('docs/help/manuals.yaml', `${man.id}: unknown article ${id}`);
  // Translations.
  for (const lang of site.languages.filter((l) => l.id !== 'en'))
    for (const t of loadArticles(lang.id)) {
      if (!byId.has(t.meta.id)) p(t.file, `translation of unknown article ${t.meta.id}`);
      if (!['draft', 'reviewed'].includes(t.meta.translationStatus || '')) p(t.file, 'translationStatus must be draft or reviewed');
    }
  return { problems, site, articles, diagrams };
}
/** `data-help="..."` and helpUrl('...') identifiers used by the applications. */
export function usedHelpIds() {
  const ids = new Set<string>();
  const scan = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) {
        if (!['node_modules', 'dist', 'android', 'ios', 'generated'].includes(f)) scan(p);
      } else if (/\.(tsx?|ts)$/.test(f)) {
        const s = readFileSync(p, 'utf8');
        for (const m of s.matchAll(/(?:helpArticle|helpUrl)\(\s*'([a-z0-9.-]+)'/g)) ids.add(m[1]);
      }
    }
  };
  for (const app of ['admin-web', 'staff-web', 'mobile', 'customer-web', 'platform-web']) scan(path.join(root, 'apps', app, 'src'));
  return ids;
}

/* ------------------------------------------------------------------ rendering */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function slug(s: string) {
  return s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9؀-ۿऀ-ॿഀ-ൿ]+/g, '-').replace(/^-|-$/g, '');
}
export type Rendered = { html: string; headings: { id: string; text: string; level: number }[]; text: string };
/**
 * Markdown → HTML for the site and the PDFs. `link(id)` maps article ids to
 * URLs, `shot(file)` maps screenshots, `diagram(id)` returns embedded HTML.
 */
export function renderMarkdown(body: string, o: { link: (id: string) => string; shot: (f: string) => string; diagram: (id: string) => string }): Rendered {
  const headings: Rendered['headings'] = [];
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const text = this.parser.parseInline(tokens);
        const id = slug(text);
        if (depth <= 3) headings.push({ id, text: text.replace(/<[^>]+>/g, ''), level: depth });
        return `<h${depth} id="${id}">${text}</h${depth}>`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens);
        if (href.startsWith('article:')) {
          const [id, hash] = href.slice(8).split('#');
          return `<a href="${o.link(id)}${hash ? '#' + hash : ''}" data-article="${id}">${text}</a>`;
        }
        const ext = /^https?:/.test(href);
        return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${ext ? ' rel="noopener" target="_blank"' : ''}>${text}</a>`;
      },
      image({ href, text }: Tokens.Image) {
        const src = href.startsWith('screens/') ? o.shot(href.slice(8)) : href;
        return `<figure class="shot"><img src="${esc(src)}" alt="${esc(text)}" loading="lazy" /><figcaption>${esc(text)}</figcaption></figure>`;
      },
      blockquote({ tokens }: Tokens.Blockquote) {
        const inner = this.parser.parse(tokens);
        const kind = /^<p><strong>(Note|Tip|Warning):<\/strong>/.exec(inner)?.[1]?.toLowerCase() || 'note';
        return `<aside class="callout callout-${kind}">${inner}</aside>`;
      },
      table(token: Tokens.Table) {
        const head = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join('');
        const rows = token.rows.map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`).join('');
        return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
      },
    },
  });
  const withDiagrams = body.replace(/^\{\{diagram (wf-\d+)\}\}\s*$/gm, (_, id: string) => `\n<div class="diagram-embed">${o.diagram(id)}</div>\n`);
  const html = md.parse(withDiagrams, { async: false }) as string;
  const text = html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  return { html, headings, text };
}
