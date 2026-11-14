import { readFileSync, writeFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { generatedRules, generatedIndexes } from './rules-generator';

const rulesPath = 'firebase/firestore.rules';
const indexPath = 'firebase/firestore.indexes.json';
const begin = '  // BEGIN GENERATED PHASE 2 VALIDATORS';
const end = '  // END GENERATED PHASE 2 VALIDATORS';
describe('Firestore rules and indexes stay in sync with shared schemas', () => {
  it('rules contain the generated Phase 2 validators', () => {
    const rules = readFileSync(rulesPath, 'utf8');
    const start = rules.indexOf(begin),
      stop = rules.indexOf(end);
    expect(start).toBeGreaterThan(0);
    const current = rules.slice(start, stop + end.length);
    if (process.env.GENERATE_RULES && current !== generatedRules())
      writeFileSync(
        rulesPath,
        rules.slice(0, start) +
          generatedRules() +
          rules.slice(stop + end.length),
      );
    else expect(current).toBe(generatedRules());
  });
  it('index file covers every generated Phase 2 query', () => {
    const file = JSON.parse(readFileSync(indexPath, 'utf8'));
    const key = (i: { collectionGroup: string; fields: unknown[] }) =>
      i.collectionGroup + JSON.stringify(i.fields);
    const present = new Set(file.indexes.map(key));
    const missing = generatedIndexes().filter((i) => !present.has(key(i)));
    if (process.env.GENERATE_RULES && missing.length) {
      file.indexes.push(...missing);
      writeFileSync(indexPath, JSON.stringify(file, null, 2) + '\n');
    } else expect(missing).toEqual([]);
  });
});
