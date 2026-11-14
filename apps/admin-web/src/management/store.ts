import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  allocationSlot,
  reserveSlot,
  type OccupancySlot,
  definitions,
  inputSchema,
  parseOperation,
  referencePaths,
  type Kind,
  type Values,
  type Operation,
} from '@facilityos/shared';
export const PAGE_SIZE = 20;
export async function listRecords(
  db: Firestore,
  company: string,
  kind: Kind,
  search = '',
  status = '',
  cursor?: QueryDocumentSnapshot,
  filter?: { key: string; value: string },
  secondaryFilter?: { key: string; value: string },
) {
  const constraints = [];
  if (status) constraints.push(where('status', '==', status));
  if (filter)
    constraints.push(
      where(filter.key, '==', filter.value === '__root__' ? '' : filter.value),
    );
  if (secondaryFilter)
    constraints.push(where(secondaryFilter.key, '==', secondaryFilter.value));
  constraints.push(orderBy('name'));
  if (search.trim())
    constraints.push(
      where('name', '>=', search.trim()),
      where('name', '<=', search.trim() + '\uf8ff'),
    );
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(PAGE_SIZE + 1));
  const result = await getDocs(
    query(collection(db, 'companies', company, kind), ...constraints),
  );
  const page = result.docs.slice(0, PAGE_SIZE);
  return {
    rows: page.map((d) => parseOperation(kind, d.id, d.data())),
    cursor: page.at(-1),
    hasMore: result.docs.length > PAGE_SIZE,
  };
}
export async function recordById(
  db: Firestore,
  company: string,
  kind: Kind,
  id: string,
) {
  const s = await getDoc(doc(db, 'companies', company, kind, id));
  return s.exists() ? parseOperation(kind, s.id, s.data()) : null;
}
export async function countRecords(
  db: Firestore,
  company: string,
  kind: Kind,
  key: string,
  value: string,
) {
  return (
    await getCountFromServer(
      query(
        collection(db, 'companies', company, kind),
        where(key, '==', value),
      ),
    )
  ).data().count;
}
export async function saveRecord(
  db: Firestore,
  company: string,
  uid: string,
  kind: Kind,
  values: Values,
  previous?: Operation,
) {
  const v = inputSchema(kind).parse(values),
    id = previous?.id || doc(collection(db, 'companies', company, kind)).id;
  const target = doc(db, 'companies', company, kind, id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(target);
    if (
      previous &&
      (!snap.exists() || snap.data().revision !== previous.revision)
    )
      throw new Error(
        'This record changed. Close the form and reload before editing.',
      );
    const old = snap.exists() ? parseOperation(kind, id, snap.data()) : null;
    if (kind === 'contractAllocations' && old) {
      if (
        [
          'contractId',
          'siteId',
          'locationId',
          'allocationType',
          'startDate',
          'endDate',
        ].some((k) => v[k] !== old.values[k])
      )
        throw Error(
          'Allocation identity and dates are immutable. Close this allocation and create a replacement.',
        );
      const allowed: Record<string, string[]> = {
        draft: ['draft', 'active', 'archived'],
        active: ['active', 'terminated', 'expired'],
        terminated: ['terminated', 'archived'],
        expired: ['expired', 'archived'],
        archived: ['archived'],
      };
      if (!allowed[old.values.status].includes(v.status))
        throw Error('This allocation cannot change to that status.');
      if (
        old.values.effectiveEndDate &&
        v.effectiveEndDate !== old.values.effectiveEndDate
      )
        throw Error('Termination dates cannot change after the decision.');
    }
    if (
      kind === 'contractAllocations' &&
      !old &&
      !['draft', 'active'].includes(v.status)
    )
      throw Error('Create a draft or active allocation.');

    if (
      old &&
      definitions[kind].fields.filter(
        (f) => f.reference && old.values[f.key] !== v[f.key],
      ).length > 1
    )
      throw new Error(
        'Change one linked record at a time. Save the first relationship change, then edit again for the next.',
      );
    if (old && old.values.code !== v.code)
      throw new Error(
        'Business codes cannot be changed. They are reserved for historical references.',
      );
    if (
      old &&
      kind === 'contracts' &&
      old.refCount > 0 &&
      ['clientId', 'startDate', 'endDate'].some((k) => old.values[k] !== v[k])
    )
      throw new Error(
        'Close linked allocations before changing the contract client or dates.',
      );
    if (old && v.status === 'archived' && old.refCount > 0)
      throw new Error('Archive or reassign active linked records first.');
    if (old && kind === 'locations' && old.values.siteId !== v.siteId)
      throw new Error(
        'Locations cannot move between sites. Create a new location instead.',
      );
    if (old && kind === 'facilities' && old.values.siteId !== v.siteId)
      throw new Error('Facilities cannot move between sites in this phase.');
    const legacyRefs = (status: string) =>
      old?.legacyLinks && status !== 'archived'
        ? [
            ...(old.legacyLinks.clientId
              ? ['clients/' + old.legacyLinks.clientId]
              : []),
            ...(old.legacyLinks.contractId
              ? ['contracts/' + old.legacyLinks.contractId]
              : []),
          ]
        : [];
    const oldRefs = [
        ...referencePaths(kind, old?.values || { status: 'archived' }),
        ...legacyRefs(old?.values.status || 'archived'),
      ],
      newRefs = [...referencePaths(kind, v), ...legacyRefs(v.status)];
    const paths = [...new Set([...oldRefs, ...newRefs])];
    const parents = await Promise.all(
      paths.map((p) => tx.get(doc(db, `companies/${company}/${p}`))),
    );
    for (let i = 0; i < paths.length; i++) {
      if (!parents[i].exists())
        throw new Error('A linked record no longer exists.');
      if (
        newRefs.includes(paths[i]) &&
        parents[i].data()!.status === 'archived'
      )
        throw new Error('Choose an active linked record.');
    }
    if (
      kind === 'facilities' &&
      parents.find((p) => p.id === v.locationId)?.data()?.siteId !== v.siteId
    )
      throw new Error('Choose a location in this site.');
    if (kind === 'locations' && v.parentId) {
      let parent = v.parentId;
      const seen = new Set([id]);
      let depth = 0;
      while (parent) {
        if (seen.has(parent))
          throw new Error(
            'A location cannot be placed beneath itself or a descendant.',
          );
        seen.add(parent);
        if (++depth > 4)
          throw new Error(
            'Choose a parent within four levels of the site root.',
          );
        const s = await tx.get(
          doc(db, 'companies', company, 'locations', parent),
        );
        if (
          !s.exists() ||
          s.data().siteId !== v.siteId ||
          s.data().status === 'archived'
        )
          throw new Error('Choose an active parent in this site.');
        parent = s.data().parentId;
      }
    }
    let clientIdSnapshot = old?.clientIdSnapshot;
    let calendarWrite:
      | { ref: ReturnType<typeof doc>; data: Record<string, unknown> }
      | undefined;
    if (kind === 'contractAllocations') {
      const contract = await tx.get(
        doc(db, 'companies', company, 'contracts', v.contractId),
      );
      if (!contract.exists()) throw Error('Contract is missing.');
      clientIdSnapshot = old?.clientIdSnapshot || contract.data().clientId;
      if (!old || (old.values.status === 'draft' && v.status === 'active')) {
        if (contract.data().status !== 'active')
          throw Error('Choose an active contract.');
        if (
          v.startDate < contract.data().startDate ||
          v.endDate > contract.data().endDate
        )
          throw Error('Allocation dates must fit within the contract dates.');
        if (clientIdSnapshot !== contract.data().clientId)
          throw Error('Contract client changed. Create a new allocation.');
      }
      if (v.locationId) {
        const loc = await tx.get(
          doc(db, 'companies', company, 'locations', v.locationId),
        );
        if (!loc.exists() || loc.data().siteId !== v.siteId)
          throw Error('Choose a location in this site.');
      }
      const activation =
        v.status === 'active' && (!old || old.values.status === 'draft');
      const termination =
        v.status === 'terminated' && old?.values.status === 'active';
      if (
        v.allocationType !== 'service_coverage' &&
        (activation || termination)
      ) {
        const year = v.startDate.slice(0, 4),
          ref = doc(
            db,
            'companies',
            company,
            'occupancyCalendars',
            v.locationId + '_' + year,
          ),
          cal = await tx.get(ref);
        const slots = reserveSlot(
          (cal.data()?.slots || []) as OccupancySlot[],
          allocationSlot(id, v),
        );
        calendarWrite = {
          ref,
          data: {
            companyId: company,
            siteId: v.siteId,
            locationId: v.locationId,
            year,
            slots,
            revision: (cal.data()?.revision || 0) + 1,
            witnessId: id,
            updatedAt: serverTimestamp(),
            updatedBy: uid,
          },
        };
      }
    }
    const claim = doc(
      db,
      'companies',
      company,
      'codeClaims',
      kind + '_' + v.code,
    );
    if (!old && (await tx.get(claim)).exists())
      throw new Error('This code is already reserved. Choose another code.');
    const meta = { updatedAt: serverTimestamp(), updatedBy: uid };
    for (let i = 0; i < paths.length; i++) {
      const delta =
        Number(newRefs.includes(paths[i])) - Number(oldRefs.includes(paths[i]));
      if (delta)
        tx.update(parents[i].ref, {
          refCount: parents[i].data()!.refCount + delta,
          witnessKind: kind,
          witnessId: id,
          ...meta,
        });
    }
    const revision = (old?.revision || 0) + 1;
    tx.set(target, {
      ...v,
      companyId: company,
      schemaVersion: kind === 'sites' ? old?.schemaVersion || 2 : 1,
      ...(old?.legacyLinks || {}),
      ...(kind === 'contractAllocations' ? { clientIdSnapshot } : {}),
      createdAt: old?.createdAt || serverTimestamp(),
      createdBy: old?.createdBy || uid,
      ...meta,
      revision,
      refCount: old?.refCount || 0,
      witnessKind: old?.witnessKind || '',
      witnessId: old?.witnessId || '',
    });
    if (!old)
      tx.set(claim, { kind, recordId: id, code: v.code, companyId: company });
    if (calendarWrite) tx.set(calendarWrite.ref, calendarWrite.data);
    if (kind === 'contractAllocations')
      tx.set(doc(target, 'history', String(revision)), {
        companyId: company,
        revision,
        actorUid: uid,
        occurredAt: serverTimestamp(),
        snapshot: { ...v, clientIdSnapshot },
      });
    if (kind === 'facilities')
      tx.set(doc(target, 'history', String(revision)), {
        companyId: company,
        revision,
        condition: v.condition,
        status: v.status,
        actorUid: uid,
        occurredAt: serverTimestamp(),
      });
  });
  return id;
}
export { definitions };
