import {
  attendanceFlags,
  caseDefinitions,
  complianceStatus,
  recordedMinutes,
  slaFacts,
  staffProductivity,
  stockReconciliation,
  taskMetrics,
  toLocal,
  type ExportColumn,
  type Kind,
} from '@facilityos/shared';
import { lookup, type Context } from './context';
import type { Dataset, Row } from './exportStore';
import {
  listCompliance,
  loadAttendance,
  loadCases,
  loadCosts,
  loadMovements,
  loadTasks,
  type CaseRow,
  type Range,
  type TaskRow,
} from './reportsStore';

/**
 * Export datasets for the Phase 7 reports. "All matching records" re-reads
 * the period without the interactive display cap (bounded pages, up to the
 * export limit) and recomputes with the same engine functions as the screen,
 * so exported numbers equal on-screen numbers for the same data.
 */
export type ReportScope = {
  r: Range & { fromDate: string; toDate: string };
  siteId: string;
  siteName: string;
};
const EXPORT_MAX = 100000;
const period = (s: ReportScope) => `${s.r.fromDate} – ${s.r.toDate}`;
const filters = (s: ReportScope) =>
  s.siteId
    ? [{ label: 'Site', value: s.siteName || s.siteId }]
    : [{ label: 'Site', value: 'All sites' }];
const bySite = <T extends { siteId: string }>(rows: T[], siteId: string) =>
  siteId ? rows.filter((x) => x.siteId === siteId) : rows;

/** id → "CODE · Name" (or name) using the shared label cache. */
async function names(
  context: Context,
  kind: Kind,
  ids: string[],
  withCode = false,
) {
  const m = new Map<string, string>();
  await Promise.all(
    [...new Set(ids.filter(Boolean))].map(async (id) => {
      const l = await lookup(context, kind, id);
      m.set(id, l ? (withCode ? `${l.code} · ${l.name}` : l.name) : id);
    }),
  );
  return m;
}
const col = (
  key: string,
  label: string,
  type: ExportColumn['type'] = 'text',
  extra: Partial<ExportColumn> = {},
): ExportColumn => ({ key, label, type, ...extra });

/* ------------------------------------------------------------------ tasks */
const taskCols = [
  col('title', 'Task'),
  col('site', 'Site'),
  col('status', 'Status', 'status'),
  col('priority', 'Priority'),
  col('dueAt', 'Due', 'datetime'),
  col('startedAt', 'Started', 'datetime', { optional: true }),
  col('submittedAt', 'Submitted', 'datetime', { optional: true }),
  col('completedAt', 'Completed', 'datetime'),
  col('minutes', 'Recorded minutes', 'minutes', { total: true }),
  col('rework', 'Rework (extra attempts)', 'number', { total: true }),
  col('exceptions', 'Exceptions', 'number', { total: true }),
  col('assignees', 'Assignees'),
];
async function taskRows(context: Context, rows: TaskRow[]): Promise<Row[]> {
  const sites = await names(
    context,
    'sites',
    rows.map((t) => t.siteId),
  );
  const people = await names(
    context,
    'employees',
    rows.flatMap((t) => t.assigneeIds),
  );
  return rows.map((t) => ({
    title: t.title,
    site: sites.get(t.siteId) || '',
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt,
    startedAt: t.startedAt,
    submittedAt: t.submittedAt,
    completedAt: t.completedAt,
    minutes: recordedMinutes(t),
    rework: Math.max(0, t.attempt - 1),
    exceptions: t.exceptionCount,
    assignees: t.assigneeIds.map((e) => people.get(e) || e).join(', '),
  }));
}
export function tasksDataset(
  context: Context,
  s: ReportScope,
  loaded: TaskRow[],
): Dataset {
  const db = context.services.db,
    c = context.company.companyId;
  return {
    report: 'reports.tasks',
    title: 'Task register',
    columns: taskCols,
    period: period(s),
    filters: filters(s),
    pageCount: bySite(loaded, s.siteId).length,
    pageRows: () => taskRows(context, bySite(loaded, s.siteId)),
    fetchAll: async (progress) => {
      const all = bySite(
        (await loadTasks(db, c, s.r, EXPORT_MAX)).rows,
        s.siteId,
      );
      progress(all.length);
      return taskRows(context, all);
    },
  };
}

