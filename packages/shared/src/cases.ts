/**
 * Phase 4 cases: corrective work orders, complaints and escalations share one
 * lifecycle engine. Each kind declares its statuses and transitions; the
 * browser, tests and generated Firestore rules all read these tables.
 */
export const caseKinds = ['workOrders', 'complaints', 'escalations'] as const;
export type CaseKind = (typeof caseKinds)[number];
export type CaseAction = {
  label: string;
  from: string[];
  to: string;
  /** Reason/note text required with the action. */
  reason?: boolean;
  /** The action marks the first response (sets respondedAt if unset). */
  responds?: boolean;
  /** The action resolves (sets resolvedAt) or reopens (clears resolvedAt). */
  resolves?: boolean;
  reopens?: boolean;
  closes?: boolean;
  /** Assignment changes are allowed with this action. */
  assigns?: boolean;
  /** Target department changes are allowed with this action. */
  redirects?: boolean;
};
export type CaseDefinition = {
  title: string;
  singular: string;
  prefix: string;
  statuses: string[];
  initial: string;
  open: string[];
  actions: Record<string, CaseAction>;
};
const workOrderOpen = [
  'reported',
  'reviewed',
  'assigned',
  'in_progress',
  'on_hold',
];
export const caseDefinitions: Record<CaseKind, CaseDefinition> = {
  workOrders: {
    title: 'Work orders',
    singular: 'work order',
    prefix: 'WO',
    statuses: [
      'reported',
      'reviewed',
      'assigned',
      'in_progress',
      'on_hold',
      'resolved',
      'verified',
      'closed',
      'cancelled',
    ],
    initial: 'reported',
    open: workOrderOpen,
    actions: {
      review: {
        label: 'Mark reviewed',
        from: ['reported'],
        to: 'reviewed',
        responds: true,
      },
      assign: {
        label: 'Assign',
        from: ['reported', 'reviewed', 'assigned', 'on_hold'],
        to: 'assigned',
        assigns: true,
        responds: true,
      },
      start: {
        label: 'Start work',
        from: ['assigned'],
        to: 'in_progress',
        responds: true,
      },
      hold: {
        label: 'Put on hold',
        from: ['assigned', 'in_progress'],
        to: 'on_hold',
        reason: true,
      },
      resume: { label: 'Resume', from: ['on_hold'], to: 'in_progress' },
      resolve: {
        label: 'Mark resolved',
        from: ['in_progress'],
        to: 'resolved',
        reason: true,
        resolves: true,
      },
      verify: { label: 'Verify fix', from: ['resolved'], to: 'verified' },
      close: {
        label: 'Close',
        from: ['resolved', 'verified'],
        to: 'closed',
        closes: true,
      },
      reopen: {
        label: 'Reopen',
        from: ['resolved', 'verified', 'closed'],
        to: 'in_progress',
        reason: true,
        reopens: true,
      },
      cancel: {
        label: 'Cancel',
        from: ['reported', 'reviewed', 'assigned', 'on_hold'],
        to: 'cancelled',
        reason: true,
        closes: true,
      },
    },
  },
  complaints: {
    title: 'Complaints',
    singular: 'complaint',
    prefix: 'CMP',
    statuses: [
      'open',
      'assigned',
      'in_progress',
      'resolved',
      'closed',
      'cancelled',
    ],
    initial: 'open',
    open: ['open', 'assigned', 'in_progress'],
    actions: {
      assign: {
        label: 'Assign',
        from: ['open', 'assigned'],
        to: 'assigned',
        assigns: true,
        responds: true,
      },
      start: {
        label: 'Start',
        from: ['assigned'],
        to: 'in_progress',
        responds: true,
      },
      resolve: {
        label: 'Resolve',
        from: ['assigned', 'in_progress'],
        to: 'resolved',
        reason: true,
        resolves: true,
        responds: true,
      },
      close: { label: 'Close', from: ['resolved'], to: 'closed', closes: true },
      reopen: {
        label: 'Reopen',
        from: ['resolved', 'closed'],
        to: 'in_progress',
        reason: true,
        reopens: true,
      },
      cancel: {
        label: 'Cancel',
        from: ['open', 'assigned'],
        to: 'cancelled',
        reason: true,
        closes: true,
      },
    },
  },
  escalations: {
    title: 'Escalations',
    singular: 'escalation',
    prefix: 'ESC',
    statuses: ['raised', 'acknowledged', 'in_progress', 'resolved', 'closed'],
    initial: 'raised',
    open: ['raised', 'acknowledged', 'in_progress'],
    actions: {
      acknowledge: {
        label: 'Acknowledge',
        from: ['raised'],
        to: 'acknowledged',
        responds: true,
        assigns: true,
      },
      reassign: {
        label: 'Reassign department',
        from: ['raised', 'acknowledged', 'in_progress'],
        to: 'raised',
        reason: true,
        redirects: true,
      },
      start: {
        label: 'Start',
        from: ['acknowledged'],
        to: 'in_progress',
        responds: true,
      },
      resolve: {
        label: 'Resolve',
        from: ['acknowledged', 'in_progress'],
        to: 'resolved',
        reason: true,
        resolves: true,
        responds: true,
      },
      close: { label: 'Close', from: ['resolved'], to: 'closed', closes: true },
    },
  },
};
export const caseSources = [
  'manual',
  'task',
  'task_exception',
  'complaint',
  'work_order',
  'escalation',
  'inspection',
  'asset',
] as const;
export const severities = ['low', 'medium', 'high', 'critical'] as const;
export const complaintSources = [
  'admin',
  'staff',
  'client',
  'task_exception',
  'inspection',
] as const;
export const problemCategories = [
  'HVAC',
  'Electrical',
  'Plumbing',
  'Civil / structural',
  'Fire & safety',
  'Cleaning',
  'Pest control',
  'Security',
  'IT / low current',
  'Furniture',
  'Landscaping',
  'Other',
] as const;
export function canDo(kind: CaseKind, action: string, status: string) {
  const a = caseDefinitions[kind].actions[action];
  return !!a && a.from.includes(status);
}
export function availableActions(kind: CaseKind, status: string) {
  return Object.entries(caseDefinitions[kind].actions)
    .filter(([, a]) => a.from.includes(status))
    .map(([id, a]) => ({ id, ...a }));
}
export function caseNumber(kind: CaseKind, date = new Date()) {
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return `${caseDefinitions[kind].prefix}-${date.toISOString().slice(2, 10).replaceAll('-', '')}-${r[0].toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
}
/**
 * Deterministic IDs for linked records, so retried or repeated processing of
 * the same exception/complaint cannot create a second work order or escalation.
 */
export function linkedCaseId(
  kind: CaseKind,
  sourceType: string,
  sourceId: string,
  suffix = '',
) {
  return `${kind === 'workOrders' ? 'wo' : kind === 'complaints' ? 'cmp' : 'esc'}_${sourceType}_${sourceId}${suffix ? '_' + suffix : ''}`.slice(
    0,
    128,
  );
}

/* ------------------------------------------------------------ notifications */
export const notificationTypes = [
  'task_assigned',
  'task_due_soon',
  'task_overdue',
  'task_reassigned',
  'task_submitted',
  'task_awaiting_approval',
  'task_rejected',
  'task_rework',
  'work_order_created',
  'work_order_assigned',
  'escalation_raised',
  'sla_breach',
  'maintenance_due',
  'complaint_created',
] as const;
export type NotificationType = (typeof notificationTypes)[number];
export const notificationLabels: Record<NotificationType, string> = {
  task_assigned: 'New task assigned',
  task_due_soon: 'Task due soon',
  task_overdue: 'Task overdue',
  task_reassigned: 'Task reassigned',
  task_submitted: 'Task submitted',
  task_awaiting_approval: 'Task awaiting approval',
  task_rejected: 'Task rejected',
  task_rework: 'Rework required',
  work_order_created: 'Work order created',
  work_order_assigned: 'Work order assigned',
  escalation_raised: 'Escalation raised',
  sla_breach: 'SLA breach',
  maintenance_due: 'Maintenance due',
  complaint_created: 'Complaint registered',
};
/** Deterministic notification ID: one notification per event per recipient. */
export function notificationId(
  type: NotificationType,
  recordId: string,
  eventKey: string,
  recipientUid: string,
) {
  const raw = `${type}_${recordId}_${eventKey}_${recipientUid}`;
  if (raw.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(raw)) return raw;
  let h = 0;
  for (const ch of raw) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
  return `${type}_${(h >>> 0).toString(36)}_${raw.length}`.slice(0, 128);
}
