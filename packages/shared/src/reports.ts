import { movementEffects } from './inventory';

/**
 * Phase 7 report engine: pure metric functions and report definitions shared
 * by the admin reports, the customer portal and the future (Phase 8) exports.
 * Inputs are plain objects with Date values, so the functions are testable
 * without Firebase and every caller computes the same numbers.
 */

/* ================================================================ definitions */
export type ColumnType =
  | 'text'
  | 'number'
  | 'percent'
  | 'minutes'
  | 'datetime'
  | 'date'
  | 'money'
  | 'status';
export type ReportColumn = {
  key: string;
  label: string;
  type: ColumnType;
  sensitive?: boolean;
};
export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  /** Firestore collection the detail rows come from. */
  source: string;
  /** Field the date range applies to. */
  dateField: string;
  filters: string[];
  columns: ReportColumn[];
  /** Hard cap for interactive views; exports page through the same query. */
  pageSize: number;
};
const col = (
  key: string,
  label: string,
  type: ColumnType = 'text',
  sensitive = false,
): ReportColumn => ({ key, label, type, ...(sensitive ? { sensitive } : {}) });
export const reportDefinitions: Record<string, ReportDefinition> = {
  tasks: {
    id: 'tasks',
    title: 'Task performance',
    description:
      'Tasks due in the period: generation, completion, timeliness, rework and exceptions.',
    source: 'tasks',
    dateField: 'dueAt',
    filters: [
      'site',
      'location',
      'department',
      'employee',
      'template',
      'priority',
      'status',
      'schedule',
    ],
    columns: [
      col('reference', 'Reference'),
      col('title', 'Task'),
      col('site', 'Site'),
      col('location', 'Location'),
      col('assignee', 'Assignee'),
      col('priority', 'Priority', 'status'),
      col('status', 'Status', 'status'),
      col('dueAt', 'Due', 'datetime'),
      col('completedAt', 'Completed', 'datetime'),
      col('durationMinutes', 'Recorded duration', 'minutes'),
      col('attempt', 'Attempts', 'number'),
      col('exceptionCount', 'Exceptions', 'number'),
    ],
    pageSize: 200,
  },
  staff: {
    id: 'staff',
    title: 'Staff productivity',
    description:
      'Per employee: assigned, completed, pending, overdue and rework, with estimated workload and recorded duration.',
    source: 'tasks',
    dateField: 'dueAt',
    filters: ['site', 'department', 'employee'],
    columns: [
      col('employee', 'Employee'),
      col('department', 'Department'),
      col('assigned', 'Assigned', 'number'),
      col('completed', 'Completed', 'number'),
      col('pending', 'Pending', 'number'),
      col('overdue', 'Overdue', 'number'),
      col('rework', 'Rework', 'number'),
      col('workloadMinutes', 'Estimated workload', 'minutes'),
      col('recordedMinutes', 'Recorded duration', 'minutes'),
      col('onTimeRate', 'On time', 'percent'),
    ],
    pageSize: 200,
  },
  sla: {
    id: 'sla',
    title: 'SLA performance',
    description:
      'Cases created in the period against the targets stored when each case was created.',
    source: 'workOrders,complaints,escalations',
    dateField: 'createdAt',
    filters: ['site', 'department', 'priority', 'kind'],
    columns: [
      col('number', 'Number'),
      col('title', 'Title'),
      col('kind', 'Type'),
      col('priority', 'Priority', 'status'),
      col('status', 'Status', 'status'),
      col('createdAt', 'Created', 'datetime'),
      col('responseMinutes', 'Response time', 'minutes'),
      col('resolutionMinutes', 'Resolution time', 'minutes'),
      col('responseBreached', 'Response breached', 'status'),
      col('resolutionBreached', 'Resolution breached', 'status'),
    ],
    pageSize: 200,
  },
  inventory: {
    id: 'inventory',
    title: 'Inventory movements',
    description:
      'Opening, received, issued, transferred, adjusted and closing quantities reconciled with the stock ledger.',
    source: 'stockMovements',
    dateField: 'createdAt',
    filters: ['store', 'material'],
    columns: [
      col('material', 'Material'),
      col('store', 'Store'),
      col('opening', 'Opening', 'number'),
      col('received', 'Received', 'number'),
      col('issued', 'Issued', 'number'),
      col('transferIn', 'Transfer in', 'number'),
      col('transferOut', 'Transfer out', 'number'),
      col('adjusted', 'Adjusted', 'number'),
      col('reversed', 'Reversals', 'number'),
      col('closing', 'Closing', 'number'),
    ],
    pageSize: 500,
  },
  attendance: {
    id: 'attendance',
    title: 'Attendance',
    description:
      'Check-in/out by site local time, lateness, missed check-out and corrections. Coordinates are not shown.',
    source: 'attendance',
    dateField: 'date',
    filters: ['site', 'employee'],
    columns: [
      col('date', 'Date', 'date'),
      col('employee', 'Employee'),
      col('site', 'Site'),
      col('checkIn', 'Check-in'),
      col('checkOut', 'Check-out'),
      col('late', 'Late', 'minutes'),
      col('flags', 'Flags'),
      col('location', 'Location evidence', 'status', true),
    ],
    pageSize: 200,
  },
  maintenance: {
    id: 'maintenance',
    title: 'Maintenance',
    description:
      'Preventive tasks and corrective work orders, response/resolution and recorded costs.',
    source: 'tasks,workOrders,maintenanceCosts',
    dateField: 'dueAt',
    filters: ['site', 'asset', 'priority'],
    columns: [
      col('kind', 'Type'),
      col('reference', 'Reference'),
      col('title', 'Title'),
      col('asset', 'Asset'),
      col('status', 'Status', 'status'),
      col('date', 'Date', 'datetime'),
      col('cost', 'Recorded cost', 'money', true),
    ],
    pageSize: 200,
  },
  assets: {
    id: 'assets',
    title: 'Asset performance & cost',
    description:
      'Asset value and recorded maintenance cost kept separate; uncovered history is labelled.',
    source: 'assets',
    dateField: '',
    filters: ['site', 'category'],
    columns: [
      col('code', 'Asset code'),
      col('name', 'Asset'),
      col('category', 'Category'),
      col('site', 'Site'),
      col('location', 'Location'),
      col('condition', 'Condition', 'status'),
      col('purchaseDate', 'Purchased', 'date'),
      col('purchaseCost', 'Purchase cost', 'money', true),
      col('warrantyEndDate', 'Warranty', 'date'),
      col('maintenanceCount', 'Maintenance count', 'number'),
      col('openWorkOrders', 'Open work orders', 'number'),
      col('lastMaintenance', 'Last maintenance', 'datetime'),
      col('recordedCost', 'Recorded maintenance cost', 'money', true),
    ],
    pageSize: 200,
  },
  compliance: {
    id: 'compliance',
    title: 'Compliance & inspections',
    description:
      'Inspection completion, failed checks and certificate evidence. Checklist completion is not a statutory certification.',
    source: 'complianceRecords,tasks,taskExceptions',
    dateField: 'expiryDate',
    filters: ['site', 'category'],
    columns: [
      col('category', 'Category'),
      col('title', 'Item'),
      col('site', 'Site'),
      col('issuer', 'Issuer'),
      col('reference', 'Certificate / reference'),
      col('issuedDate', 'Issued', 'date'),
      col('expiryDate', 'Expires', 'date'),
      col('status', 'Evidence status', 'status'),
    ],
    pageSize: 200,
  },
};