/* ------------------------------------------------------------------ staff */
const staffCols = [
  col('employee', 'Employee'),
  col('assigned', 'Assigned', 'number', { total: true }),
  col('completed', 'Completed', 'number', { total: true }),
  col('pending', 'Pending', 'number', { total: true }),
  col('overdue', 'Overdue', 'number', { total: true }),
  col('rework', 'Rework', 'number', { total: true }),
  col('onTimeRate', 'On-time rate', 'percent'),
  col('workloadMinutes', 'Planned minutes', 'minutes', { total: true }),
  col('recordedMinutes', 'Recorded minutes', 'minutes', { total: true }),
];
async function staffRows(context: Context, tasks: TaskRow[]) {
  const rows = staffProductivity(tasks);
  const people = await names(
    context,
    'employees',
    rows.map((r) => r.employeeId),
    true,
  );
  return rows.map((r) => ({
    ...r,
    employee: people.get(r.employeeId) || r.employeeId,
  }));
}
export function staffDataset(
  context: Context,
  s: ReportScope,
  loaded: TaskRow[],
): Dataset {
  const db = context.services.db,
    c = context.company.companyId;
  return {
    report: 'reports.staff',
    title: 'Staff productivity',
    columns: staffCols,
    period: period(s),
    filters: filters(s),
    pageCount: staffProductivity(bySite(loaded, s.siteId)).length,
    pageRows: () => staffRows(context, bySite(loaded, s.siteId)),
    fetchAll: async () =>
      staffRows(
        context,
        bySite((await loadTasks(db, c, s.r, EXPORT_MAX)).rows, s.siteId),
      ),
  };
}

/* ------------------------------------------------------------------ sites */
export function siteDataset(
  context: Context,
  s: ReportScope,
  data: { tasks: TaskRow[]; cases: CaseRow[]; wo: CaseRow[] },
): Dataset {
  const db = context.services.db,
    c = context.company.companyId;
  const build = async (d: typeof data) => {
    const ids = [
      ...new Set([...d.tasks, ...d.cases, ...d.wo].map((x) => x.siteId)),
    ];
    const sites = await names(context, 'sites', ids, true);
    return ids.map((id) => {
      const t = taskMetrics(d.tasks.filter((x) => x.siteId === id));
      const cs = [...d.cases, ...d.wo]
        .filter((x) => x.siteId === id)
        .map((x) => slaFacts(x));
      return {
        site: sites.get(id) || id,
        tasks: t.generated,
        completed: t.completed,
        overdue: t.overdue,
        onTime: t.onTimeRate,
        workOrders: d.wo.filter((x) => x.siteId === id).length,
        complaints: d.cases.filter((x) => x.siteId === id).length,
        breaches:
          cs.filter((x) => x.responseBreached).length +
          cs.filter((x) => x.resolutionBreached).length,
      };
    });
  };
  return {
    report: 'reports.sites',
    title: 'Site performance',
    columns: [
      col('site', 'Site'),
      col('tasks', 'Tasks', 'number', { total: true }),
      col('completed', 'Completed', 'number', { total: true }),
      col('overdue', 'Overdue', 'number', { total: true }),
      col('onTime', 'On-time rate', 'percent'),
      col('workOrders', 'Work orders', 'number', { total: true }),
      col('complaints', 'Complaints', 'number', { total: true }),
      col('breaches', 'SLA breaches', 'number', { total: true }),
    ],
    period: period(s),
    filters: [],
    pageCount: new Set(
      [...data.tasks, ...data.cases, ...data.wo].map((x) => x.siteId),
    ).size,
    pageRows: () => build(data),
    fetchAll: async () =>
      build({
        tasks: (await loadTasks(db, c, s.r, EXPORT_MAX)).rows,
        cases: (
          await loadCases(
            db,
            c,
            'complaints',
            s.r,
            caseDefinitions.complaints.open,
            EXPORT_MAX,
          )
        ).rows,
        wo: (
          await loadCases(
            db,
            c,
            'workOrders',
            s.r,
            caseDefinitions.workOrders.open,
            EXPORT_MAX,
          )
        ).rows,
      }),
  };
}

