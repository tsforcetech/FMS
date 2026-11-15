/**
 * Documentation validation for CI (npm run help:check). Fails on broken
 * article links, missing or duplicate ids, missing screenshots or diagrams,
 * routes that no longer exist in the apps, app screens without help, help ids
 * used by the apps without an article, and public → restricted links.
 */
import { validate } from './lib.ts';

const { problems, articles, diagrams } = validate();
for (const p of problems) console.error(`✗ ${p.file}: ${p.message}`);
const by = (a: string) => articles.filter((x) => x.meta.audience === a).length;
console.log(`${articles.length} articles (public ${by('public')}, authenticated ${by('authenticated')}, internal ${by('internal')}), ${diagrams.length} diagrams.`);
if (problems.length) {
  console.error(`${problems.length} documentation problem(s).`);
  process.exit(1);
}
console.log('Documentation check passed.');