/* ================================================================ tasks */
export type TaskFacts = {
  id?: string;
  status: string;
  priority?: string;
  dueAt: Date | null;
  completedAt: Date | null;
  startedAt?: Date | null;
  submittedAt?: Date | null;
  attempt: number;
  exceptionCount: number;
  approvalRequired: boolean;
  assigneeIds: string[];
  estimatedMinutes: number;
};
const OPEN = [
  'pending',
  'assigned',
  'in_progress',
  'paused',
  'rework_required',
  'awaiting_approval',
];
export const isOpenTask = (s: string) => OPEN.includes(s);
export function isLate(t: Pick<TaskFacts, 'status' | 'dueAt'>, now: Date) {
  return (
    isOpenTask(t.status) &&
    t.status !== 'awaiting_approval' &&
    !!t.dueAt &&
    t.dueAt < now
  );
}
/** Minutes actually recorded between start and submission (null when not recorded). */
export function recordedMinutes(
  t: Pick<TaskFacts, 'startedAt' | 'submittedAt' | 'completedAt'>,
) {
  const end = t.submittedAt || t.completedAt;
  if (!t.startedAt || !end || end < t.startedAt) return null;
  return Math.round((end.getTime() - t.startedAt.getTime()) / 60000);
}
const pct = (a: number, b: number) =>
  b ? Math.round((a / b) * 1000) / 10 : null;
