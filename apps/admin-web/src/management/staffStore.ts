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
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import { openStatuses, type TaskStatus } from '@facilityos/shared';
import { UserError } from './store';
import type { Task, TaskException } from './tasksStore';
import type { CaseRecord } from './casesStore';

/**
 * Phase 5 staff identity. A login (Firebase Auth UID with a company
 * membership created by trusted provisioning) is linked to exactly one
 * employee by an owner/admin:
 *   staffLinks/{uid}            → employeeId, site scope, status
 *   employeeLinks/{employeeId}  → uid (one login per employee)
 * The security rules read the link, never a client-supplied employee ID.
 */
export type StaffLink = {
  uid: string;
  employeeId: string;
  siteIds: string[];
  allSites: boolean;
  status: 'active' | 'revoked';
  note: string;
  revision: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
export const supervisorRoles = [
  'supervisor',
  'site_manager',
  'department_manager',
];
export const staffRoleLabels: Record<string, string> = {
  owner: 'Company owner',
  admin: 'Company admin',
  site_manager: 'Site / facility manager',
  department_manager: 'Department supervisor',
  supervisor: 'Supervisor / team leader',
  technician: 'Technician',
  staff: 'Staff (housekeeping, security, general)',
  viewer: 'Viewer',
};
const col = (db: Firestore, c: string, name: string) =>
  collection(db, 'companies', c, name);
const ref = (db: Firestore, c: string, name: string, id: string) =>
  doc(db, 'companies', c, name, id);

/* ================================================================ admin side */
export async function listStaffLinks(db: Firestore, c: string) {
  const r = await getDocs(query(col(db, c, 'staffLinks'), limit(500)));
  return r.docs.map((d) => d.data() as StaffLink);
}
export async function listLinkableMembers(db: Firestore, c: string) {
  const r = await getDocs(
    query(col(db, c, 'members'), where('status', '==', 'active'), limit(200)),
  );
  return r.docs
    .map((d) => d.data() as { uid: string; role: string; status: string })
    .filter((m) => m.role !== 'customer');
}
/**
 * Links a login to an employee. Fails if the login or the employee is already
 * linked (the rules enforce the same), if the employee is not active, or if
 * the login is not an active member of this company.
 */
export async function linkStaff(
  db: Firestore,
  c: string,
  adminUid: string,
  input: {
    uid: string;
    employeeId: string;
    siteIds: string[];
    allSites: boolean;
    note?: string;
  },
) {
  const uid = input.uid.trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))
    throw new UserError('Choose a login account.');
  if (!input.employeeId) throw new UserError('Choose the employee.');
  if (!input.allSites && !input.siteIds.length)
    throw new UserError('Choose at least one site, or allow all sites.');
  if (input.siteIds.length > 10)
    throw new UserError('Choose at most 10 sites, or allow all sites.');
  await runTransaction(db, async (tx) => {
    const [m, e, existing, claim] = await Promise.all([
      tx.get(ref(db, c, 'members', uid)),
      tx.get(ref(db, c, 'employees', input.employeeId)),
      tx.get(ref(db, c, 'staffLinks', uid)),
      tx.get(ref(db, c, 'employeeLinks', input.employeeId)),
    ]);
    if (
      !m.exists() ||
      m.data().status !== 'active' ||
      m.data().role === 'customer'
    )
      throw new UserError(
        'This login is not an active member of the company. Provision the membership first.',
      );
    if (!e.exists() || !['active', 'probation'].includes(e.data().status))
      throw new UserError('Only active employees can be linked.');
    const claimUid = claim.exists() ? (claim.data().uid as string) : '';
    if (existing.exists()) {
      const l = existing.data() as StaffLink;
      if (l.employeeId !== input.employeeId)
        throw new UserError(
          'This login is already linked to another employee. A login can represent only one employee.',
        );
      if (claimUid && claimUid !== uid)
        throw new UserError(
          'This employee is already linked to another login.',
        );
      tx.update(existing.ref, {
        status: 'active',
        siteIds: input.allSites ? [] : input.siteIds,
        allSites: input.allSites,
        note: (input.note || '').slice(0, 500),
        revision: l.revision + 1,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      });
      if (!claim.exists())
        tx.set(claim.ref, { companyId: c, employeeId: input.employeeId, uid });
      return;
    }
    if (claimUid && claimUid !== uid) {
      const other = await tx.get(ref(db, c, 'staffLinks', claimUid));
      if (other.exists() && other.data().status === 'active')
        throw new UserError(
          'This employee is already linked to another login. Revoke that link first.',
        );
    }
    tx.set(ref(db, c, 'staffLinks', uid), {
      companyId: c,
      schemaVersion: 1,
      uid,
      employeeId: input.employeeId,
      siteIds: input.allSites ? [] : input.siteIds,
      allSites: input.allSites,
      status: 'active',
      note: (input.note || '').slice(0, 500),
      createdAt: serverTimestamp(),
      createdBy: adminUid,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
      revision: 1,
    });
    tx.set(claim.ref, { companyId: c, employeeId: input.employeeId, uid });
  });
}
export async function updateStaffScope(
  db: Firestore,
  c: string,
  adminUid: string,
  l: StaffLink,
  patch: {
    siteIds?: string[];
    allSites?: boolean;
    status?: 'active' | 'revoked';
  },
) {
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'staffLinks', l.uid));
    if (!s.exists() || s.data().revision !== l.revision)
      throw new UserError(
        'This access was changed by someone else. Reload and try again.',
      );
    const allSites = patch.allSites ?? l.allSites;
    const siteIds = allSites ? [] : (patch.siteIds ?? l.siteIds).slice(0, 10);
    if ((patch.status ?? l.status) === 'active' && !allSites && !siteIds.length)
      throw new UserError(
        'Keep at least one site, or revoke the access instead.',
      );
    tx.update(s.ref, {
      siteIds,
      allSites,
      status: patch.status ?? l.status,
      revision: l.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
  });
}

