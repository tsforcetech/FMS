import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  getCountFromServer,
  type Firestore,
  type QueryConstraint,
  type Transaction,
} from 'firebase/firestore';
import {
  caseDefinitions,
  caseNumber,
  linkedCaseId,
  parseWorkingDays,
  pickPolicy,
  slaDue,
  type CaseKind,
  type SlaPolicy,
} from '@facilityos/shared';
import { UserError } from './store';
import { adminUids, linkedUids, notifySafely } from './notifyStore';

export type CaseRecord = {
  id: string;
  kind: CaseKind;
  number: string;
  title: string;
  description: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  siteId: string;
  locationId: string;
  facilityId: string;
  assetId: string;
  departmentId: string;
  targetDepartmentId: string;
  supervisorId: string;
  assigneeIds: string[];
  sourceType: string;
  sourceId: string;
  parentId: string;
  level: number;
  reportedBy: string;
  clientId: string;
  contractId: string;
  workOrderId: string;
  complaintId: string;
  plannedDate: Timestamp | null;
  dueAt: Timestamp | null;
  slaPolicyId: string;
  responseDueAt: Timestamp | null;
  resolutionDueAt: Timestamp | null;
  respondedAt: Timestamp | null;
  resolvedAt: Timestamp | null;
  closedAt: Timestamp | null;
  resolution: string;
  notes: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  revision: number;
};
export type CaseEvent = {
  id: string;
  kind: CaseKind;
  caseId: string;
  revision: number;
  action: string;
  fromStatus: string;
  toStatus: string;
  actorUid: string;
  at: Timestamp;
  note: string;
  assigneeIds: string[];
  targetDepartmentId: string;
};
export type NewCase = {
  title: string;
  description: string;
  priority: CaseRecord['priority'];
  severity: CaseRecord['severity'];
  category: string;
  siteId: string;
  locationId: string;
  facilityId: string;
  assetId: string;
  departmentId: string;
  targetDepartmentId: string;
  supervisorId: string;
  sourceType: string;
  sourceId: string;
  parentId: string;
  level: number;
  reportedBy: string;
  clientId: string;
  contractId: string;
  complaintId: string;
  plannedDate: string;
  notes: string;
};
export function emptyCase(kind: CaseKind): NewCase {
  return {
    title: '',
    description: '',
    priority: 'medium',
    severity: 'medium',
    category: '',
    siteId: '',
    locationId: '',
    facilityId: '',
    assetId: '',
    departmentId: '',
    targetDepartmentId: '',
    supervisorId: '',
    sourceType: kind === 'complaints' ? 'admin' : 'manual',
    sourceId: '',
    parentId: '',
    level: 1,
    reportedBy: '',
    clientId: '',
    contractId: '',
    complaintId: '',
    plannedDate: '',
    notes: '',
  };
}
const col = (db: Firestore, c: string, name: string) =>
  collection(db, 'companies', c, name);
const ref = (db: Firestore, c: string, name: string, id: string) =>
  doc(db, 'companies', c, name, id);
const caseEvent = (
  c: string,
  kind: CaseKind,
  caseId: string,
  revision: number,
  action: string,
  from: string,
  to: string,
  uid: string,
  note: string,
  assigneeIds: string[],
  targetDepartmentId: string,
) => ({
  companyId: c,
  schemaVersion: 1,
  kind,
  caseId,
  revision,
  action,
  fromStatus: from,
  toStatus: to,
  actorUid: uid,
  at: serverTimestamp(),
  note: note.slice(0, 1000),
  assigneeIds,
  targetDepartmentId,
});