const avg = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null;
/**
 * Definitions: cancelled tasks are excluded from every rate; "completed" means
 * approved (or completed without approval); rework count is the number of
 * extra attempts; on-time means completed no later than the due time.
 */
export function taskMetrics(tasks: TaskFacts[], now = new Date()) {
  const live = tasks.filter((t) => t.status !== 'cancelled');
  const completed = live.filter((t) => t.status === 'completed');
  const decided = live.filter(
    (t) => t.approvalRequired && ['completed', 'rejected'].includes(t.status),
  );
  const durations = completed
    .map(recordedMinutes)
    .filter((x): x is number => x !== null);
  return {
    generated: tasks.length,
    cancelled: tasks.length - live.length,
    assigned: live.filter((t) => t.assigneeIds.length > 0).length,
    completed: completed.length,
    pending: live.filter((t) => isOpenTask(t.status)).length,
    awaitingApproval: live.filter((t) => t.status === 'awaiting_approval')
      .length,
    overdue: live.filter((t) => isLate(t, now)).length,
    rejected: live.filter((t) => t.status === 'rejected').length,
    reworkCount: live.reduce((s, t) => s + Math.max(0, t.attempt - 1), 0),
    exceptions: live.reduce((s, t) => s + (t.exceptionCount || 0), 0),
    avgCompletionMinutes: avg(durations),
    durationCoverage: pct(durations.length, completed.length),
    onTimeRate: pct(
      completed.filter(
        (t) => t.dueAt && t.completedAt && t.completedAt <= t.dueAt,
      ).length,
      completed.length,
    ),
    approvalRate: pct(
      decided.filter((t) => t.status === 'completed').length,
      decided.length,
    ),
  };
}
export function staffProductivity(tasks: TaskFacts[], now = new Date()) {
  const by = new Map<string, TaskFacts[]>();
  for (const t of tasks)
    for (const e of t.assigneeIds) by.set(e, [...(by.get(e) || []), t]);
  return [...by.entries()].map(([employeeId, list]) => {
    const m = taskMetrics(list, now);
    const live = list.filter((t) => t.status !== 'cancelled');
    const rec = live
      .map(recordedMinutes)
      .filter((x): x is number => x !== null);
    return {
      employeeId,
      assigned: live.length,
      completed: m.completed,
      pending: m.pending,
      overdue: m.overdue,
      rework: m.reworkCount,
      workloadMinutes: live.reduce((s, t) => s + (t.estimatedMinutes || 0), 0),
      recordedMinutes: rec.reduce((s, x) => s + x, 0),
      onTimeRate: m.onTimeRate,
    };
  });
}

