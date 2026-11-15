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
} from 'firebase/firestore';
import { customerStatus, type AllocationFacts } from '@facilityos/shared';
import { UserError } from './store';
import {
  createCase,
  emptyCase,
  type CaseRecord,
  type NewCase,
} from './casesStore';

/**
 * Phase 7 customer identity and service requests.
 *
 *   customerLinks/{uid}        → one client, optional allocation scope and an
 *                                admin-curated snapshot of the places the
 *                                customer may see (names and dates only)
 *   serviceRequests/{id}       → the customer-safe view of a request; it is
 *                                routed into a complaint (sourceType
 *                                'service_request') and kept in step with it
 *
 * Customers never read sites, locations, clients, contracts, allocations,
 * complaints, work orders or staff records. Email matching never grants
 * access: an admin links an existing customer-role membership explicitly.
 */
export type CustomerPlace = {
  allocationId: string;
  contractId: string;
  siteId: string;
  locationId: string;
  siteName: string;
  locationName: string;
  allocationType: string;
  startDate: string;
  endDate: string;
};
export type CustomerLink = {
  uid: string;
  clientId: string;
  clientName: string;
  contactName: string;
  allocationIds: string[];
  places: CustomerPlace[];
  status: 'active' | 'revoked';
  revision: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
export type RequestRemark = {
  by: 'customer' | 'team';
  text: string;
  at: Timestamp;
};
export type ServiceRequest = {
  id: string;
  clientId: string;
  contractId: string;
  allocationId: string;
  siteId: string;
  locationId: string;
  reference: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status:
    | 'submitted'
    | 'in_progress'
    | 'resolved'
    | 'closed'
    | 'reopen_requested'
    | 'cancelled';
  complaintId: string;
  workOrderId: string;
  timeline: { label: string; at: Timestamp }[];
  resolutionSummary: string;
  remarks: RequestRemark[];
  confirmedAt: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
  revision: number;
};
export const requestCategories = [
  'Cleaning',
  'Air conditioning',
  'Electrical',
  'Plumbing',
  'Furniture',
  'Pest control',
  'Access / keys',
  'Internet / IT',
  'Other',
] as const;

const col = (db: Firestore, c: string, name: string) =>
  collection(db, 'companies', c, name);
const ref = (db: Firestore, c: string, name: string, id: string) =>
  doc(db, 'companies', c, name, id);
const idOk = (v: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(v);

/** A place is open for new requests while its allocation dates include today. */
export function placeActive(p: CustomerPlace, todayLocal: string) {
  return p.startDate <= todayLocal && (!p.endDate || p.endDate >= todayLocal);
}

/* ================================================================ admin side */
export async function listCustomerMembers(db: Firestore, c: string) {
  const r = await getDocs(
    query(col(db, c, 'members'), where('role', '==', 'customer'), limit(200)),
  );
  return r.docs.map(
    (d) => d.data() as { uid: string; status: string; displayName?: string },
  );
}
export async function listCustomerLinks(db: Firestore, c: string) {
  const r = await getDocs(query(col(db, c, 'customerLinks'), limit(500)));
  return r.docs.map((d) => d.data() as CustomerLink);
}

/** Admin-only: builds the place snapshot from the client's allocations. */
export async function clientPlaces(
  db: Firestore,
  c: string,
  clientId: string,
  allocationIds: string[],
) {
  const r = await getDocs(
    query(
      col(db, c, 'contractAllocations'),
      where('clientIdSnapshot', '==', clientId),
      limit(200),
    ),
  );
  const rows = r.docs
    .map((d) => ({
      id: d.id,
      ...(d.data() as AllocationFacts & {
        contractId: string;
        allocationType: string;
      }),
    }))
    .filter(
      (a) =>
        a.status !== 'archived' &&
        (!allocationIds.length || allocationIds.includes(a.id)),
    );
  const names = new Map<string, string>();
  const name = async (kind: string, id: string) => {
    if (!id) return '';
    const k = `${kind}/${id}`;
    if (!names.has(k)) {
      const s = await getDoc(ref(db, c, kind, id));
      names.set(k, (s.data()?.name as string) || id);
    }
    return names.get(k)!;
  };
  const places: CustomerPlace[] = [];
  for (const a of rows.slice(0, 40))
    places.push({
      allocationId: a.id,
      contractId: a.contractId,
      siteId: a.siteId,
      locationId: a.locationId || '',
      siteName: (await name('sites', a.siteId)).slice(0, 160),
      locationName: (await name('locations', a.locationId || '')).slice(0, 160),
      allocationType: a.allocationType || '',
      startDate: a.startDate,
      endDate: a.effectiveEndDate || a.endDate || '',
    });
  return places;
}

/**
 * Links (or updates) a customer login. The login must already be an active
 * member with role "customer" — memberships are provisioned server-side.
 */
export async function saveCustomerLink(
  db: Firestore,
  c: string,
  adminUid: string,
  input: {
    uid: string;
    clientId: string;
    contactName: string;
    allocationIds: string[];
    status?: 'active' | 'revoked';
  },
) {
  const uid = input.uid.trim();
  if (!idOk(uid)) throw new UserError('Choose a customer login.');
  if (!idOk(input.clientId)) throw new UserError('Choose the client.');
  if (input.allocationIds.length > 10)
    throw new UserError(
      'Choose at most 10 allocations, or leave empty for all of the client’s allocations.',
    );
  const [m, client] = await Promise.all([
    getDoc(ref(db, c, 'members', uid)),
    getDoc(ref(db, c, 'clients', input.clientId)),
  ]);
  if (!m.exists() || m.data().role !== 'customer')
    throw new UserError(
      'This login is not a customer membership. Customer logins are provisioned separately; staff and admins cannot be linked as customers.',
    );
  if (!client.exists() || client.data().status === 'archived')
    throw new UserError('Choose an active client.');
  const places = await clientPlaces(db, c, input.clientId, input.allocationIds);
  if (!places.length)
    throw new UserError(
      'This client has no allocations to show. Allocate a site or space to one of its contracts first.',
    );
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref(db, c, 'customerLinks', uid));
    const body = {
      companyId: c,
      schemaVersion: 1,
      uid,
      clientId: input.clientId,
      clientName: String(client.data()!.name || '').slice(0, 160),
      contactName: input.contactName.trim().slice(0, 120),
      allocationIds: input.allocationIds,
      places,
      status: input.status || 'active',
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    };
    if (existing.exists()) {
      const l = existing.data() as CustomerLink;
      if (l.clientId !== input.clientId)
        throw new UserError(
          'This login is linked to another client. Revoke it and provision a new login for the other client.',
        );
      tx.update(existing.ref, { ...body, revision: l.revision + 1 });
    } else
      tx.set(existing.ref, {
        ...body,
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: adminUid,
        revision: 1,
      });
  });
}