/** Active SLA policies (master records). */
export async function activePolicies(db: Firestore, c: string) {
  const r = await getDocs(
    query(
      col(db, c, 'slaPolicies'),
      where('status', '==', 'active'),
      limit(100),
    ),
  );
  return r.docs.map(
    (d) =>
      ({
        id: d.id,
        priority: d.data().priority,
        appliesTo: d.data().appliesTo,
        siteId: d.data().siteId || '',
        departmentId: d.data().departmentId || '',
        responseMinutes: Number(d.data().responseMinutes),
        resolutionMinutes: Number(d.data().resolutionMinutes),
        hoursMode: d.data().hoursMode,
        name: d.data().name as string,
      }) as SlaPolicy & { name: string },
  );
}
/** Site business calendar used for business-hours SLA targets. */
export async function siteCalendar(db: Firestore, c: string, siteId: string) {
  const [site, company, holidays] = await Promise.all([
    getDoc(ref(db, c, 'sites', siteId)),
    getDoc(doc(db, 'companies', c)),
    getDocs(
      query(
        col(db, c, 'holidays'),
        where('status', '==', 'active'),
        limit(500),
      ),
    ),
  ]);
  const s = site.data() || {};
  return {
    timeZone: s.timeZone || company.data()?.timeZone || 'UTC',
    workingDays: parseWorkingDays(s.workingDays),
    opensAt: /^\d\d:\d\d$/.test(s.opensAt || '') ? s.opensAt : '',
    closesAt: /^\d\d:\d\d$/.test(s.closesAt || '') ? s.closesAt : '',
    holidays: new Set(
      holidays.docs
        .map((h) => h.data())
        .filter((h) => !h.siteId || h.siteId === siteId)
        .map((h) => h.holidayDate as string),
    ),
  };
}

async function writeCase(
  tx: Transaction,
  db: Firestore,
  c: string,
  uid: string,
  kind: CaseKind,
  id: string,
  input: NewCase,
  sla: {
    policy: (SlaPolicy & { name: string }) | null;
    responseDueAt: Date | null;
    resolutionDueAt: Date | null;
  },
) {
  const def = caseDefinitions[kind];
  const site = await tx.get(ref(db, c, 'sites', input.siteId));
  if (!site.exists() || site.data().status === 'archived')
    throw new UserError('Choose an active site.');
  for (const [k, key] of [
    ['locations', 'locationId'],
    ['facilities', 'facilityId'],
    ['assets', 'assetId'],
  ] as const) {
    if (!input[key]) continue;
    const s = await tx.get(ref(db, c, k, input[key]));
    if (
      !s.exists() ||
      s.data().siteId !== input.siteId ||
      s.data().status === 'archived'
    )
      throw new UserError(
        `The selected ${k.slice(0, -1)} must be active and in this site.`,
      );
  }
  const planned = input.plannedDate ? new Date(input.plannedDate) : null;
  tx.set(ref(db, c, kind, id), {
    companyId: c,
    schemaVersion: 1,
    kind,
    number: caseNumber(kind),
    title: input.title.trim().slice(0, 160),
    description: input.description.slice(0, 4000),
    status: def.initial,
    priority: input.priority,
    severity: input.severity,
    category: input.category.slice(0, 60),
    siteId: input.siteId,
    locationId: input.locationId,
    facilityId: input.facilityId,
    assetId: input.assetId,
    departmentId: input.departmentId,
    targetDepartmentId: input.targetDepartmentId,
    supervisorId: input.supervisorId,
    assigneeIds: [],
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    parentId: input.parentId,
    level: input.level,
    reportedBy: input.reportedBy.slice(0, 120),
    clientId: input.clientId,
    contractId: input.contractId,
    workOrderId: '',
    complaintId: input.complaintId,
    plannedDate:
      planned && !isNaN(planned.getTime()) ? Timestamp.fromDate(planned) : null,
    dueAt: sla.resolutionDueAt ? Timestamp.fromDate(sla.resolutionDueAt) : null,
    slaPolicyId: sla.policy?.id || '',
    responseDueAt: sla.responseDueAt
      ? Timestamp.fromDate(sla.responseDueAt)
      : null,
    resolutionDueAt: sla.resolutionDueAt
      ? Timestamp.fromDate(sla.resolutionDueAt)
      : null,
    respondedAt: null,
    resolvedAt: null,
    closedAt: null,
    resolution: '',
    notes: input.notes.slice(0, 2000),
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    revision: 1,
  });
  tx.set(
    ref(db, c, 'caseEvents', `${kind}_${id}_1`),
    caseEvent(
      c,
      kind,
      id,
      1,
      'create',
      '',
      def.initial,
      uid,
      sla.policy ? `SLA policy: ${sla.policy.name}` : 'No SLA policy matched',
      [],
      input.targetDepartmentId,
    ),
  );
}

