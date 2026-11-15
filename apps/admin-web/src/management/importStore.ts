import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  balanceId,
  definitions,
  importColumns,
  parseQuantity,
  referencedKinds,
  unitDecimals,
  type ImportContext,
  type ImportModule,
  type ImportRow,
  type Kind,
  type Values,
} from '@facilityos/shared';
import { postMovement, recordById, saveRecord, UserError } from './store';

/**
 * Phase 8 Import Center data layer.
 *
 *  - Existing records are found only through codeClaims/{kind}_{CODE}, the
 *    same unique index the forms use, so matching is exact and company-scoped.
 *  - Every row is written with the normal audited store functions (one
 *    transaction per row): validation, reference counters, plan quotas and
 *    security rules all apply exactly as for manual entry.
 *  - The session id is derived from the module and the file hash, so
 *    re-uploading the same file is recognised; finished rows are skipped on
 *    resume and code claims make a repeated create impossible.
 *  - Opening stock goes through the stock ledger (an "opening" movement with a
 *    deterministic id); balances are never written directly.
 */
export type SessionRow = {
  row: number;
  status: string;
  result:
    'created' | 'updated' | 'unchanged' | 'failed' | 'skipped' | 'pending';
  id?: string;
  error?: string;
};
export type ImportSession = {
  id: string;
  module: ImportModule;
  fileName: string;
  fileHash: string;
  status: 'validated' | 'importing' | 'completed' | 'partial' | 'cancelled';
  counts: Record<string, number>;
  rows: SessionRow[];
  mapping: Record<string, number>;
  createdBy: string;
  createdAt?: { toDate(): Date };
  updatedAt?: { toDate(): Date };
  note: string;
};
const sessions = (db: Firestore, c: string) =>
  collection(db, 'companies', c, 'importSessions');
export const sessionId = (module: string, hash: string) =>
  `${module}_${hash.slice(0, 40)}`;

async function inChunks<T, R>(
  items: T[],
  size: number,
  fn: (x: T) => Promise<R>,
) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}
async function claim(db: Firestore, c: string, kind: Kind, code: string) {
  const s = await getDoc(
    doc(db, 'companies', c, 'codeClaims', `${kind}_${code}`),
  );
  return s.exists() ? (s.data().recordId as string) : null;
}
/** Builds the exact-match context for the codes that appear in the file. */
export async function loadContext(
  db: Firestore,
  c: string,
  module: ImportModule,
  rows: string[][],
  map: Record<string, number>,
): Promise<ImportContext> {
  const cols = importColumns(module);
  const valuesOf = (key: string) => {
    const at = map[key];
    return at === undefined
      ? []
      : [
          ...new Set(
            rows
              .map((r) =>
                String(r[at] ?? '')
                  .trim()
                  .toUpperCase(),
              )
              .filter(Boolean),
          ),
        ];
  };
  const refs: ImportContext['refs'] = {};
  for (const kind of referencedKinds(module)) {
    const keys = cols.filter((x) => x.reference === kind).map((x) => x.key);
    const codes = [...new Set(keys.flatMap(valuesOf))];
    const m = new Map<string, string>();
    await inChunks(codes, 40, async (code) => {
      const id = await claim(db, c, kind, code);
      if (id) m.set(code, id);
    });
    refs[kind] = m;
  }
  const existing: ImportContext['existing'] = new Map();
  if (module === 'openingStock') {
    const at = (k: string) => map[k];
    const pairs = new Set<string>();
    for (const r of rows) {
      const s = refs.stores?.get(
        String(r[at('storeCode')] ?? '')
          .trim()
          .toUpperCase(),
      );
      const m = refs.materials?.get(
        String(r[at('materialCode')] ?? '')
          .trim()
          .toUpperCase(),
      );
      if (s && m) pairs.add(`${s}|${m}`);
    }
    await inChunks([...pairs], 40, async (p) => {
      const [s, m] = p.split('|');
      const b = await getDoc(
        doc(db, 'companies', c, 'stockBalances', balanceId(s, m)),
      );
      if (b.exists()) existing.set(p, { id: b.id, values: {} });
    });
    return { existing, refs };
  }
  await inChunks(valuesOf('code'), 40, async (code) => {
    const id = await claim(db, c, module, code);
    if (!id) return;
    const r = await recordById(db, c, module, id);
    if (r) existing.set(code, { id, values: r.values });
  });
  return { existing, refs };
}