export async function listServiceRequests(
  db: Firestore,
  c: string,
  status?: ServiceRequest['status'],
) {
  const r = await getDocs(
    query(
      col(db, c, 'serviceRequests'),
      ...(status ? [where('status', '==', status)] : []),
      orderBy('createdAt', 'desc'),
      limit(100),
    ),
  );
  return r.docs.map((d) => ({ ...(d.data() as ServiceRequest), id: d.id }));
}

/**
 * Routes a request into the complaints workflow. The complaint ID is derived
 * from the request, so repeating intake never creates a second complaint. SLA
 * targets are computed from the time the customer submitted the request.
 */
export async function intakeRequest(
  db: Firestore,
  c: string,
  adminUid: string,
  r: ServiceRequest,
  extra: Partial<Pick<NewCase, 'departmentId' | 'supervisorId'>> = {},
) {
  const link = await getDoc(ref(db, c, 'customerLinks', r.createdBy));
  const input: NewCase = {
    ...emptyCase('complaints'),
    title: `${r.category}: ${r.description}`.slice(0, 160),
    description: r.description,
    priority: r.priority,
    severity: r.priority,
    category: r.category,
    siteId: r.siteId,
    locationId: r.locationId,
    sourceType: 'service_request',
    sourceId: r.id,
    reportedBy: String(link.data()?.contactName || 'Customer portal').slice(
      0,
      120,
    ),
    clientId: r.clientId,
    contractId: r.contractId,
    ...extra,
  };
  const { id } = await createCase(db, c, adminUid, 'complaints', input, {
    now: r.createdAt?.toDate?.() || new Date(),
  });
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'serviceRequests', r.id));
    const d = s.data() as ServiceRequest;
    if (d.complaintId) return;
    tx.update(s.ref, {
      complaintId: id,
      timeline:
        d.timeline.length < 40
          ? [
              ...d.timeline,
              { label: 'Received by the service team', at: Timestamp.now() },
            ]
          : d.timeline,
      revision: d.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
  });
  return id;
}

/**
 * Brings a request's customer status in line with its complaint. Needed when
 * staff (who cannot read customer requests) moved the complaint along.
 */