/* ------------------------------------------------------------------ cases / SLA */
const caseCols = [
  col('type', 'Type'),
  col('number', 'Number'),
  col('title', 'Title'),
  col('site', 'Site'),
  col('priority', 'Priority'),
  col('status', 'Status', 'status'),
  col('createdAt', 'Raised', 'datetime'),
  col('responseDueAt', 'Response due', 'datetime', { optional: true }),
  col('respondedAt', 'Responded', 'datetime', { optional: true }),
  col('resolutionDueAt', 'Resolution due', 'datetime'),
  col('resolvedAt', 'Resolved', 'datetime'),
  col('responseBreached', 'Response breached'),
  col('resolutionBreached', 'Resolution breached'),
  col('source', 'Source', 'text', { optional: true }),
];
async function caseRows(context: Context, rows: CaseRow[]) {
  const sites = await names(
    context,
    'sites',
    rows.map((x) => x.siteId),
  );
  return rows.map((x) => {
    const f = slaFacts(x);
    return {
      type:
        caseDefinitions[x.kind as keyof typeof caseDefinitions]?.singular ||
        x.kind,
      number: x.number,
      title: x.title,
      site: sites.get(x.siteId) || '',
      priority: x.priority,
      status: x.status,
      createdAt: x.createdAt,
      responseDueAt: x.responseDueAt,
      respondedAt: x.respondedAt,
      resolutionDueAt: x.resolutionDueAt,
      resolvedAt: x.resolvedAt,
      responseBreached: f.hasTargets
        ? f.responseBreached
          ? 'Yes'
          : 'No'
        : 'No target',
      resolutionBreached: f.hasTargets
        ? f.resolutionBreached
          ? 'Yes'
          : 'No'
        : 'No target',
      source: x.sourceType,
    };
  });
}
export function casesDataset(
  context: Context,
  s: ReportScope,
  kinds: ('workOrders' | 'complaints' | 'escalations')[],
  loaded: CaseRow[],
  title: string,
): Dataset {
  const db = context.services.db,
    c = context.company.companyId;
  return {
    report: `reports.${kinds.join('+')}`,
    title,
    columns: caseCols,
    period: period(s),
    filters: filters(s),
    pageCount: bySite(loaded, s.siteId).length,
    pageRows: () => caseRows(context, bySite(loaded, s.siteId)),
    fetchAll: async (progress) => {
      const all: CaseRow[] = [];
      for (const k of kinds) {
        all.push(
          ...(
            await loadCases(db, c, k, s.r, caseDefinitions[k].open, EXPORT_MAX)
          ).rows,
        );
        progress(all.length);
      }
      return caseRows(context, bySite(all, s.siteId));
    },
  };
}

/* ------------------------------------------------------------------ costs */
export function costsDataset(
  context: Context,
  s: ReportScope,
  loaded: Awaited<ReturnType<typeof loadCosts>>['rows'],
): Dataset {
  const db = context.services.db,
    c = context.company.companyId;
  const build = async (rows: typeof loaded) => {
    const sites = await names(
      context,
      'sites',
      rows.map((x) => x.siteId),
    );
    const assets = await names(
      context,
      'assets',
      rows.map((x) => x.assetId),
      true,
    );
    return rows.map((x) => ({
      date: x.incurredDate,
      site: sites.get(x.siteId) || '',
      asset: x.assetId ? assets.get(x.assetId) : '',
      type: x.type,
      description: x.description,
      currency: x.currency,
      amount: x.amount,
    }));
  };
  return {
    report: 'reports.costs',
    title: 'Maintenance costs',
    columns: [
      col('date', 'Date', 'date'),
      col('site', 'Site'),
      col('asset', 'Asset'),
      col('type', 'Type'),
      col('description', 'Description'),
      col('currency', 'Currency'),
      col('amount', 'Amount', 'money', { total: true }),
    ],
    period: period(s),
    filters: filters(s),
    pageCount: bySite(loaded, s.siteId).length,
    pageRows: () => build(bySite(loaded, s.siteId)),
    fetchAll: async () =>
      build(
        bySite(
          (await loadCosts(db, c, s.r.fromDate, s.r.toDate, EXPORT_MAX)).rows,
          s.siteId,
        ),
      ),
  };
}

/* ------------------------------------------------------------------ inventory */
export function inventoryDataset(context: Context, s: ReportScope): Dataset {
  const db = context.services.db,
    c = context.company.companyId;
  const build = async () => {
    const m = await loadMovements(db, c, s.r, EXPORT_MAX);
    if (m.truncated)
      throw new Error(
        'The stock ledger is too large to reconcile in the browser. Contact Sharaco for a server export.',
      );
    const lines = stockReconciliation(m.rows, s.r.from, s.r.to).filter(
      (l) =>
        l.opening ||
        l.closing ||
        l.received ||
        l.issued ||
        l.transferIn ||
        l.transferOut ||
        l.adjusted ||
        l.reversed,
    );
    const stores = await names(
      context,
      'stores',
      lines.map((l) => l.storeId),
      true,
    );
    const mats = await names(
      context,
      'materials',
      lines.map((l) => l.materialId),
      true,
    );
    return lines.map((l) => ({
      ...l,
      store: stores.get(l.storeId),
      material: mats.get(l.materialId),
    }));
  };
  return {
    report: 'reports.inventory',
    title: 'Stock reconciliation',
    columns: [
      col('store', 'Store'),
      col('material', 'Material'),
      ...(
        [
          'opening',
          'received',
          'issued',
          'transferIn',
          'transferOut',
          'adjusted',
          'reversed',
          'closing',
        ] as const
      ).map((k) =>
        col(
          k,
          k === 'transferIn'
            ? 'Transfer in'
            : k === 'transferOut'
              ? 'Transfer out'
              : k[0].toUpperCase() + k.slice(1),
          'number',
        ),
      ),
    ],
    period: period(s),
    filters: [],
    pageRows: build,
    pageCount: 0,
    fetchAll: build,
  };
}

