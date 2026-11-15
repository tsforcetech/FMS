/**
 * Contextual help (Phase 9). Every app links to the Help Center's resolver
 * page (`go.html`), which maps a screen or help id to the right article using
 * the coverage map in docs/help/site.yaml. The apps therefore never hard-code
 * article URLs, and `npm run help:check` fails when a screen has no article or
 * a help id used here has no article.
 */
export const DEFAULT_HELP_URL = 'https://tsforcetech.github.io/FMS/help/';
export type HelpApp = 'admin' | 'staff' | 'mobile' | 'customer' | 'platform';

const helpLangs = ['ml', 'hi', 'ar'];
const base = (url?: string, lang?: string) => {
  const b = url || DEFAULT_HELP_URL;
  const l = lang && helpLangs.includes(lang) ? lang + '/' : '';
  return (b.endsWith('/') ? b : b + '/') + l;
};
/** Help for an application screen: admin uses its page id, the others their route path. */
export function helpScreenUrl(
  app: HelpApp,
  route: string,
  url?: string,
  lang?: string,
) {
  const r = route.replace(/^\/+/, '').split('?')[0];
  return `${base(url, lang)}go.html#${app}/${encodeURI(r)}`;
}
/** Help for a specific article or help identifier, e.g. helpUrl('ts.sync-conflict'). */
export function helpUrl(id: string, url?: string, lang?: string) {
  return `${base(url, lang)}go.html#id/${encodeURIComponent(id)}`;
}