/* ================================================================ SLA */
export type CaseFacts = {
  kind: string;
  status: string;
  priority: string;
  open: boolean;
  createdAt: Date;
  responseDueAt: Date | null;
  resolutionDueAt: Date | null;
  respondedAt: Date | null;
  resolvedAt: Date | null;
};
/** Uses only the targets stored on each case when it was created (historical policy snapshots). */
export function slaFacts(c: CaseFacts, now = new Date()) {
  const responseBreached =
    !!c.responseDueAt &&
    (c.respondedAt ? c.respondedAt > c.responseDueAt : now > c.responseDueAt);
  const resolutionBreached =
    !!c.resolutionDueAt &&
    (c.resolvedAt
      ? c.resolvedAt > c.resolutionDueAt
      : c.open && now > c.resolutionDueAt);
  return {
    responseBreached,
    resolutionBreached,
    hasTargets: !!(c.responseDueAt || c.resolutionDueAt),
    responseMinutes: c.respondedAt
      ? Math.round((c.respondedAt.getTime() - c.createdAt.getTime()) / 60000)
      : null,
    resolutionMinutes: c.resolvedAt
      ? Math.round((c.resolvedAt.getTime() - c.createdAt.getTime()) / 60000)
      : null,
  };
}
export function slaMetrics(cases: CaseFacts[], now = new Date(), reopened = 0) {
  const f = cases.map((c) => ({ c, s: slaFacts(c, now) }));
  const targeted = f.filter((x) => x.s.hasTargets);
  return {
    total: cases.length,
    withTargets: targeted.length,
    withinSla: targeted.filter(
      (x) => !x.s.responseBreached && !x.s.resolutionBreached,
    ).length,
    responseBreached: f.filter((x) => x.s.responseBreached).length,
    resolutionBreached: f.filter((x) => x.s.resolutionBreached).length,
    avgResponseMinutes: avg(
      f.map((x) => x.s.responseMinutes).filter((x): x is number => x !== null),
    ),
    avgResolutionMinutes: avg(
      f
        .map((x) => x.s.resolutionMinutes)
        .filter((x): x is number => x !== null),
    ),
    escalations: cases.filter((c) => c.kind === 'escalations').length,
    openCritical: cases.filter((c) => c.open && c.priority === 'critical')
      .length,
    reopened,
  };
}

/* ================================================================ inventory */
export type MovementFacts = {
  materialId: string;
  movementType: string;
  fromStoreId: string;
  toStoreId: string;
  quantity: number;
  createdAt: Date;
};
export type StockLine = {
  materialId: string;
  storeId: string;
  opening: number;
  received: number;
  issued: number;
  transferIn: number;
  transferOut: number;
  adjusted: number;
  reversed: number;
  closing: number;
};
/**
 * Reconciles the ledger for a period: movements before `from` form the
 * opening balance; reversals and transfers are applied with their real store
 * effects (movementEffects), so closing == ledger balance.
 */
export function stockReconciliation(
  movements: MovementFacts[],
  from: Date,
  to: Date,
) {
  const lines = new Map<string, StockLine>();
  const line = (materialId: string, storeId: string) => {
    const k = `${storeId}|${materialId}`;
    if (!lines.has(k))
      lines.set(k, {
        materialId,
        storeId,
        opening: 0,
        received: 0,
        issued: 0,
        transferIn: 0,
        transferOut: 0,
        adjusted: 0,
        reversed: 0,
        closing: 0,
      });
    return lines.get(k)!;
  };
  for (const m of [...movements].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )) {
    if (m.createdAt > to) continue;
    for (const e of movementEffects(m)) {
      const l = line(m.materialId, e.storeId);
      if (m.createdAt < from) {
        l.opening += e.delta;
        continue;
      }
      if (m.movementType === 'opening' || m.movementType === 'receipt')
        l.received += e.delta;
      else if (m.movementType === 'issue') l.issued += -e.delta;
      else if (m.movementType === 'transfer') {
        if (e.delta > 0) l.transferIn += e.delta;
        else l.transferOut += -e.delta;
      } else if (m.movementType.startsWith('adjustment')) l.adjusted += e.delta;
      else if (m.movementType === 'reversal') l.reversed += e.delta;
    }
  }
  for (const l of lines.values())
    l.closing =
      l.opening +
      l.received -
      l.issued +
      l.transferIn -
      l.transferOut +
      l.adjusted +
      l.reversed;
  return [...lines.values()];
}