export async function reconcileRequest(
  db: Firestore,
  c: string,
  adminUid: string,
  r: ServiceRequest,
) {
  if (!r.complaintId) return false;
  return runTransaction(db, async (tx) => {
    const [s, cmp] = await Promise.all([
      tx.get(ref(db, c, 'serviceRequests', r.id)),
      tx.get(ref(db, c, 'complaints', r.complaintId)),
    ]);
    if (!s.exists() || !cmp.exists()) return false;
    const d = s.data() as ServiceRequest;
    const k = cmp.data() as CaseRecord;
    const want = customerStatus(k.status);
    // A reopen request stays visible until the team acts on the complaint.
    if (
      d.status === want ||
      (d.status === 'reopen_requested' &&
        ['resolved', 'closed'].includes(k.status))
    )
      return false;
    tx.update(s.ref, {
      status: want,
      workOrderId: k.workOrderId || d.workOrderId,
      ...(k.resolution && ['resolved', 'closed'].includes(k.status)
        ? { resolutionSummary: k.resolution.slice(0, 2000) }
        : {}),
      timeline:
        d.timeline.length < 40
          ? [...d.timeline, { label: statusLabel[want], at: Timestamp.now() }]
          : d.timeline,
      revision: d.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
    return true;
  });
}

/** A reply from the service team, shown to the customer. */
export async function teamReply(
  db: Firestore,
  c: string,
  adminUid: string,
  requestId: string,
  text: string,
) {
  const t = text.trim();
  if (!t) throw new UserError('Write a reply.');
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'serviceRequests', requestId));
    const d = s.data() as ServiceRequest;
    if (d.remarks.length >= 30)
      throw new UserError('This request has reached its message limit.');
    tx.update(s.ref, {
      remarks: [
        ...d.remarks,
        { by: 'team', text: t.slice(0, 500), at: Timestamp.now() },
      ],
      revision: d.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
  });
}

export const statusLabel: Record<ServiceRequest['status'], string> = {
  submitted: 'Submitted',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
  reopen_requested: 'Reopen requested',
  cancelled: 'Cancelled',
};

/* ============================================================ customer side */
export type CustomerAccess = {
  companyId: string;
  companyName: string;
  timeZone: string;
  link: CustomerLink;
};
export type CustomerDenied = {
  companyId: string;
  reason: 'not-customer' | 'no-link' | 'revoked' | 'error';
};
export async function resolveCustomer(
  db: Firestore,
  c: string,
  uid: string,
): Promise<CustomerAccess | CustomerDenied> {
  try {
    const m = await getDoc(ref(db, c, 'members', uid));
    if (
      !m.exists() ||
      m.data().status !== 'active' ||
      m.data().role !== 'customer'
    )
      return { companyId: c, reason: 'not-customer' };
    const l = await getDoc(ref(db, c, 'customerLinks', uid));
    if (!l.exists()) return { companyId: c, reason: 'no-link' };
    const link = l.data() as CustomerLink;
    if (link.status !== 'active') return { companyId: c, reason: 'revoked' };
    const company = await getDoc(doc(db, 'companies', c));
    return {
      companyId: c,
      companyName: company.data()?.name || c,
      timeZone: company.data()?.timeZone || 'UTC',
      link,
    };
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied')
      return { companyId: c, reason: 'revoked' };
    return { companyId: c, reason: 'error' };
  }
}
export async function customerCompanies(db: Firestore, uid: string) {
  const r = await getDocs(
    query(collection(db, 'users', uid, 'companyAccess'), limit(25)),
  );
  return r.docs.map((d) => d.id);
}

/**
 * The customer's own requests. A scoped login queries each allocation
 * separately so every query is provably inside the scope.
 */
export async function listMyRequests(
  db: Firestore,
  c: string,
  link: CustomerLink,
) {
  const base = [where('clientId', '==', link.clientId)];
  const queries = link.allocationIds.length
    ? link.allocationIds.map((a) =>
        query(
          col(db, c, 'serviceRequests'),
          ...base,
          where('allocationId', '==', a),
          orderBy('createdAt', 'desc'),
          limit(50),
        ),
      )
    : [
        query(
          col(db, c, 'serviceRequests'),
          ...base,
          orderBy('createdAt', 'desc'),
          limit(100),
        ),
      ];
  const all = (await Promise.all(queries.map((q) => getDocs(q)))).flatMap((r) =>
    r.docs.map((d) => ({ ...(d.data() as ServiceRequest), id: d.id })),
  );
  return all.sort(
    (a, b) =>
      (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0),
  );
}
export async function getMyRequest(db: Firestore, c: string, id: string) {
  const s = await getDoc(ref(db, c, 'serviceRequests', id));
  return s.exists() ? { ...(s.data() as ServiceRequest), id: s.id } : null;
}