export async function getSession(db: Firestore, c: string, id: string) {
  const s = await getDoc(doc(sessions(db, c), id));
  return s.exists() ? ({ id: s.id, ...s.data() } as ImportSession) : null;
}
export async function listSessions(db: Firestore, c: string) {
  const r = await getDocs(
    query(sessions(db, c), orderBy('updatedAt', 'desc'), limit(50)),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as ImportSession);
}
/** Records the validated preview (dry run). Nothing else is written. */
export async function saveDryRun(
  db: Firestore,
  c: string,
  uid: string,
  input: {
    module: ImportModule;
    fileName: string;
    fileHash: string;
    mapping: Record<string, number>;
    rows: ImportRow[];
    counts: Record<string, number>;
  },
) {
  const id = sessionId(input.module, input.fileHash);
  const prior = await getSession(db, c, id);
  if (prior && ['importing', 'completed', 'partial'].includes(prior.status))
    return prior;
  const data = {
    companyId: c,
    module: input.module,
    fileName: input.fileName.slice(0, 200),
    fileHash: input.fileHash,
    status: 'validated' as const,
    counts: input.counts,
    rows: input.rows.slice(0, 2000).map((r) => ({
      row: r.row,
      status: r.status,
      result: 'pending',
      ...(r.id ? { id: r.id } : {}),
      ...(r.errors.length ? { error: r.errors.join('; ').slice(0, 300) } : {}),
    })),
    mapping: input.mapping,
    createdBy: prior?.createdBy || uid,
    ...(prior ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    note: '',
  };
  await setDoc(
    doc(sessions(db, c), id),
    prior ? { ...data, createdAt: prior.createdAt } : data,
  );
  return { id, ...data } as unknown as ImportSession;
}

/**
 * Executes the import in bounded, sequential batches. Safe to call again on
 * an interrupted session: rows already created/updated are skipped.
 */
export async function executeImport(
  db: Firestore,
  c: string,
  uid: string,
  session: ImportSession,
  rows: ImportRow[],
  opts: {
    applyUpdates: boolean;
    progress: (done: number, total: number) => void;
    signal?: AbortSignal;
  },
) {
  if (rows.length > 2000)
    throw new UserError(
      'Import at most 2,000 rows per file. Split larger files.',
    );
  const ref = doc(sessions(db, c), session.id);
  const results = new Map<number, SessionRow>(
    (session.rows || []).map((r) => [r.row, r]),
  );
  const todo = rows.filter((r) => {
    const prev = results.get(r.row);
    if (prev && ['created', 'updated', 'unchanged'].includes(prev.result))
      return false;
    return r.status === 'new' || (r.status === 'update' && opts.applyUpdates);
  });
  for (const r of rows)
    if (!results.has(r.row) || results.get(r.row)!.result === 'pending')
      results.set(r.row, {
        row: r.row,
        status: r.status,
        result:
          r.status === 'match'
            ? 'unchanged'
            : r.status === 'new' || (r.status === 'update' && opts.applyUpdates)
              ? 'pending'
              : 'skipped',
        ...(r.id ? { id: r.id } : {}),
        ...(r.errors.length
          ? { error: r.errors.join('; ').slice(0, 300) }
          : {}),
      });
  const flush = async (status: ImportSession['status']) => {
    const list = [...results.values()]
      .sort((a, b) => a.row - b.row)
      .slice(0, 2000);
    const counts: Record<string, number> = {};
    for (const x of list) counts[x.result] = (counts[x.result] || 0) + 1;
    await updateDoc(ref, {
      status,
      rows: list,
      counts,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  };
  await flush('importing');
  let done = 0;
  for (const r of todo) {
    if (opts.signal?.aborted) break;
    try {
      const id = await writeRow(db, c, uid, session.module, session.id, r);
      results.set(r.row, {
        row: r.row,
        status: r.status,
        result: r.status === 'update' ? 'updated' : 'created',
        id,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // A code claimed meanwhile (e.g. a repeated run) is an existing record, not a failure.
      const exists = /already (exists|used|reserved|posted|recorded)/i.test(
        msg,
      );
      results.set(r.row, {
        row: r.row,
        status: r.status,
        result: exists ? 'unchanged' : 'failed',
        error: msg.slice(0, 300),
      });
    }
    done++;
    opts.progress(done, todo.length);
    if (done % 25 === 0) await flush('importing');
  }
  const failed = [...results.values()].some((x) => x.result === 'failed');
  const pending = [...results.values()].some((x) => x.result === 'pending');
  const status =
    opts.signal?.aborted || pending
      ? 'partial'
      : failed
        ? 'partial'
        : 'completed';
  await flush(status);
  return { status, results: [...results.values()] };
}

async function writeRow(
  db: Firestore,
  c: string,
  uid: string,
  module: ImportModule,
  sid: string,
  r: ImportRow,
) {
  if (module === 'openingStock') {
    const material = await recordById(db, c, 'materials', r.values.materialId);
    if (!material) throw new UserError('Material not found.');
    const q = parseQuantity(
      r.values.quantity,
      unitDecimals(material.values.unit),
    );
    if (!q.ok) throw new UserError(q.error);
    // Deterministic id: retrying the same row can never post a second opening.
    const id = `IMP-${sid.slice(-20)}-${r.row}`;
    await postMovement(
      db,
      c,
      uid,
      {
        movementType: 'opening',
        materialId: r.values.materialId,
        fromStoreId: '',
        toStoreId: r.values.storeId,
        quantity: q.minor,
        movementDate: r.values.movementDate,
        reason: 'Opening stock import',
        reference: (r.values.reference || '').slice(0, 80),
        notes: '',
        issuedToEmployeeId: '',
        issuedToLocationId: '',
        reversesId: '',
      },
      id,
    );
    return id;
  }
  const kind = module as Kind;
  if (r.status === 'update' && r.id) {
    const prev = await recordById(db, c, kind, r.id);
    if (!prev) throw new UserError('The matched record no longer exists.');
    // Only the columns present in the file change; everything else is kept.
    const merged: Values = { ...prev.values };
    for (const k of r.changes || []) merged[k] = r.values[k];
    await saveRecord(db, c, uid, kind, merged, prev);
    return r.id;
  }
  await saveRecord(db, c, uid, kind, r.values);
  const id = await claim(db, c, kind, r.values.code);
  return id || '';
}
export function moduleLabel(m: ImportModule) {
  return m === 'openingStock' ? 'Opening stock' : definitions[m].title;
}