async function slaFor(
  db: Firestore,
  c: string,
  kind: CaseKind,
  input: NewCase,
  now: Date,
) {
  const policy = pickPolicy(await activePolicies(db, c), {
    priority: input.priority,
    kind,
    siteId: input.siteId,
    departmentId: input.departmentId || input.targetDepartmentId,
  }) as (SlaPolicy & { name: string }) | null;
  if (!policy)
    return { policy: null, responseDueAt: null, resolutionDueAt: null };
  const due = slaDue(policy, now, await siteCalendar(db, c, input.siteId));
  return { policy, ...due };
}

/**
 * Creates a case. When it comes from another record (exception, complaint,
 * escalation) its ID is derived from that source, so repeating the action
 * returns the existing record instead of creating a duplicate.
 */
export async function createCase(
  db: Firestore,
  c: string,
  uid: string,
  kind: CaseKind,
  input: NewCase,
  opts: { linkedSuffix?: string; now?: Date } = {},
) {
  if (!input.title.trim()) throw new UserError('Enter a title.');
  if (!input.siteId) throw new UserError('Choose a site.');
  if (kind === 'escalations' && !input.targetDepartmentId)
    throw new UserError('Choose the department to escalate to.');
  const linked = !!input.sourceId && input.sourceType !== 'manual';
  const id = linked
    ? linkedCaseId(kind, input.sourceType, input.sourceId, opts.linkedSuffix)
    : doc(col(db, c, kind)).id;
  const sla = await slaFor(db, c, kind, input, opts.now || new Date());
  const created = await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref(db, c, kind, id));
    if (existing.exists()) return false;
    await writeCase(tx, db, c, uid, kind, id, input, sla);
    return true;
  });
  if (created)
    await notifySafely(db, c, uid, adminUids(db, c), {
      type:
        kind === 'workOrders'
          ? 'work_order_created'
          : kind === 'complaints'
            ? 'complaint_created'
            : 'escalation_raised',
      recordKind: kind,
      recordId: id,
      eventKey: 'r1',
      body: input.title.slice(0, 200),
    });
  return { id, created };
}