/** A fresh request ID; keep it for retries so a resubmission is idempotent. */
export function newRequestId(db: Firestore, c: string) {
  return doc(col(db, c, 'serviceRequests')).id;
}
export function requestReference(id: string, at = new Date()) {
  return `SR-${at.toISOString().slice(2, 10).replaceAll('-', '')}-${id.slice(0, 6).toUpperCase()}`;
}

/**
 * Raises a request for one of the customer's places. Retrying with the same
 * ID returns the existing request. An identical open request for the same
 * place and category is refused as a duplicate.
 */
export async function createServiceRequest(
  db: Firestore,
  c: string,
  uid: string,
  link: CustomerLink,
  input: {
    id: string;
    allocationId: string;
    category: string;
    priority: ServiceRequest['priority'];
    description: string;
  },
  opts: { todayLocal: string; existing?: ServiceRequest[] },
) {
  const place = link.places.find((p) => p.allocationId === input.allocationId);
  if (!place) throw new UserError('Choose one of your locations.');
  if (!placeActive(place, opts.todayLocal))
    throw new UserError(
      'This location’s service period has ended. Contact your facility team.',
    );
  const description = input.description.trim();
  if (!input.category) throw new UserError('Choose a category.');
  if (description.length < 5)
    throw new UserError('Describe the problem in a few words.');
  const dup = (opts.existing || []).find(
    (r) =>
      r.id !== input.id &&
      r.allocationId === input.allocationId &&
      r.category === input.category &&
      ['submitted', 'in_progress', 'reopen_requested'].includes(r.status) &&
      r.description.trim().toLowerCase() === description.toLowerCase(),
  );
  if (dup)
    throw new UserError(
      `You already have an open request for this (${dup.reference}).`,
    );
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'serviceRequests', input.id));
    if (s.exists()) return { id: input.id, created: false };
    tx.set(s.ref, {
      companyId: c,
      schemaVersion: 1,
      clientId: link.clientId,
      contractId: place.contractId,
      allocationId: place.allocationId,
      siteId: place.siteId,
      locationId: place.locationId,
      reference: requestReference(input.id),
      category: input.category.slice(0, 60),
      priority: input.priority,
      description: description.slice(0, 2000),
      status: 'submitted',
      complaintId: '',
      workOrderId: '',
      timeline: [{ label: 'Request submitted', at: Timestamp.now() }],
      resolutionSummary: '',
      remarks: [],
      confirmedAt: null,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      revision: 1,
    });
    return { id: input.id, created: true };
  });
}

async function customerUpdate(
  db: Firestore,
  c: string,
  uid: string,
  id: string,
  change: (d: ServiceRequest) => Record<string, unknown>,
) {
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'serviceRequests', id));
    if (!s.exists()) throw new UserError('This request no longer exists.');
    const d = s.data() as ServiceRequest;
    tx.update(s.ref, {
      ...change(d),
      revision: d.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  });
}
const remark = (d: ServiceRequest, text: string) => {
  const t = text.trim();
  if (!t) throw new UserError('Write a message.');
  if (d.remarks.length >= 30)
    throw new UserError('This request has reached its message limit.');
  return [
    ...d.remarks,
    { by: 'customer', text: t.slice(0, 500), at: Timestamp.now() },
  ];
};
export const addRemark = (
  db: Firestore,
  c: string,
  uid: string,
  id: string,
  text: string,
) => customerUpdate(db, c, uid, id, (d) => ({ remarks: remark(d, text) }));
/** Asks the team to reopen a resolved request; a reason is required. */
export const requestReopen = (
  db: Firestore,
  c: string,
  uid: string,
  id: string,
  reason: string,
) =>
  customerUpdate(db, c, uid, id, (d) => {
    if (!['resolved', 'closed'].includes(d.status))
      throw new UserError('Only resolved requests can be reopened.');
    return {
      status: 'reopen_requested',
      remarks: remark(d, reason),
      ...(d.timeline.length < 40
        ? {
            timeline: [
              ...d.timeline,
              { label: 'Customer asked to reopen', at: Timestamp.now() },
            ],
          }
        : {}),
    };
  });
/** The customer confirms the resolution (once). */
export const confirmResolution = (
  db: Firestore,
  c: string,
  uid: string,
  id: string,
) =>
  customerUpdate(db, c, uid, id, (d) => {
    if (!['resolved', 'closed'].includes(d.status) || d.confirmedAt)
      throw new UserError('Nothing to confirm.');
    return {
      confirmedAt: serverTimestamp(),
      ...(d.timeline.length < 40
        ? {
            timeline: [
              ...d.timeline,
              {
                label: 'Customer confirmed the resolution',
                at: Timestamp.now(),
              },
            ],
          }
        : {}),
    };
  });
