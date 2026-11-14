/**
 * Generates the Phase 2 Firestore rule validators and composite indexes from
 * the shared definitions, so the browser schema and the server rules cannot
 * drift apart. `rules-sync.test.ts` fails if the checked-in files differ.
 * Regenerate with: GENERATE_RULES=1 npx vitest run packages/shared/src/rules-sync.test.ts
 */
import {
  definitions,
  fieldsFor,
  statuses,
  phase2Kinds,
  countedReferences,
  type FieldSpec,
  type Kind,
  type Phase2Kind,
  isAssignment,
} from './operations';

const regex: Record<string, string> = {
  code: "'^[A-Z0-9][A-Z0-9_-]{0,39}$'",
  integer: "'^(0|[1-9][0-9]{0,6})$'",
  decimal: "'^(0|[1-9][0-9]{0,8})([.][0-9]{1,3})?$'",
  money: "'^(0|[1-9][0-9]{0,9})([.][0-9]{1,2})?$'",
  uid: "'^[A-Za-z0-9]{1,128}$'",
  time: "'^([01][0-9]|2[0-3]):[0-5][0-9]$'",
};
const meta = [
  'companyId',
  'schemaVersion',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'revision',
  'refCount',
  'witnessKind',
  'witnessId',
];
const list = (xs: string[]) => '[' + xs.map((x) => `'${x}'`).join(',') + ']';
const DATE = '[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])';
/**
 * Field checks are grouped to stay inside Firestore's 1,000-expression budget
 * per request: several IDs or dates are joined with '~' and checked by one
 * regex (concatenation also fails for non-strings, so types stay enforced),
 * and free-text fields share one combined length bound.
 */