/* ================================================================ staff side */
export type StaffAccess = {
  companyId: string;
  companyName: string;
  timeZone: string;
  role: string;
  link: StaffLink;
  employee: {
    id: string;
    name: string;
    code: string;
    departmentId: string;
    designationId: string;
    primarySiteId: string;
  };
  supervisor: boolean;
};
export type StaffDenied = {
  companyId: string;
  reason:
    'no-link' | 'revoked' | 'inactive-employee' | 'inactive-member' | 'error';
};
/** Resolves the signed-in user's employee identity from the trusted link. */
export async function resolveStaff(
  db: Firestore,
  c: string,
  uid: string,
): Promise<StaffAccess | StaffDenied> {
  try {
    const m = await getDoc(ref(db, c, 'members', uid));
    if (
      !m.exists() ||
      m.data().status !== 'active' ||
      m.data().role === 'customer'
    )
      return { companyId: c, reason: 'inactive-member' };
    const l = await getDoc(ref(db, c, 'staffLinks', uid));
    if (!l.exists()) return { companyId: c, reason: 'no-link' };
    const link = l.data() as StaffLink;
    if (link.status !== 'active') return { companyId: c, reason: 'revoked' };
    let e;
    try {
      e = await getDoc(ref(db, c, 'employees', link.employeeId));
    } catch {
      return { companyId: c, reason: 'inactive-employee' };
    }
    if (!e.exists() || !['active', 'probation'].includes(e.data().status))
      return { companyId: c, reason: 'inactive-employee' };
    const company = await getDoc(doc(db, 'companies', c));
    const role = m.data().role as string;
    return {
      companyId: c,
      companyName: company.data()?.name || c,
      timeZone: company.data()?.timeZone || 'UTC',
      role,
      link,
      employee: {
        id: e.id,
        name: e.data().name,
        code: e.data().code,
        departmentId: e.data().departmentId || '',
        designationId: e.data().designationId || '',
        primarySiteId: e.data().primarySiteId || '',
      },
      supervisor:
        supervisorRoles.includes(role) || ['owner', 'admin'].includes(role),
    };
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied')
      return { companyId: c, reason: 'no-link' };
    return { companyId: c, reason: 'error' };
  }
}
export async function staffCompanies(db: Firestore, uid: string) {
  const r = await getDocs(
    query(collection(db, 'users', uid, 'companyAccess'), limit(25)),
  );
  return r.docs.map((d) => d.id);
}

