import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import {
  costTypes,
  type AttendanceFacts,
  type CaseFacts,
  type CostFacts,
  type MovementFacts,
  type TaskFacts,
} from '@facilityos/shared';
import { UserError } from './store';

/**
 * Phase 7 report data. Detail rows are fetched in bounded pages (never an
 * unbounded collection read); headline counts use server count aggregates on
 * existing composite indexes. Every loader returns `truncated` so the screen
 * can say when the period holds more rows than an interactive view reads.
 */
const col = (db: Firestore, c: string, name: string) =>
  collection(db, 'companies', c, name);
const ref = (db: Firestore, c: string, name: string, id: string) =>
  doc(db, 'companies', c, name, id);
export const toDate = (v: unknown): Date | null =>
  v && typeof (v as Timestamp).toDate === 'function'
    ? (v as Timestamp).toDate()
    : null;

export type Range = { from: Date; to: Date };
export type Loaded<T> = { rows: T[]; truncated: boolean };
const PAGE = 500;

export async function boundedFetch(
  db: Firestore,
  c: string,
  name: string,
  constraints: QueryConstraint[],
  max = 3000,
): Promise<Loaded<QueryDocumentSnapshot<DocumentData>>> {
  const out: QueryDocumentSnapshot<DocumentData>[] = [];
  let last: QueryDocumentSnapshot<DocumentData> | null = null;
  for (;;) {
    const size = Math.min(PAGE, max - out.length);
    const r: QuerySnapshot<DocumentData> = await getDocs(
      query(
        col(db, c, name),
        ...constraints,
        ...(last ? [startAfter(last)] : []),
        limit(size + 1),
      ),
    );
    const page: QueryDocumentSnapshot<DocumentData>[] = r.docs.slice(0, size);
    out.push(...page);
    if (r.docs.length <= size) return { rows: out, truncated: false };
    if (out.length >= max) return { rows: out, truncated: true };
    last = page[page.length - 1];
  }
}

/* ===================================================================== tasks */
export type TaskRow = TaskFacts & {
  id: string;
  title: string;
  siteId: string;
  locationId: string;
  departmentId: string;
  templateId: string;
  categoryId: string;
};
export async function loadTasks(
  db: Firestore,
  c: string,
  range: Range,
  max = 3000,
): Promise<Loaded<TaskRow>> {
  const r = await boundedFetch(
    db,
    c,
    'tasks',
    [
      where('dueAt', '>=', Timestamp.fromDate(range.from)),
      where('dueAt', '<', Timestamp.fromDate(range.to)),
      orderBy('dueAt'),
    ],
    max,
  );
  return {
    truncated: r.truncated,
    rows: r.rows.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        title: x.title || '',
        status: x.status,
        priority: x.priority || 'medium',
        siteId: x.siteId || '',
        locationId: x.locationId || '',
        departmentId: x.departmentId || '',
        templateId: x.templateId || '',
        categoryId: x.categoryId || '',
        dueAt: toDate(x.dueAt),
        completedAt: toDate(x.completedAt),
        startedAt: toDate(x.startedAt),
        submittedAt: toDate(x.submittedAt),
        attempt: x.attempt || 1,
        exceptionCount: x.exceptionCount || 0,
        approvalRequired: !!x.approvalRequired,
        assigneeIds: x.assigneeIds || [],
        estimatedMinutes: x.estimatedMinutes || 0,
      };
    }),
  };
}

const OPEN = [
  'pending',
  'assigned',
  'in_progress',
  'paused',
  'rework_required',
];
/**
 * Headline counts from server aggregates. Uses the existing
 * [status, siteId, dueAt] index when a site is chosen.
 */
export async function taskCounts(
  db: Firestore,
  c: string,
  range: Range,
  siteId = '',
  now = new Date(),
) {
  const count = async (statuses: string[], from: Date, to: Date) =>
    (
      await getCountFromServer(
        query(
          col(db, c, 'tasks'),
          where('status', 'in', statuses),
          ...(siteId ? [where('siteId', '==', siteId)] : []),
          where('dueAt', '>=', Timestamp.fromDate(from)),
          where('dueAt', '<', Timestamp.fromDate(to)),
        ),
      )
    ).data().count;
  const lateTo = now < range.to ? now : range.to;
  const [open, completed, awaiting, overdue] = await Promise.all([
    count(OPEN, range.from, range.to),
    count(['completed'], range.from, range.to),
    count(['awaiting_approval'], range.from, range.to),
    lateTo > range.from ? count(OPEN, range.from, lateTo) : Promise.resolve(0),
  ]);
  return { open, completed, awaiting, overdue };
}