/** Creates (once) a work order from a complaint and links it on the complaint. */
export async function workOrderFromComplaint(
  db: Firestore,
  c: string,
  uid: string,
  complaint: CaseRecord,
) {
  const input: NewCase = {
    ...emptyCase('workOrders'),
    title: complaint.title,
    description: complaint.description,
    priority: complaint.priority,
    severity: complaint.severity,
    category: complaint.category,
    siteId: complaint.siteId,
    locationId: complaint.locationId,
    facilityId: complaint.facilityId,
    assetId: complaint.assetId,
    departmentId: complaint.departmentId,
    sourceType: 'complaint',
    sourceId: complaint.id,
    reportedBy: complaint.reportedBy,
    clientId: complaint.clientId,
    contractId: complaint.contractId,
    complaintId: complaint.id,
  };
  const id = linkedCaseId('workOrders', 'complaint', complaint.id);
  const sla = await slaFor(db, c, 'workOrders', input, new Date());
  const created = await runTransaction(db, async (tx) => {
    const cmp = await tx.get(ref(db, c, 'complaints', complaint.id));
    if (!cmp.exists()) throw new UserError('This complaint no longer exists.');
    const existing = await tx.get(ref(db, c, 'workOrders', id));
    const data = cmp.data() as CaseRecord;
    if (existing.exists() && data.workOrderId) return false;
    if (!existing.exists())
      await writeCase(tx, db, c, uid, 'workOrders', id, input, sla);
    if (!data.workOrderId) {
      const revision = data.revision + 1;
      tx.update(ref(db, c, 'complaints', complaint.id), {
        workOrderId: id,
        revision,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
      tx.set(
        ref(db, c, 'caseEvents', `complaints_${complaint.id}_${revision}`),
        caseEvent(
          c,
          'complaints',
          complaint.id,
          revision,
          'link',
          data.status,
          data.status,
          uid,
          `Work order created`,
          data.assigneeIds,
          data.targetDepartmentId,
        ),
      );
    }
    return !existing.exists();
  });
  if (created)
    await notifySafely(db, c, uid, adminUids(db, c), {
      type: 'work_order_created',
      recordKind: 'workOrders',
      recordId: id,
      eventKey: 'r1',
      body: complaint.title,
    });
  return { id, created };
}

/** Applies a lifecycle action. The rules enforce the same transition table. */
export async function transitionCase(
  db: Firestore,
  c: string,
  uid: string,
  record: CaseRecord,
  action: string,
  opts: {
    note?: string;
    assigneeIds?: string[];
    targetDepartmentId?: string;
  } = {},
) {
  const def = caseDefinitions[record.kind];
  const a = def.actions[action];
  if (!a) throw new UserError('Unknown action.');
  const note = (opts.note || '').trim();
  if (a.reason && !note)
    throw new UserError('Enter a reason or resolution note.');
  if (a.assigns && action === 'assign' && !opts.assigneeIds?.length)
    throw new UserError('Choose at least one employee.');
  if (
    a.redirects &&
    (!opts.targetDepartmentId ||
      opts.targetDepartmentId === record.targetDepartmentId)
  )
    throw new UserError('Choose a different department.');
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, record.kind, record.id));
    if (!s.exists()) throw new UserError('This record no longer exists.');
    const fresh = { id: s.id, ...s.data() } as CaseRecord;
    if (fresh.revision !== record.revision)
      throw new UserError(
        'This record was updated by someone else. Reload and try again.',
      );
    if (!a.from.includes(fresh.status))
      throw new UserError(
        `“${a.label}” is not available while ${fresh.status.replaceAll('_', ' ')}.`,
      );
    if (a.assigns && opts.assigneeIds)
      for (const e of opts.assigneeIds) {
        const emp = await tx.get(ref(db, c, 'employees', e));
        if (
          !emp.exists() ||
          ['archived', 'terminated', 'resigned', 'suspended'].includes(
            emp.data().status,
          )
        )
          throw new UserError('Assign active employees only.');
      }
    const revision = fresh.revision + 1;
    const assigneeIds =
      a.assigns && opts.assigneeIds
        ? opts.assigneeIds.slice(0, 10)
        : fresh.assigneeIds;
    const targetDepartmentId = a.redirects
      ? opts.targetDepartmentId!
      : fresh.targetDepartmentId;
    const to = a.to || fresh.status;
    tx.update(ref(db, c, record.kind, record.id), {
      status: to,
      assigneeIds,
      targetDepartmentId,
      ...(a.responds && !fresh.respondedAt
        ? { respondedAt: serverTimestamp() }
        : {}),
      ...(a.resolves
        ? { resolvedAt: serverTimestamp(), resolution: note.slice(0, 2000) }
        : {}),
      ...(a.reopens ? { resolvedAt: null, closedAt: null } : {}),
      ...(a.closes ? { closedAt: serverTimestamp() } : {}),
      revision,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    tx.set(
      ref(db, c, 'caseEvents', `${record.kind}_${record.id}_${revision}`),
      caseEvent(
        c,
        record.kind,
        record.id,
        revision,
        action,
        fresh.status,
        to,
        uid,
        note,
        assigneeIds,
        targetDepartmentId,
      ),
    );
  });
  if (a.assigns && opts.assigneeIds?.length && record.kind === 'workOrders')
    await notifySafely(db, c, uid, linkedUids(db, c, opts.assigneeIds), {
      type: 'work_order_assigned',
      recordKind: 'workOrders',
      recordId: record.id,
      eventKey: `r${record.revision + 1}`,
      body: `${record.number} ${record.title}`,
    });
  if (a.redirects)
    await notifySafely(db, c, uid, adminUids(db, c), {
      type: 'escalation_raised',
      recordKind: 'escalations',
      recordId: record.id,
      eventKey: `r${record.revision + 1}`,
      body: `${record.number} reassigned: ${note}`,
    });
}