/* ================================================================ attendance */
export type AttendanceFacts = {
  date: string;
  status: string;
  checkIn: Date;
  checkOut: Date | null;
  lateMinutes: number;
  corrected: boolean;
  hasLocation: boolean;
};
/** Flags computed in the site's local date; a check-out still missing after that day is "missed". */
export function attendanceFlags(a: AttendanceFacts, todayLocal: string) {
  const flags: string[] = [];
  if (a.lateMinutes > 0) flags.push('late');
  if (!a.checkOut && a.date < todayLocal) flags.push('missed_check_out');
  if (a.corrected) flags.push('corrected');
  return flags;
}

/* ================================================================ compliance */
export type ComplianceFacts = {
  verified: boolean;
  expiryDate: string;
  evidenceRef: string;
};
export type ComplianceStatus =
  'valid' | 'expiring' | 'expired' | 'evidence_pending';
/** Only verified records with evidence count as valid. */
export function complianceStatus(
  r: ComplianceFacts,
  todayLocal: string,
  warnDays = 30,
): ComplianceStatus {
  if (!r.verified || !r.evidenceRef.trim()) return 'evidence_pending';
  if (r.expiryDate && r.expiryDate < todayLocal) return 'expired';
  if (r.expiryDate) {
    const days = (Date.parse(r.expiryDate) - Date.parse(todayLocal)) / 86400000;
    if (days <= warnDays) return 'expiring';
  }
  return 'valid';
}
export const complianceCategories = [
  'Fire safety',
  'Electrical',
  'HVAC',
  'Lifts & escalators',
  'Water & plumbing',
  'Equipment inspection',
  'Health & safety',
  'Other',
] as const;

/* ================================================================ costs */
export const costTypes = ['labor', 'vendor', 'material', 'other'] as const;
export type CostFacts = {
  type: string;
  amount: number;
  workOrderId: string;
  assetId: string;
};
/** Recorded maintenance cost only; asset purchase value is never mixed in. */
export function costSummary(costs: CostFacts[]) {
  const byType = Object.fromEntries(costTypes.map((t) => [t, 0])) as Record<
    (typeof costTypes)[number],
    number
  >;
  for (const c of costs)
    byType[
      (costTypes as readonly string[]).includes(c.type)
        ? (c.type as (typeof costTypes)[number])
        : 'other'
    ] += c.amount;
  return { total: Object.values(byType).reduce((s, x) => s + x, 0), byType };
}

/* ================================================================ customers */
export type AllocationFacts = {
  status: string;
  startDate: string;
  endDate: string;
  effectiveEndDate: string;
  siteId: string;
  locationId: string;
};
/** An allocation grants access only while active and inside its dates (effective end wins). */
export function allocationActive(a: AllocationFacts, todayLocal: string) {
  const end = a.effectiveEndDate || a.endDate;
  return (
    a.status === 'active' &&
    a.startDate <= todayLocal &&
    (!end || end >= todayLocal)
  );
}
/** Site-wide allocations (no location) cover the site; otherwise only the allocated location. */
export function allocationCovers(
  a: AllocationFacts,
  siteId: string,
  locationId: string,
) {
  return (
    a.siteId === siteId && (a.locationId === '' || a.locationId === locationId)
  );
}
export const requestStatuses = [
  'submitted',
  'in_progress',
  'resolved',
  'closed',
  'reopen_requested',
  'cancelled',
] as const;
/** Customer-facing status for an internal complaint status. */
export function customerStatus(internal: string) {
  return internal === 'open'
    ? 'submitted'
    : internal === 'assigned' || internal === 'in_progress'
      ? 'in_progress'
      : internal === 'resolved'
        ? 'resolved'
        : internal === 'closed'
          ? 'closed'
          : internal === 'cancelled'
            ? 'cancelled'
            : 'in_progress';
}
export const customerStepLabels: Record<string, string> = {
  create: 'Request submitted',
  assign: 'Assigned to the service team',
  start: 'Work started',
  link: 'Work order created',
  resolve: 'Resolved',
  close: 'Closed',
  reopen: 'Reopened',
  cancel: 'Cancelled',
};