/* ===================================================================== cases */
export type CaseRow = CaseFacts & {
  id: string;
  number: string;
  title: string;
  siteId: string;
  departmentId: string;
  assetId: string;
  sourceType: string;
  workOrderId: string;
  assigneeIds: string[];
};
export async function loadCases(
  db: Firestore,
  c: string,
  kind: 'workOrders' | 'complaints' | 'escalations',
  range: Range,
  openStatuses: string[],
  max = 2000,
): Promise<Loaded<CaseRow>> {
  const r = await boundedFetch(
    db,
    c,
    kind,
    [
      where('createdAt', '>=', Timestamp.fromDate(range.from)),
      where('createdAt', '<', Timestamp.fromDate(range.to)),
      orderBy('createdAt'),
    ],
    max,
  );
  return {
    truncated: r.truncated,
    rows: r.rows.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        kind,
        number: x.number || '',
        title: x.title || '',
        status: x.status,
        priority: x.priority || 'medium',
        open: openStatuses.includes(x.status),
        createdAt: toDate(x.createdAt) || new Date(0),
        responseDueAt: toDate(x.responseDueAt),
        resolutionDueAt: toDate(x.resolutionDueAt),
        respondedAt: toDate(x.respondedAt),
        resolvedAt: toDate(x.resolvedAt),
        siteId: x.siteId || '',
        departmentId: x.departmentId || '',
        assetId: x.assetId || '',
        sourceType: x.sourceType || '',
        workOrderId: x.workOrderId || '',
        assigneeIds: x.assigneeIds || [],
      };
    }),
  };
}
/** Number of reopen actions in the period, from the case event history. */
export async function reopenCount(
  db: Firestore,
  c: string,
  range: Range,
  kind = 'complaints',
) {
  return (
    await getCountFromServer(
      query(
        col(db, c, 'caseEvents'),
        where('kind', '==', kind),
        where('action', '==', 'reopen'),
        where('at', '>=', Timestamp.fromDate(range.from)),
        where('at', '<', Timestamp.fromDate(range.to)),
      ),
    ).catch(() => null)
  )?.data().count;
}

/* ================================================================= inventory */
/** All movements up to the end of the period (opening balance needs history). */
export async function loadMovements(
  db: Firestore,
  c: string,
  range: Range,
  max = 5000,
): Promise<Loaded<MovementFacts & { id: string }>> {
  const r = await boundedFetch(
    db,
    c,
    'stockMovements',
    [
      where('createdAt', '<', Timestamp.fromDate(range.to)),
      orderBy('createdAt'),
    ],
    max,
  );
  return {
    truncated: r.truncated,
    rows: r.rows.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        materialId: x.materialId,
        movementType: x.movementType,
        fromStoreId: x.fromStoreId || '',
        toStoreId: x.toStoreId || '',
        quantity: Number(x.quantity) || 0,
        createdAt: toDate(x.createdAt) || new Date(0),
      };
    }),
  };
}

/* ================================================================ attendance */
export type AttendanceRow = AttendanceFacts & {
  id: string;
  employeeId: string;
  siteId: string;
};
export async function loadAttendance(
  db: Firestore,
  c: string,
  fromDate: string,
  toDate_: string,
  max = 3000,
): Promise<Loaded<AttendanceRow>> {
  const r = await boundedFetch(
    db,
    c,
    'attendance',
    [
      where('date', '>=', fromDate),
      where('date', '<=', toDate_),
      orderBy('date'),
    ],
    max,
  );
  return {
    truncated: r.truncated,
    rows: r.rows.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        employeeId: x.employeeId,
        siteId: x.siteId || '',
        date: x.date,
        status: x.status,
        checkIn: toDate(x.checkInAt) || new Date(0),
        checkOut: toDate(x.checkOutAt),
        lateMinutes: x.lateMinutes || 0,
        corrected: !!x.correction,
        hasLocation: !!x.checkInLocation,
      };
    }),
  };
}

/* ===================================================================== costs */
export type CostRow = CostFacts & {
  id: string;
  siteId: string;
  currency: string;
  description: string;
  incurredDate: string;
  recordedBy: string;
};
export async function loadCosts(
  db: Firestore,
  c: string,
  fromDate: string,
  toDate_: string,
  max = 3000,
): Promise<Loaded<CostRow>> {
  const r = await boundedFetch(
    db,
    c,
    'maintenanceCosts',
    [
      where('incurredDate', '>=', fromDate),
      where('incurredDate', '<=', toDate_),
      orderBy('incurredDate'),
    ],
    max,
  );
  return {
    truncated: r.truncated,
    rows: r.rows.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CostRow, 'id'>),
    })),
  };
}
/**
 * Costs are append-only: a correction is a new entry with a negative-effect
 * description, never an edit. Only admins record and read costs.
 */