const toTasks = (r: Awaited<ReturnType<typeof getDocs>>) =>
  r.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Task);
/** My tasks due in [from, to). */
export async function myTasksBetween(
  db: Firestore,
  c: string,
  employeeId: string,
  from: Date,
  to: Date,
  max = 200,
) {
  return toTasks(
    await getDocs(
      query(
        col(db, c, 'tasks'),
        where('assigneeIds', 'array-contains', employeeId),
        where('dueAt', '>=', Timestamp.fromDate(from)),
        where('dueAt', '<', Timestamp.fromDate(to)),
        orderBy('dueAt'),
        limit(max),
      ),
    ),
  );
}
/** My tasks in given statuses (newest due first for history, oldest first otherwise). */
export async function myTasksByStatus(
  db: Firestore,
  c: string,
  employeeId: string,
  statuses: TaskStatus[],
  newestFirst = false,
  max = 50,
) {
  const cons: QueryConstraint[] = [
    where('status', 'in', statuses),
    where('assigneeIds', 'array-contains', employeeId),
    orderBy('dueAt', newestFirst ? 'desc' : 'asc'),
    limit(max),
  ];
  return toTasks(await getDocs(query(col(db, c, 'tasks'), ...cons)));
}
export async function myOverdue(
  db: Firestore,
  c: string,
  employeeId: string,
  now = new Date(),
) {
  return toTasks(
    await getDocs(
      query(
        col(db, c, 'tasks'),
        where(
          'status',
          'in',
          openStatuses.filter((s) => s !== 'awaiting_approval'),
        ),
        where('assigneeIds', 'array-contains', employeeId),
        where('dueAt', '<', Timestamp.fromDate(now)),
        orderBy('dueAt'),
        limit(50),
      ),
    ),
  );
}
/** Supervisor queue: tasks in scope sites with a status. */
export async function scopeTasks(
  db: Firestore,
  c: string,
  a: StaffAccess,
  status: TaskStatus,
  max = 50,
) {
  const cons: QueryConstraint[] = [where('status', '==', status)];
  if (!a.link.allSites)
    cons.push(where('siteId', 'in', a.link.siteIds.slice(0, 10)));
  return toTasks(
    await getDocs(
      query(col(db, c, 'tasks'), ...cons, orderBy('dueAt'), limit(max)),
    ),
  );
}
export async function myWorkOrders(
  db: Firestore,
  c: string,
  a: StaffAccess,
  uid: string,
) {
  const assigned = await getDocs(
    query(
      col(db, c, 'workOrders'),
      where('assigneeIds', 'array-contains', a.employee.id),
      orderBy('createdAt', 'desc'),
      limit(50),
    ),
  );
  const reported = await getDocs(
    query(
      col(db, c, 'workOrders'),
      where('createdBy', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    ),
  );
  const scope =
    a.supervisor && !['owner', 'admin'].includes(a.role)
      ? await getDocs(
          query(
            col(db, c, 'workOrders'),
            ...(a.link.allSites
              ? []
              : [where('siteId', 'in', a.link.siteIds.slice(0, 10))]),
            orderBy('createdAt', 'desc'),
            limit(50),
          ),
        )
      : null;
  const all = new Map<string, CaseRecord>();
  for (const r of [assigned, reported, scope])
    for (const d of r?.docs || [])
      all.set(d.id, { id: d.id, ...d.data() } as CaseRecord);
  return [...all.values()].sort(
    (x, y) => (y.createdAt?.toMillis() || 0) - (x.createdAt?.toMillis() || 0),
  );
}
export async function myReportedIssues(db: Firestore, c: string, uid: string) {
  const r = await getDocs(
    query(
      col(db, c, 'taskExceptions'),
      where('detectedBy', '==', uid),
      orderBy('detectedAt', 'desc'),
      limit(50),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskException);
}
/** Timeline events of a task, read one by one (staff cannot list events). */
export async function staffTaskEvents(db: Firestore, c: string, t: Task) {
  const ids = Array.from(
    { length: Math.min(t.revision, 60) },
    (_, i) => `${t.id}_${i + 1}`,
  );
  const snaps = await Promise.all(
    ids.map((id) => getDoc(ref(db, c, 'taskEvents', id)).catch(() => null)),
  );
  return snaps
    .filter((s) => s?.exists())
    .map(
      (s) =>
        ({ id: s!.id, ...s!.data() }) as Record<string, unknown> & {
          id: string;
        },
    );
}
export async function staffSubmission(
  db: Firestore,
  c: string,
  taskId: string,
  attempt: number,
) {
  const s = await getDoc(ref(db, c, 'taskSubmissions', `${taskId}_${attempt}`));
  return s.exists() ? (s.data() as Record<string, unknown>) : null;
}
export async function staffApproval(
  db: Firestore,
  c: string,
  taskId: string,
  attempt: number,
) {
  const s = await getDoc(ref(db, c, 'taskApprovals', `${taskId}_${attempt}`));
  return s.exists()
    ? (s.data() as {
        decision: string;
        reason: string;
        decidedAt: Timestamp;
        reviewerUid: string;
      })
    : null;
}
export async function staffCaseEvents(db: Firestore, c: string, x: CaseRecord) {
  const ids = Array.from(
    { length: Math.min(x.revision, 60) },
    (_, i) => `${x.kind}_${x.id}_${i + 1}`,
  );
  const snaps = await Promise.all(
    ids.map((id) => getDoc(ref(db, c, 'caseEvents', id)).catch(() => null)),
  );
  return snaps
    .filter((s) => s?.exists())
    .map(
      (s) =>
        ({ id: s!.id, ...s!.data() }) as Record<string, unknown> & {
          id: string;
        },
    );
}
/** Shift, leave and holiday context from existing records (own records only). */
export async function myShiftContext(
  db: Firestore,
  c: string,
  employeeId: string,
) {
  const [assignments, leave, holidays] = await Promise.all([
    getDocs(
      query(
        col(db, c, 'shiftAssignments'),
        where('employeeId', '==', employeeId),
        limit(20),
      ),
    ),
    getDocs(
      query(
        col(db, c, 'leaveRecords'),
        where('employeeId', '==', employeeId),
        limit(50),
      ),
    ),
    getDocs(
      query(
        col(db, c, 'holidays'),
        where('status', '==', 'active'),
        limit(200),
      ),
    ),
  ]);
  const active = assignments.docs
    .map(
      (d) =>
        ({ id: d.id, ...d.data() }) as Record<string, string> & { id: string },
    )
    .filter((a) => a.status === 'active');
  const shifts = await Promise.all(
    [...new Set(active.map((a) => a.shiftId))].map((id) =>
      getDoc(ref(db, c, 'shifts', id)).then((s) =>
        s.exists()
          ? ({ id: s.id, ...s.data() } as Record<string, string> & {
              id: string;
            })
          : null,
      ),
    ),
  );
  return {
    assignments: active,
    shifts: shifts.filter(Boolean) as (Record<string, string> & {
      id: string;
    })[],
    leave: leave.docs
      .map((d) => d.data() as Record<string, string>)
      .filter((l) => ['planned', 'approved', 'taken'].includes(l.status)),
    holidays: holidays.docs.map((d) => d.data() as Record<string, string>),
  };
}
/** Reviewer logins to notify (owners, admins and supervisors). */
export async function reviewerUids(db: Firestore, c: string) {
  try {
    const r = await getDocs(
      query(
        col(db, c, 'members'),
        where('status', '==', 'active'),
        where('role', 'in', [
          'owner',
          'admin',
          'supervisor',
          'site_manager',
          'department_manager',
        ]),
        limit(50),
      ),
    );
    return r.docs.map((d) => d.data().uid as string);
  } catch {
    return [];
  }
}