/** Escalates further: one escalation per parent and level. */
export async function escalateFurther(
  db: Firestore,
  c: string,
  uid: string,
  parent: CaseRecord,
  targetDepartmentId: string,
  reason: string,
) {
  if (!reason.trim()) throw new UserError('Enter a reason for escalating.');
  return createCase(
    db,
    c,
    uid,
    'escalations',
    {
      ...emptyCase('escalations'),
      title: `${parent.number}: ${parent.title}`.slice(0, 160),
      description: reason,
      priority: parent.priority,
      severity: parent.severity,
      category: parent.category,
      siteId: parent.siteId,
      locationId: parent.locationId,
      facilityId: parent.facilityId,
      assetId: parent.assetId,
      departmentId: parent.departmentId,
      targetDepartmentId,
      sourceType:
        parent.kind === 'escalations'
          ? 'escalation'
          : parent.kind === 'complaints'
            ? 'complaint'
            : 'work_order',
      sourceId: parent.id,
      parentId: parent.kind === 'escalations' ? parent.id : '',
      level: parent.kind === 'escalations' ? Math.min(10, parent.level + 1) : 1,
      reportedBy: parent.reportedBy,
    },
    {
      linkedSuffix: `L${parent.kind === 'escalations' ? parent.level + 1 : 1}`,
    },
  );
}

export type CaseFilter = {
  status?: string;
  siteId?: string;
  sourceId?: string;
  assetId?: string;
  targetDepartmentId?: string;
};
export async function listCases(
  db: Firestore,
  c: string,
  kind: CaseKind,
  f: CaseFilter = {},
  max = 100,
) {
  const cons: QueryConstraint[] = [];
  const key = (
    ['status', 'siteId', 'sourceId', 'assetId', 'targetDepartmentId'] as const
  ).find((k) => f[k]);
  if (key) cons.push(where(key, '==', f[key]));
  const r = await getDocs(
    query(col(db, c, kind), ...cons, orderBy('createdAt', 'desc'), limit(max)),
  );
  let out = r.docs.map((d) => ({ id: d.id, ...d.data() }) as CaseRecord);
  for (const k of ['status', 'siteId'] as const)
    if (f[k] && k !== key) out = out.filter((x) => x[k] === f[k]);
  return out;
}
export async function getCase(
  db: Firestore,
  c: string,
  kind: CaseKind,
  id: string,
) {
  const s = await getDoc(ref(db, c, kind, id));
  return s.exists() ? ({ id: s.id, ...s.data() } as CaseRecord) : null;
}
export async function caseEvents(
  db: Firestore,
  c: string,
  kind: CaseKind,
  id: string,
) {
  const r = await getDocs(
    query(
      col(db, c, 'caseEvents'),
      where('kind', '==', kind),
      where('caseId', '==', id),
      orderBy('revision'),
      limit(200),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as CaseEvent);
}
export async function openCaseCount(db: Firestore, c: string, kind: CaseKind) {
  const r = await getCountFromServer(
    query(col(db, c, kind), where('status', 'in', caseDefinitions[kind].open)),
  );
  return r.data().count;
}
/** Open cases past their stored resolution target (from stored timestamps). */
export async function breachedCases(
  db: Firestore,
  c: string,
  kind: CaseKind,
  now = new Date(),
) {
  const r = await getDocs(
    query(
      col(db, c, kind),
      where('status', 'in', caseDefinitions[kind].open),
      where('resolutionDueAt', '<', Timestamp.fromDate(now)),
      orderBy('resolutionDueAt'),
      limit(100),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as CaseRecord);
}
/** Materials issued against a work order (inventory ledger). */
export async function workOrderMaterials(
  db: Firestore,
  c: string,
  workOrderId: string,
) {
  const r = await getDocs(
    query(
      col(db, c, 'stockMovements'),
      where('workOrderId', '==', workOrderId),
      orderBy('createdAt', 'desc'),
      limit(100),
    ),
  );
  return r.docs.map(
    (d) =>
      ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string },
  );
}