export async function recordCost(
  db: Firestore,
  c: string,
  uid: string,
  input: {
    workOrderId: string;
    assetId: string;
    siteId: string;
    type: string;
    amount: number;
    currency: string;
    description: string;
    incurredDate: string;
  },
) {
  if (!input.siteId) throw new UserError('Choose the site.');
  if (!(costTypes as readonly string[]).includes(input.type))
    throw new UserError('Choose a cost type.');
  if (!Number.isFinite(input.amount) || input.amount < 0)
    throw new UserError('Enter a cost of zero or more.');
  if (!/^[A-Z]{3}$/.test(input.currency))
    throw new UserError('Use a three-letter currency code, e.g. AED.');
  if (!input.description.trim()) throw new UserError('Describe the cost.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.incurredDate))
    throw new UserError('Choose the date the cost was incurred.');
  await addDoc(col(db, c, 'maintenanceCosts'), {
    companyId: c,
    schemaVersion: 1,
    workOrderId: input.workOrderId,
    assetId: input.assetId,
    siteId: input.siteId,
    type: input.type,
    amount: Math.round(input.amount * 100) / 100,
    currency: input.currency,
    description: input.description.trim().slice(0, 500),
    incurredDate: input.incurredDate,
    recordedBy: uid,
    recordedAt: serverTimestamp(),
  });
}

/* ================================================================ compliance */
export type ComplianceRecord = {
  id: string;
  category: string;
  title: string;
  siteId: string;
  assetId: string;
  facilityId: string;
  issuer: string;
  reference: string;
  issuedDate: string;
  expiryDate: string;
  evidenceRef: string;
  verified: boolean;
  verifiedBy: string;
  verifiedAt: Timestamp | null;
  notes: string;
  status: 'active' | 'archived';
  revision: number;
};
export type ComplianceInput = Omit<
  ComplianceRecord,
  'id' | 'verifiedBy' | 'verifiedAt' | 'status' | 'revision'
>;
export async function listCompliance(db: Firestore, c: string) {
  const r = await boundedFetch(db, c, 'complianceRecords', [], 1000);
  return {
    truncated: r.truncated,
    rows: r.rows.map((d) => ({ id: d.id, ...d.data() }) as ComplianceRecord),
  };
}
function checkCompliance(x: ComplianceInput) {
  if (!x.title.trim()) throw new UserError('Enter a title.');
  if (!x.category) throw new UserError('Choose a category.');
  if (!x.siteId) throw new UserError('Choose the site.');
  if (x.expiryDate && x.issuedDate && x.expiryDate < x.issuedDate)
    throw new UserError('The expiry date must be after the issue date.');
  if (x.verified && !x.evidenceRef.trim())
    throw new UserError(
      'A record can be marked verified only with an evidence reference (certificate number, document link or file location).',
    );
}
export async function saveCompliance(
  db: Firestore,
  c: string,
  uid: string,
  input: ComplianceInput,
  id?: string,
) {
  checkCompliance(input);
  const body = {
    companyId: c,
    schemaVersion: 1,
    category: input.category.slice(0, 60),
    title: input.title.trim().slice(0, 160),
    siteId: input.siteId,
    assetId: input.assetId,
    facilityId: input.facilityId,
    issuer: input.issuer.trim().slice(0, 120),
    reference: input.reference.trim().slice(0, 120),
    issuedDate: input.issuedDate,
    expiryDate: input.expiryDate,
    evidenceRef: input.evidenceRef.trim().slice(0, 500),
    verified: input.verified,
    notes: input.notes.slice(0, 2000),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
  if (!id) {
    await setDoc(doc(col(db, c, 'complianceRecords')), {
      ...body,
      verifiedBy: input.verified ? uid : '',
      verifiedAt: input.verified ? serverTimestamp() : null,
      status: 'active',
      createdAt: serverTimestamp(),
      createdBy: uid,
      revision: 1,
    });
    return;
  }
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'complianceRecords', id));
    const b = s.data() as ComplianceRecord;
    if (b.status === 'archived')
      throw new UserError('Archived records cannot be changed.');
    // Verification is stamped once; changing the evidence resets it.
    const keep =
      input.verified && b.verified && b.evidenceRef === body.evidenceRef;
    tx.update(s.ref, {
      ...body,
      verifiedBy: input.verified ? (keep ? b.verifiedBy : uid) : '',
      verifiedAt: input.verified
        ? keep
          ? b.verifiedAt
          : serverTimestamp()
        : null,
      revision: b.revision + 1,
    });
  });
}
export async function archiveCompliance(
  db: Firestore,
  c: string,
  uid: string,
  id: string,
) {
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'complianceRecords', id));
    const b = s.data() as ComplianceRecord;
    tx.update(s.ref, {
      status: 'archived',
      revision: b.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  });
}