function fieldRules(fields: FieldSpec[]) {
  const rules: string[] = [];
  const joined = (fs: FieldSpec[], part: (f: FieldSpec) => string) =>
    fs.length
      ? `(${fs.map((f) => `d.${f.key}`).join("+'~'+")}).matches('^${fs.map(part).join('~')}$')`
      : '';
  const ids = fields.filter((f) => f.reference);
  rules.push(joined(ids, (f) => `[a-zA-Z0-9_-]{${f.required ? 1 : 0},128}`));
  const dates = fields.filter((f) => f.type === 'date');
  rules.push(joined(dates, (f) => (f.required ? `(${DATE})` : `(${DATE})?`)));
  for (const f of fields) {
    const v = `d.${f.key}`;
    if (f.reference || f.type === 'date') continue;
    if (f.key === 'workingDays')
      rules.push(
        `(${v}=='' || (${v}.split(',').size()<=7 && ${v}.split(',').toSet().hasOnly(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])))`,
      );
    else if (f.options) rules.push(`${v} in ${list(f.options)}`);
    else if (f.type === 'integer')
      rules.push(
        `${v}.matches('^${f.required ? '' : '$|^'}(0|[1-9][0-9]{0,6})$') && (${v}=='' || (int(${v})>=${f.minValue ?? 0} && int(${v})<=${f.maxValue ?? 9999999}))`,
      );
    else if (f.type && regex[f.type])
      rules.push(
        `${v}.matches(${f.required ? regex[f.type] : regex[f.type].replace("'^", "'^$|^")})`,
      );
  }
  const texts = fields.filter(
    (f) =>
      !f.reference &&
      !f.options &&
      f.key !== 'workingDays' &&
      (!f.type || f.type === 'email' || f.type === 'textarea'),
  );
  if (texts.length) {
    const limit = texts.reduce(
      (n, f) => n + (f.max || (f.type === 'textarea' ? 2000 : 200)),
      0,
    );
    rules.push(
      `(${texts.map((f) => `d.${f.key}`).join('+')}).size()<=${limit}` +
        texts
          .filter((f) => f.required)
          .map((f) => ` && d.${f.key}.size()>0`)
          .join(''),
    );
  }
  return rules.filter(Boolean);
}
function extraKeys(kind: Kind) {
  return kind === 'assets' ? ['lastTransferId'] : [];
}
export function shapeFunction(kind: Kind) {
  const fields = fieldsFor(kind).filter(
    (f) => !['code', 'name', 'notes', 'status'].includes(f.key),
  );
  const keys = [
    ...meta,
    'code',
    'name',
    'notes',
    'status',
    ...fields.map((f) => f.key),
    ...extraKeys(kind),
  ];
  return (
    `  function shape_${kind}(d){return d.keys().hasOnly(${list(keys)}) && d.status in ${list(statuses(kind))}` +
    fieldRules(fields)
      .map((r) => ' && ' + r)
      .join('') +
    ';}'
  );
}
export function generatedMatches() {
  const lines = ['  // BEGIN GENERATED PHASE 2 MATCHES — do not edit by hand.'];
  for (const k of phase2Kinds)
    lines.push(
      `   match /${k}/{id} {`,
      `    allow create: if admin(companyId) && activeCompany(companyId) && create_${k}(companyId,id,request.resource.data);`,
      `    allow update: if admin(companyId) && activeCompany(companyId) && (request.resource.data.refCount!=resource.data.refCount ? counter_${k}(companyId,id) : update_${k}(companyId,id,request.resource.data,resource.data));`,
      '   }',
    );
  lines.push('  // END GENERATED PHASE 2 MATCHES');
  return lines.join('\n');
}
export function generatedRules() {
  const lines: string[] = [];
  lines.push('  // BEGIN GENERATED PHASE 2 VALIDATORS — do not edit by hand.');
  lines.push(
    '  // Source: packages/shared/src/operations.ts via rules-generator.ts.',
  );
  for (const k of phase2Kinds) lines.push(shapeFunction(k));
  lines.push(`  function known2(k){return k in ${list([...phase2Kinds])};}`);
  const extra: Partial<Record<Phase2Kind, string>> = {
    assets: 'extraAsset(c,id,d)',
    teamMembers: 'extraAssignment(d)',
    siteAssignments: 'extraAssignment(d)',
    shiftAssignments: 'extraAssignment(d)',
    stores: 'extraStore(c,d)',
    departments: "extraParent(c,'departments',id,d)",
    assetCategories: "extraParent(c,'assetCategories',id,d)",
    employees: 'd.supervisorId!=id',
    leaveRecords: 'd.endDate>=d.startDate',
    shifts: 'd.startTime!=d.endTime',
  };
  const targets: Record<string, Record<string, string>> = {};
  for (const w of phase2Kinds)
    for (const f of countedReferences(w)) {
      targets[f.reference!] ||= {};
      if (targets[f.reference!][w])
        throw new Error(`${w} references ${f.reference} twice`);
      targets[f.reference!][w] = f.key;
    }
  // One dedicated function set per kind: no dispatch chains, which Firestore
  // charges against the per-request expression budget.
  for (const k of phase2Kinds) {
    const refs = countedReferences(k);
    const rel = refs.length
      ? refs
          .map((f) => `ref2(c,'${k}',id,'${f.key}','${f.reference}',creating)`)
          .join(' && ')
      : 'true';
    const x = extra[k] ? ` && ${extra[k]}` : '';
    lines.push(
      `  function create_${k}(c,id,d){return create2(c,'${k}',id) && shape_${k}(d)${x} && ${rel.replaceAll('creating', 'true')};}`,
    );
    const immutable = definitions[k].fields
      .filter((f) => f.immutable)
      .map((f) => f.key);
    lines.push(
      `  function update_${k}(c,id,d,b){return update2(c,'${k}',id) && shape_${k}(d)${x} && ${rel.replaceAll('creating', 'false')}` +
        (immutable.length
          ? ` && !d.diff(b).affectedKeys().hasAny(${list(immutable)})`
          : '') +
        (refs.length > 1
          ? ` && d.diff(b).affectedKeys().intersection(${list(refs.map((f) => f.key))}.toSet()).size()<=1`
          : '') +
        (isAssignment(k) ? ` && (live2('${k}',b) || !live2('${k}',d))` : '') +
        (k === 'assets' ? ' && assetMove(c,id,b,d)' : '') +
        ';}',
    );
  }
  for (const t of [...phase2Kinds, 'sites', 'locations']) {
    const m = targets[t] || {};
    const body = Object.entries(m)
      .map(
        ([w, f]) =>
          `w=='${w}'?counter2Move(id,w,'${f}',witnessBefore(c,w,wid),witnessAfter(c,w,wid)):`,
      )
      .join('');
    lines.push(
      `  function counter_${t}(c,id){return counterFor(c,id,request.resource.data.witnessKind,request.resource.data.witnessId);}`.replace(
        'counterFor',
        `counterIn_${t}`,
      ),
    );
    lines.push(`  function counterIn_${t}(c,id,w,wid){return ${body}false;}`);
  }
  lines.push('  // END GENERATED PHASE 2 VALIDATORS');
  return lines.join('\n');
}
type Index = {
  collectionGroup: string;
  queryScope: 'COLLECTION';
  fields: { fieldPath: string; order: 'ASCENDING' | 'DESCENDING' }[];
};
const asc = (fieldPath: string) => ({ fieldPath, order: 'ASCENDING' as const });
const desc = (fieldPath: string) => ({
  fieldPath,
  order: 'DESCENDING' as const,
});
/** Composite indexes for every Phase 2 list, filter and selector query. */
export function generatedIndexes(): Index[] {
  const out: Index[] = [];
  const add = (collectionGroup: string, fields: Index['fields']) =>
    out.push({ collectionGroup, queryScope: 'COLLECTION', fields });
  for (const k of phase2Kinds) {
    add(k, [asc('status'), asc('name')]);
    const filters = definitions[k].fields
      .filter((f) => f.reference)
      .map((f) => f.key);
    if (k === 'assets') filters.push('assetClass');
    for (const f of filters) {
      add(k, [asc(f), asc('name')]);
      add(k, [asc('status'), asc(f), asc('name')]);
    }
  }
  for (const f of ['materialId', 'movementType', 'fromStoreId', 'toStoreId'])
    add('stockMovements', [asc(f), desc('createdAt')]);
  add('assetTransfers', [asc('assetId'), desc('createdAt')]);
  return out;
}