/* ------------------------------------------------------------------ attendance */
export function attendanceDataset(
  context: Context,
  s: ReportScope,
  loaded: Awaited<ReturnType<typeof loadAttendance>>['rows'],
): Dataset {
  const db = context.services.db,
    c = context.company.companyId;
  const today = toLocal(new Date(), context.company.timeZone).date;
  const build = async (rows: typeof loaded) => {
    const people = await names(
      context,
      'employees',
      rows.map((a) => a.employeeId),
      true,
    );
    const sites = await names(
      context,
      'sites',
      rows.map((a) => a.siteId),
    );
    return rows.map((a) => ({
      date: a.date,
      employee: people.get(a.employeeId),
      site: sites.get(a.siteId),
      checkIn: a.checkIn,
      checkOut: a.checkOut,
      lateMinutes: a.lateMinutes,
      flags: attendanceFlags(a, today).join(', '),
    }));
  };
  return {
    report: 'reports.attendance',
    title: 'Attendance register',
    // GPS coordinates are never exported from reports.
    columns: [
      col('date', 'Date', 'date'),
      col('employee', 'Employee'),
      col('site', 'Site'),
      col('checkIn', 'Check-in', 'datetime'),
      col('checkOut', 'Check-out', 'datetime'),
      col('lateMinutes', 'Late minutes', 'minutes', { total: true }),
      col('flags', 'Flags'),
    ],
    period: period(s),
    filters: filters(s),
    pageCount: bySite(loaded, s.siteId).length,
    pageRows: () => build(bySite(loaded, s.siteId)),
    fetchAll: async () =>
      build(
        bySite(
          (await loadAttendance(db, c, s.r.fromDate, s.r.toDate, EXPORT_MAX))
            .rows,
          s.siteId,
        ),
      ),
  };
}

/* ------------------------------------------------------------------ compliance */
export function complianceDataset(context: Context): Dataset {
  const db = context.services.db,
    c = context.company.companyId;
  const today = toLocal(new Date(), context.company.timeZone).date;
  const build = async () => {
    const rows = (await listCompliance(db, c)).rows.filter(
      (x) => x.status === 'active',
    );
    const sites = await names(
      context,
      'sites',
      rows.map((x) => x.siteId),
    );
    return rows.map((x) => ({
      title: x.title,
      category: x.category,
      site: sites.get(x.siteId),
      issuer: x.issuer,
      reference: x.reference,
      issuedDate: x.issuedDate,
      expiryDate: x.expiryDate,
      status: complianceStatus(x, today),
      evidence: x.evidenceRef,
    }));
  };
  return {
    report: 'reports.compliance',
    title: 'Compliance register',
    columns: [
      col('title', 'Record'),
      col('category', 'Category'),
      col('site', 'Site'),
      col('issuer', 'Issuer'),
      col('reference', 'Reference'),
      col('issuedDate', 'Issued', 'date'),
      col('expiryDate', 'Expires', 'date'),
      col('status', 'Status', 'status'),
      col('evidence', 'Evidence reference', 'text', { optional: true }),
    ],
    filters: [],
    pageRows: build,
    pageCount: 0,
    fetchAll: build,
  };
}

/* ------------------------------------------------------------------ summary tables */
export function summaryDataset(
  report: string,
  title: string,
  s: ReportScope | null,
  rows: [string, string | number | null][],
): Dataset {
  return {
    report,
    title,
    columns: [col('metric', 'Measure'), col('value', 'Value')],
    period: s ? period(s) : undefined,
    filters: s ? filters(s) : [],
    pageRows: rows.map(([metric, value]) => ({
      metric,
      value: value === null ? '—' : String(value),
    })),
  };
}