/* ================================================================= retention */
export type Retention = {
  gpsDays: number;
  attendanceDays: number;
  photoDays: number;
  notificationDays: number;
  auditDays: number;
  note: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
};
export const defaultRetention: Retention = {
  gpsDays: 90,
  attendanceDays: 730,
  photoDays: 365,
  notificationDays: 90,
  auditDays: 2555,
  note: '',
};
export async function getRetention(db: Firestore, c: string) {
  const s = await getDoc(ref(db, c, 'settings', 'retention'));
  return s.exists()
    ? ({ ...defaultRetention, ...s.data() } as Retention)
    : { ...defaultRetention };
}
export async function saveRetention(
  db: Firestore,
  c: string,
  uid: string,
  r: Retention,
) {
  const days = [
    r.gpsDays,
    r.attendanceDays,
    r.photoDays,
    r.notificationDays,
    r.auditDays,
  ];
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 36500))
    throw new UserError('Retention periods must be whole days (1 or more).');
  if (r.auditDays < 365)
    throw new UserError('Keep audit history for at least one year.');
  await setDoc(ref(db, c, 'settings', 'retention'), {
    companyId: c,
    gpsDays: r.gpsDays,
    attendanceDays: r.attendanceDays,
    photoDays: r.photoDays,
    notificationDays: r.notificationDays,
    auditDays: r.auditDays,
    note: r.note.slice(0, 1000),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

/* ===================================================================== audit */
export type AuditEntry = {
  id: string;
  source: 'task' | 'case' | 'stock' | 'transfer' | 'attendance' | 'request';
  at: Date | null;
  actorUid: string;
  action: string;
  subject: string;
  detail: string;
};
/**
 * A combined, read-only view over the append-only event streams. These are
 * protected by client security rules (create-only, no update/delete), not by
 * a tamper-evident ledger — the screen states this plainly.
 */
export async function loadAudit(
  db: Firestore,
  c: string,
  range: Range,
  max = 300,
): Promise<AuditEntry[]> {
  const between = (field: string) => [
    where(field, '>=', Timestamp.fromDate(range.from)),
    where(field, '<', Timestamp.fromDate(range.to)),
    orderBy(field, 'desc'),
    limit(max),
  ];
  const [tasks, cases, stock, transfers] = await Promise.all([
    getDocs(query(col(db, c, 'taskEvents'), ...between('at'))),
    getDocs(query(col(db, c, 'caseEvents'), ...between('at'))),
    getDocs(query(col(db, c, 'stockMovements'), ...between('createdAt'))),
    getDocs(query(col(db, c, 'assetTransfers'), ...between('createdAt'))).catch(
      () => null,
    ),
  ]);
  const rows: AuditEntry[] = [
    ...tasks.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        source: 'task' as const,
        at: toDate(x.at),
        actorUid: x.actorUid || '',
        action: x.action,
        subject: x.taskId,
        detail: `${x.fromStatus || ''} → ${x.toStatus || ''}${x.note ? ` · ${x.note}` : ''}`,
      };
    }),
    ...cases.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        source: 'case' as const,
        at: toDate(x.at),
        actorUid: x.actorUid || '',
        action: x.action,
        subject: `${x.kind}/${x.caseId}`,
        detail: `${x.fromStatus || ''} → ${x.toStatus || ''}${x.note ? ` · ${x.note}` : ''}`,
      };
    }),
    ...stock.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        source: 'stock' as const,
        at: toDate(x.createdAt),
        actorUid: x.createdBy || '',
        action: x.movementType,
        subject: x.materialId,
        detail: `${x.quantity} ${x.fromStoreId || ''} → ${x.toStoreId || ''}`,
      };
    }),
    ...(transfers?.docs || []).map((d) => {
      const x = d.data();
      return {
        id: d.id,
        source: 'transfer' as const,
        at: toDate(x.createdAt),
        actorUid: x.createdBy || '',
        action: 'asset_transfer',
        subject: x.assetId,
        detail: x.reason || '',
      };
    }),
  ];
  return rows
    .sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0))
    .slice(0, max);
}
