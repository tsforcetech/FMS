import {
  getCountFromServer,
  collection,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import {
  definitions,
  fieldsFor,
  type ColumnType,
  type ExportColumn,
  type Kind,
  type Operation,
} from '@facilityos/shared';
import { listRecords } from './store';
import { lookup, type Context } from './context';
import { pageAll, type Dataset, type Row } from './exportStore';

/**
 * Dataset builders that connect existing screens to the export framework.
 * Reference IDs are exported as "CODE · Name" so files are readable without
 * the app, and personal contact fields are marked sensitive.
 */
const sensitiveKeys = new Set(['email', 'phone', 'linkedUid', 'contactPerson']);
function typeOf(kind: Kind, key: string): ColumnType {
  const f = fieldsFor(kind).find((x) => x.key === key);
  if (!f) return 'text';
  if (f.type === 'date') return 'date';
  if (f.type === 'money') return 'money';
  if (f.type === 'integer' || f.type === 'decimal') return 'number';
  return 'text';
}
export function recordColumns(kind: Kind): ExportColumn[] {
  const main = new Set([
    'code',
    'name',
    ...definitions[kind].columns,
    'status',
  ]);
  return fieldsFor(kind).map((f) => ({
    key: f.key,
    label: f.label,
    type: typeOf(kind, f.key),
    ...(sensitiveKeys.has(f.key) ? { sensitive: true } : {}),
    ...(main.has(f.key) ? {} : { optional: true }),
  }));
}
/** Resolves reference IDs to readable labels, cached per company. */
async function readable(
  context: Context,
  kind: Kind,
  rows: Operation[],
): Promise<Row[]> {
  const refs = fieldsFor(kind).filter((f) => f.reference);
  const labels = new Map<string, string>();
  for (const f of refs) {
    const ids = [...new Set(rows.map((r) => r.values[f.key]).filter(Boolean))];
    await Promise.all(
      ids.map(async (id) => {
        const l = await lookup(context, f.reference!, id);
        labels.set(`${f.reference}/${id}`, l ? `${l.code} · ${l.name}` : id);
      }),
    );
  }
  return rows.map((r) => {
    const out: Row = { ...r.values };
    for (const f of refs)
      if (r.values[f.key])
        out[f.key] =
          labels.get(`${f.reference}/${r.values[f.key]}`) || r.values[f.key];
    return out;
  });
}
export function recordDataset(
  context: Context,
  kind: Kind,
  opts: {
    rows: Operation[];
    status: string;
    search: string;
    filter?: { key: string; value: string };
  },
): Dataset {
  const def = definitions[kind];
  const db = context.services.db,
    c = context.company.companyId;
  const filters = [
    ...(opts.status ? [{ label: 'Status', value: opts.status }] : []),
    ...(opts.search ? [{ label: 'Name starts with', value: opts.search }] : []),
    ...(opts.filter
      ? [
          {
            label:
              fieldsFor(kind).find((f) => f.key === opts.filter!.key)?.label ||
              opts.filter.key,
            value: opts.filter.value,
          },
        ]
      : []),
  ];
  const pageRows: Row[] = opts.rows.map((r) => r.values);
  return {
    report: `records.${kind}`,
    title: def.title,
    columns: recordColumns(kind),
    filters,
    pageRows,
    // A name search is answered from the loaded results only (prefix search across casings).
    fetchAll: opts.search
      ? undefined
      : async (progress, signal) => {
          type Cur = Awaited<ReturnType<typeof listRecords>>['cursor'];
          const all: Operation[] = [];
          await pageAll<Cur>(
            async (cursor) => {
              const r = await listRecords(
                db,
                c,
                kind,
                '',
                opts.status,
                cursor,
                opts.filter,
              );
              all.push(...r.rows);
              return {
                rows: r.rows.map((x) => x.values),
                cursor: r.cursor,
                hasMore: r.hasMore,
              };
            },
            progress,
            signal,
          );
          return readable(context, kind, all);
        },
    count: opts.search
      ? undefined
      : async () => {
          const q: QueryConstraint[] = [];
          if (opts.status) q.push(where('status', '==', opts.status));
          if (opts.filter)
            q.push(
              where(
                opts.filter.key,
                '==',
                opts.filter.value === '__root__' ? '' : opts.filter.value,
              ),
            );
          return (
            await getCountFromServer(
              query(collection(db, 'companies', c, kind), ...q),
            )
          ).data().count;
        },
  };
}
export async function readableRows(
  context: Context,
  kind: Kind,
  rows: Operation[],
) {
  return readable(context, kind, rows);
}

/* ------------------------------------------------------------ task register */
import { listTasks, type Task, type TaskFilter } from './tasksStore';
import type { ExportColumn as Col } from '@facilityos/shared';
const c2 = (
  key: string,
  label: string,
  type: Col['type'] = 'text',
  extra: Partial<Col> = {},
): Col => ({ key, label, type, ...extra });
export const taskRegisterColumns: Col[] = [
  c2('reference', 'Reference'),
  c2('title', 'Task'),
  c2('site', 'Site'),
  c2('location', 'Location', 'text', { optional: true }),
  c2('status', 'Status', 'status'),
  c2('priority', 'Priority'),
  c2('dueAt', 'Due', 'datetime'),
  c2('completedAt', 'Completed', 'datetime'),
  c2('attempt', 'Attempt', 'number', { optional: true }),
  c2('assignees', 'Assignees'),
  c2('source', 'Source', 'text', { optional: true }),
];
async function labelMap(context: Context, kind: Kind, ids: string[]) {
  const m = new Map<string, string>();
  await Promise.all(
    [...new Set(ids.filter(Boolean))].map(async (id) => {
      const l = await lookup(context, kind, id);
      m.set(id, l?.name || id);
    }),
  );
  return m;
}
export async function taskRegisterRows(
  context: Context,
  rows: Task[],
): Promise<Row[]> {
  const sites = await labelMap(
    context,
    'sites',
    rows.map((t) => t.siteId),
  );
  const locs = await labelMap(
    context,
    'locations',
    rows.map((t) => t.locationId),
  );
  const people = await labelMap(
    context,
    'employees',
    rows.flatMap((t) => t.assigneeIds),
  );
  return rows.map((t) => ({
    reference: (t as Task & { reference?: string }).reference || t.id,
    title: t.title,
    site: sites.get(t.siteId) || '',
    location: t.locationId ? locs.get(t.locationId) : '',
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt,
    completedAt: (t as Task & { completedAt?: unknown }).completedAt,
    attempt: t.attempt,
    assignees: t.assigneeIds.map((e) => people.get(e) || e).join(', '),
    source: (t as Task & { sourceType?: string }).sourceType || '',
  }));
}
export function taskRegisterDataset(
  context: Context,
  filter: TaskFilter,
  rows: Task[],
  filterLabels: { label: string; value: string }[],
): Dataset {
  const db = context.services.db,
    c = context.company.companyId;
  return {
    report: 'register.tasks',
    title: 'Task register',
    columns: taskRegisterColumns,
    filters: filterLabels,
    pageCount: rows.length,
    pageRows: () => taskRegisterRows(context, rows),
    fetchAll: async (progress, signal) => {
      type Cur = Awaited<ReturnType<typeof listTasks>>['cursor'];
      const all: Task[] = [];
      await pageAll<Cur>(
        async (cursor) => {
          const r = await listTasks(db, c, filter, cursor);
          all.push(...r.rows);
          return {
            rows: r.rows as unknown as Row[],
            cursor: r.cursor,
            hasMore: r.hasMore,
          };
        },
        progress,
        signal,
      );
      return taskRegisterRows(context, all);
    },
  };
}

/* ------------------------------------------------------------ cases */
import { orderBy, where as w } from 'firebase/firestore';
import { caseDefinitions, type CaseKind } from '@facilityos/shared';
import type { CaseRecord } from './casesStore';
import { boundedFetch } from './reportsStore';
export const caseColumns: Col[] = [
  c2('number', 'Number'),
  c2('title', 'Title'),
  c2('site', 'Site'),
  c2('category', 'Category', 'text', { optional: true }),
  c2('priority', 'Priority'),
  c2('status', 'Status', 'status'),
  c2('createdAt', 'Raised', 'datetime'),
  c2('responseDueAt', 'Response due', 'datetime', { optional: true }),
  c2('resolutionDueAt', 'Resolution due', 'datetime'),
  c2('resolvedAt', 'Resolved', 'datetime'),
  c2('assignees', 'Assignees'),
  c2('reportedBy', 'Reported by', 'text', { optional: true, sensitive: true }),
  c2('resolution', 'Resolution', 'text', { optional: true }),
];
async function caseListRows(
  context: Context,
  rows: CaseRecord[],
): Promise<Row[]> {
  const sites = await labelMap(
    context,
    'sites',
    rows.map((x) => x.siteId),
  );
  const people = await labelMap(
    context,
    'employees',
    rows.flatMap((x) => x.assigneeIds || []),
  );
  return rows.map((x) => ({
    ...x,
    site: sites.get(x.siteId) || '',
    assignees: (x.assigneeIds || []).map((e) => people.get(e) || e).join(', '),
  }));
}
export function caseListDataset(
  context: Context,
  kind: CaseKind,
  f: { status: string; siteId: string },
  rows: CaseRecord[],
): Dataset {
  const def = caseDefinitions[kind];
  return {
    report: `register.${kind}`,
    title: def.title,
    columns: caseColumns,
    filters: [
      ...(f.status
        ? [
            {
              label: 'Status',
              value: f.status === 'open' ? 'All open' : f.status,
            },
          ]
        : []),
      ...(f.siteId ? [{ label: 'Site', value: f.siteId }] : []),
    ],
    pageCount: rows.length,
    pageRows: () => caseListRows(context, rows),
    fetchAll: async (progress) => {
      const key =
        f.status && f.status !== 'open' ? 'status' : f.siteId ? 'siteId' : '';
      const r = await boundedFetch(
        context.services.db,
        context.company.companyId,
        kind,
        [
          ...(key
            ? [w(key, '==', key === 'status' ? f.status : f.siteId)]
            : []),
          orderBy('createdAt', 'desc'),
        ],
        100000,
      );
      let all = r.rows.map((d) => ({ id: d.id, ...d.data() }) as CaseRecord);
      if (f.status === 'open')
        all = all.filter((x) => def.open.includes(x.status));
      if (f.siteId) all = all.filter((x) => x.siteId === f.siteId);
      progress(all.length);
      return caseListRows(context, all);
    },
  };
}

/* ------------------------------------------------------------ inventory registers */
import {
  listBalances,
  listMovements,
  type Balance,
  type Movement,
} from './store';
async function stockRows(context: Context, rows: (Balance | Movement)[]) {
  const stores = await labelMap(
    context,
    'stores',
    rows.flatMap((r) =>
      'storeId' in r
        ? [r.storeId]
        : [(r as Movement).fromStoreId, (r as Movement).toStoreId],
    ),
  );
  const mats = await labelMap(
    context,
    'materials',
    rows.map((r) => r.materialId),
  );
  return { stores, mats };
}
export function balancesDataset(
  context: Context,
  filter?: { key: string; value: string },
): Dataset {
  const db = context.services.db,
    c = context.company.companyId;
  const all = async (progress: (n: number) => void, signal: AbortSignal) => {
    type Cur = Awaited<ReturnType<typeof listBalances>>['cursor'];
    const rows: Balance[] = [];
    await pageAll<Cur>(
      async (cursor) => {
        const r = await listBalances(db, c, filter, cursor);
        rows.push(...r.rows);
        return {
          rows: r.rows as unknown as Row[],
          cursor: r.cursor,
          hasMore: r.hasMore,
        };
      },
      progress,
      signal,
    );
    const { stores, mats } = await stockRows(context, rows);
    return rows.map((b) => ({
      store: stores.get(b.storeId),
      material: mats.get(b.materialId),
      quantity: b.quantity,
      updatedAt: b.updatedAt,
    }));
  };
  return {
    report: 'register.stockBalances',
    title: 'Stock balances',
    columns: [
      c2('store', 'Store'),
      c2('material', 'Material'),
      c2('quantity', 'Quantity', 'number', { total: true }),
      c2('updatedAt', 'Last movement', 'datetime'),
    ],
    filters: filter
      ? [
          {
            label: filter.key === 'storeId' ? 'Store' : 'Material',
            value: filter.value,
          },
        ]
      : [],
    pageRows: () => all(() => undefined, new AbortController().signal),
    fetchAll: all,
  };
}
export function movementsDataset(
  context: Context,
  type: string,
  rows: Movement[],
): Dataset {
  const db = context.services.db,
    c = context.company.companyId;
  const shape = async (list: Movement[]) => {
    const { stores, mats } = await stockRows(context, list);
    return list.map((m) => ({
      createdAt: m.createdAt,
      movementType: m.movementType,
      material: mats.get(m.materialId),
      from: m.fromStoreId ? stores.get(m.fromStoreId) : '',
      to: m.toStoreId ? stores.get(m.toStoreId) : '',
      quantity: m.quantity,
      reference: (m as Movement & { reference?: string }).reference || '',
      reason: (m as Movement & { reason?: string }).reason || '',
    }));
  };
  return {
    report: 'register.stockMovements',
    title: 'Stock movement history',
    columns: [
      c2('createdAt', 'Posted', 'datetime'),
      c2('movementType', 'Type'),
      c2('material', 'Material'),
      c2('from', 'From store'),
      c2('to', 'To store'),
      c2('quantity', 'Quantity', 'number'),
      c2('reference', 'Reference', 'text', { optional: true }),
      c2('reason', 'Reason', 'text', { optional: true }),
    ],
    filters: type ? [{ label: 'Type', value: type }] : [],
    pageCount: rows.length,
    pageRows: () => shape(rows),
    fetchAll: async (progress, signal) => {
      type Cur = Awaited<ReturnType<typeof listMovements>>['cursor'];
      const all: Movement[] = [];
      await pageAll<Cur>(
        async (cursor) => {
          const r = await listMovements(
            db,
            c,
            type ? { key: 'movementType', value: type } : undefined,
            cursor,
          );
          all.push(...r.rows);
          return {
            rows: r.rows as unknown as Row[],
            cursor: r.cursor,
            hasMore: r.hasMore,
          };
        },
        progress,
        signal,
      );
      return shape(all);
    },
  };
}

/* ------------------------------------------------------------ schedules */
import type { Schedule } from './scheduling';
import { describeRule } from '@facilityos/shared';
export function schedulesDataset(
  context: Context,
  rows: Schedule[],
  maintenance: boolean,
): Dataset {
  return {
    report: maintenance ? 'register.pmPlans' : 'register.schedules',
    title: maintenance ? 'Preventive maintenance plans' : 'Recurring schedules',
    columns: [
      c2('code', 'Code'),
      c2('name', 'Name'),
      c2('site', 'Site'),
      c2('recurrence', 'Recurrence'),
      c2('localTime', 'Time'),
      c2('startDate', 'Starts', 'date'),
      c2('endDate', 'Ends', 'date'),
      c2('priority', 'Priority'),
      c2('status', 'Status', 'status'),
      c2('generatedThrough', 'Generated through', 'date', { optional: true }),
    ],
    filters: [],
    pageCount: rows.length,
    pageRows: async () => {
      const sites = await labelMap(
        context,
        'sites',
        rows.map((x) => x.siteId),
      );
      return rows.map((x) => ({
        ...x,
        site: sites.get(x.siteId),
        recurrence: safeRule(x),
      }));
    },
  };
}
function safeRule(x: Schedule) {
  try {
    return describeRule(x.rule as Parameters<typeof describeRule>[0]);
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------ requests & audit */
import type { ServiceRequest } from './customerStore';
import type { AuditEntry } from './reportsStore';
export function requestsDataset(
  context: Context,
  rows: ServiceRequest[],
  status: string,
): Dataset {
  return {
    report: 'register.serviceRequests',
    title: 'Customer service requests',
    columns: [
      c2('reference', 'Reference'),
      c2('createdAt', 'Raised', 'datetime'),
      c2('site', 'Site'),
      c2('location', 'Location'),
      c2('category', 'Category'),
      c2('priority', 'Priority'),
      c2('status', 'Status', 'status'),
      c2('description', 'Description', 'text', { optional: true }),
      c2('resolutionSummary', 'Resolution', 'text', { optional: true }),
      c2('complaintId', 'Complaint', 'text', {
        optional: true,
        internal: true,
      }),
    ],
    filters: status ? [{ label: 'Status', value: status }] : [],
    pageCount: rows.length,
    pageRows: async () => {
      const sites = await labelMap(
        context,
        'sites',
        rows.map((x) => x.siteId),
      );
      const locs = await labelMap(
        context,
        'locations',
        rows.map((x) => x.locationId),
      );
      return rows.map((x) => ({
        ...x,
        site: sites.get(x.siteId),
        location: x.locationId ? locs.get(x.locationId) : '',
      }));
    },
  };
}
export function auditDataset(
  rows: AuditEntry[],
  days: string,
  source: string,
): Dataset {
  return {
    report: 'register.audit',
    title: 'Audit history',
    columns: [
      c2('at', 'When', 'datetime'),
      c2('source', 'Source'),
      c2('action', 'Action'),
      c2('subject', 'Record'),
      c2('detail', 'Detail'),
      c2('actorUid', 'User ID'),
    ],
    filters: [
      { label: 'Period', value: `last ${days} day(s)` },
      ...(source ? [{ label: 'Source', value: source }] : []),
    ],
    pageRows: rows as unknown as Row[],
  };
}
