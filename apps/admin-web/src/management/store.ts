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
  type DocumentReference,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import {
  allocationSlot,
  reserveSlot,
  type OccupancySlot,
  definitions,
  inputSchema,
  parseOperation,
  referencePaths,
  isPhase2,
  isAssignment,
  holdsReferences,
  countedReferences,
  movementSchema,
  applyMovement,
  balanceId,
  reversalId,
  InsufficientStockError,
  type MovementInput,
  type Kind,
  type Values,
  type Operation,
} from '@facilityos/shared';
export const PAGE_SIZE = 20;
/** An error whose message is written for end users and safe to display. */
export class UserError extends Error {
  readonly userFacing = true;
}
export class AlreadyPostedError extends UserError {}
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
  const base: QueryConstraint[] = [];
  if (status) base.push(where('status', '==', status));
  if (filter)
    base.push(
      where(filter.key, '==', filter.value === '__root__' ? '' : filter.value),
    );
  if (secondaryFilter)
    base.push(where(secondaryFilter.key, '==', secondaryFilter.value));
  base.push(orderBy('name'));
  const term = search.trim();
  const run = async (prefix: string, after?: QueryDocumentSnapshot) => {
    const c = [...base];
    if (prefix)
      c.push(
        where('name', '>=', prefix),
        where('name', '<=', prefix + '\uf8ff'),
      );
    if (after) c.push(startAfter(after));
    c.push(limit(PAGE_SIZE + 1));
    return getDocs(query(collection(db, 'companies', company, kind), ...c));
  };
  if (term) {
    // Firestore prefix search is case-sensitive; query the common casings and merge.
    const variants = [
      ...new Set([
        term,
        term.charAt(0).toUpperCase() + term.slice(1),
        term.toLowerCase(),
        term.toUpperCase(),
      ]),
    ];
    const results = await Promise.all(variants.map((v) => run(v)));
    const seen = new Map<string, QueryDocumentSnapshot>();
    for (const r of results) for (const d of r.docs) seen.set(d.id, d);
    const docs = [...seen.values()].sort((a, b) =>
      String(a.data().name).localeCompare(String(b.data().name)),
    );
    return {
      rows: docs
        .slice(0, PAGE_SIZE)
        .map((d) => parseOperation(kind, d.id, d.data())),
      cursor: undefined,
      hasMore: false,
      truncated: docs.length > PAGE_SIZE,
    };
  }
  const result = await run('', cursor);
  const page = result.docs.slice(0, PAGE_SIZE);
  return {
    rows: page.map((d) => parseOperation(kind, d.id, d.data())),
    cursor: page.at(-1),
    hasMore: result.docs.length > PAGE_SIZE,
    truncated: false,
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
function autoCode(prefix: string) {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return (
    prefix +
    '-' +
    Date.now().toString(36).toUpperCase() +
    random[0].toString(36).toUpperCase().slice(0, 4)
  ).slice(0, 40);
}
/** Saves a master record with tenant, reference-counter and history integrity. */
export async function saveRecord(
  db: Firestore,
  company: string,
  uid: string,
  kind: Kind,
  values: Values,
  previous?: Operation,
) {
  const definition = definitions[kind];
  const generated =
    definition.autoCode && !previous
      ? {
          code: autoCode(definition.autoCode),
          name: values.name || 'Pending',
        }
      : {};
  const v = inputSchema(kind).parse({ ...values, ...generated }),
    id = previous?.id || doc(collection(db, 'companies', company, kind)).id;
  const target = doc(db, 'companies', company, kind, id);
  const phase2 = isPhase2(kind);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(target);
    if (
      previous &&
      (!snap.exists() || snap.data().revision !== previous.revision)
    )
      throw new UserError(
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
        throw new UserError(
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
        throw new UserError('This allocation cannot change to that status.');
      if (
        old.values.effectiveEndDate &&
        v.effectiveEndDate !== old.values.effectiveEndDate
      )
        throw new UserError(
          'Termination dates cannot change after the decision.',
        );
    }
    if (
      kind === 'contractAllocations' &&
      !old &&
      !['draft', 'active'].includes(v.status)
    )
      throw new UserError('Create a draft or active allocation.');
    const linkFields = phase2
      ? countedReferences(kind)
      : definition.fields.filter((f) => f.reference);
    if (
      old &&
      linkFields.filter((f) => old.values[f.key] !== v[f.key]).length > 1
    )
      throw new UserError(
        'Change one linked record at a time. Save the first relationship change, then edit again for the next.',
      );
    if (old && old.values.code !== v.code)
      throw new UserError(
        'Business codes cannot be changed. They are reserved for historical references.',
      );
    if (old)
      for (const f of definition.fields)
        if (f.immutable && old.values[f.key] !== v[f.key])
          throw new UserError(
            `${f.label} cannot change after creation. Create a new record instead.`,
          );
    if (
      old &&
      kind === 'contracts' &&
      old.refCount > 0 &&
      ['clientId', 'startDate', 'endDate'].some((k) => old.values[k] !== v[k])
    )
      throw new UserError(
        'Close linked allocations before changing the contract client or dates.',
      );
    if (old && v.status === 'archived' && old.refCount > 0)
      throw new UserError('Archive or reassign active linked records first.');
    if (!old && v.status === 'archived')
      throw new UserError('New records cannot start archived.');
    if (old && kind === 'locations' && old.values.siteId !== v.siteId)
      throw new UserError(
        'Locations cannot move between sites. Create a new location instead.',
      );
    if (old && kind === 'facilities' && old.values.siteId !== v.siteId)
      throw new UserError(
        'Facilities cannot move between sites in this phase.',
      );
    if (
      old &&
      kind === 'assets' &&
      (old.values.siteId !== v.siteId || old.values.locationId !== v.locationId)
    )
      throw new UserError(
        'Use Transfer to move an asset so its movement history is recorded.',
      );
    if (
      old &&
      isAssignment(kind) &&
      !holdsReferences(kind, old.values) &&
      holdsReferences(kind, v)
    )
      throw new UserError(
        'Ended assignments cannot be reopened. Create a new assignment.',
      );
    if (
      ['departments', 'assetCategories', 'employees'].includes(kind) &&
      (v.parentId === id || v.supervisorId === id)
    )
      throw new UserError('A record cannot be linked to itself.');
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
        throw new UserError('A linked record no longer exists.');
      if (
        newRefs.includes(paths[i]) &&
        parents[i].data()!.status === 'archived'
      )
        throw new UserError('Choose an active linked record.');
    }
    const parentData = (key: string) =>
      parents
        .find(
          (p, i) =>
            p.id === v[key] &&
            paths[i].startsWith(
              definition.fields.find((f) => f.key === key)!.reference + '/',
            ),
        )
        ?.data();
    // Informational (uncounted) links must still resolve inside this company.
    const informational: Record<string, Record<string, unknown>> = {};
    for (const f of definition.fields.filter(
      (f) => f.reference && f.counted === false && v[f.key],
    )) {
      const s = await tx.get(
        doc(db, 'companies', company, f.reference!, v[f.key]),
      );
      if (!s.exists())
        throw new UserError(
          `The selected ${f.label.toLowerCase()} no longer exists.`,
        );
      if (
        s.data().status === 'archived' &&
        (!old || old.values[f.key] !== v[f.key])
      )
        throw new UserError(`Choose an active ${f.label.toLowerCase()}.`);
      informational[f.key] = s.data();
    }
    if (
      kind === 'facilities' &&
      parents.find((p) => p.id === v.locationId)?.data()?.siteId !== v.siteId
    )
      throw new UserError('Choose a location in this site.');
    if (
      ['assets', 'stores'].includes(kind) &&
      v.locationId &&
      holdsReferences(kind, v) &&
      parentData('locationId')?.siteId !== v.siteId
    )
      throw new UserError('Choose a location in the selected site.');
    if (
      kind === 'assets' &&
      v.facilityId &&
      informational.facilityId?.siteId !== v.siteId
    )
      throw new UserError('Choose a facility in the selected site.');
    if (
      ['departments', 'assetCategories'].includes(kind) &&
      v.parentId &&
      holdsReferences(kind, v) &&
      parentData('parentId')?.parentId !== ''
    )
      throw new UserError(
        'Choose a top-level parent. Only one level of hierarchy is supported.',
      );
    if (kind === 'locations' && v.parentId) {
      let parent = v.parentId;
      const seen = new Set([id]);
      let depth = 0;
      while (parent) {
        if (seen.has(parent))
          throw new UserError(
            'A location cannot be placed beneath itself or a descendant.',
          );
        seen.add(parent);
        if (++depth > 4)
          throw new UserError(
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
          throw new UserError('Choose an active parent in this site.');
        parent = s.data().parentId;
      }
    }
    if (definition.autoCode && !old) {
      const labels = definition.fields
        .filter((f) => f.reference && f.required)
        .map((f) => {
          const d = parentData(f.key) || informational[f.key];
          return d ? `${d.name}` : '';
        })
        .filter(Boolean);
      v.name = (labels.join(' · ') || definition.singular).slice(0, 120);
    }
    let clientIdSnapshot = old?.clientIdSnapshot;
    let calendarWrite:
      | { ref: ReturnType<typeof doc>; data: Record<string, unknown> }
      | undefined;
    if (kind === 'contractAllocations') {
      const contract = await tx.get(
        doc(db, 'companies', company, 'contracts', v.contractId),
      );
      if (!contract.exists()) throw new UserError('Contract is missing.');
      clientIdSnapshot = old?.clientIdSnapshot || contract.data().clientId;
      if (!old || (old.values.status === 'draft' && v.status === 'active')) {
        if (contract.data().status !== 'active')
          throw new UserError('Choose an active contract.');
        if (
          v.startDate < contract.data().startDate ||
          v.endDate > contract.data().endDate
        )
          throw new UserError(
            'Allocation dates must fit within the contract dates.',
          );
        if (clientIdSnapshot !== contract.data().clientId)
          throw new UserError(
            'Contract client changed. Create a new allocation.',
          );
      }
      if (v.locationId) {
        const loc = await tx.get(
          doc(db, 'companies', company, 'locations', v.locationId),
        );
        if (!loc.exists() || loc.data().siteId !== v.siteId)
          throw new UserError('Choose a location in this site.');
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
        let slots: OccupancySlot[];
        try {
          slots = reserveSlot(
            (cal.data()?.slots || []) as OccupancySlot[],
            allocationSlot(id, v),
          );
        } catch (e) {
          throw new UserError((e as Error).message);
        }
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
      throw new UserError(
        'This code is already reserved. Choose another code.',
      );
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
      ...(kind === 'assets'
        ? { lastTransferId: old?.lastTransferId || '' }
        : {}),
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
    if (kind === 'assets')
      tx.set(
        doc(target, 'history', String(revision)),
        assetHistory(company, revision, v, old?.lastTransferId || '', uid),
      );
  });
  return id;
}
function assetHistory(
  company: string,
  revision: number,
  v: Values,
  transferId: string,
  uid: string,
) {
  return {
    companyId: company,
    revision,
    condition: v.condition,
    status: v.status,
    siteId: v.siteId,
    locationId: v.locationId,
    custodianId: v.custodianId,
    quantity: v.quantity,
    transferId,
    actorUid: uid,
    occurredAt: serverTimestamp(),
  };
}
export type TransferInput = {
  toSiteId: string;
  toLocationId: string;
  transferDate: string;
  reason: string;
  conditionAfter: string;
  receivedById: string;
  notes: string;
};
/** Moves an asset atomically: transfer record, asset, counters and history together. */
export async function transferAsset(
  db: Firestore,
  company: string,
  uid: string,
  asset: Operation,
  input: TransferInput,
) {
  const transfers = collection(db, 'companies', company, 'assetTransfers');
  const transfer = doc(transfers);
  const target = doc(db, 'companies', company, 'assets', asset.id);
  if (!input.toLocationId || !input.toSiteId)
    throw new UserError('Choose the destination site and location.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transferDate))
    throw new UserError('Enter the transfer date.');
  if (!input.reason.trim())
    throw new UserError('Enter a reason for the transfer.');
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(target);
    if (!snap.exists() || snap.data().revision !== asset.revision)
      throw new UserError(
        'This asset changed. Close the form and reload before transferring.',
      );
    const old = parseOperation('assets', asset.id, snap.data());
    if (!holdsReferences('assets', old.values))
      throw new UserError('Archived assets cannot be transferred.');
    if (old.values.locationId === input.toLocationId)
      throw new UserError('Choose a different destination location.');
    const fromLocation = doc(
      db,
      'companies',
      company,
      'locations',
      old.values.locationId,
    );
    const toLocation = doc(
      db,
      'companies',
      company,
      'locations',
      input.toLocationId,
    );
    const [from, to] = await Promise.all([
      tx.get(fromLocation),
      tx.get(toLocation),
    ]);
    if (!from.exists() || !to.exists())
      throw new UserError('A location no longer exists.');
    if (to.data().status === 'archived' || to.data().siteId !== input.toSiteId)
      throw new UserError('Choose an active location in the destination site.');
    if (input.receivedById) {
      const e = await tx.get(
        doc(db, 'companies', company, 'employees', input.receivedById),
      );
      if (!e.exists() || e.data().status === 'archived')
        throw new UserError(
          'Choose an active employee to acknowledge receipt.',
        );
    }
    const v = inputSchema('assets').parse({
      ...old.values,
      siteId: input.toSiteId,
      locationId: input.toLocationId,
      condition: input.conditionAfter,
      facilityId:
        input.toSiteId === old.values.siteId ? old.values.facilityId : '',
    });
    const meta = { updatedAt: serverTimestamp(), updatedBy: uid };
    const revision = old.revision + 1;
    tx.set(transfer, {
      companyId: company,
      schemaVersion: 1,
      assetId: asset.id,
      fromSiteId: old.values.siteId,
      fromLocationId: old.values.locationId,
      toSiteId: input.toSiteId,
      toLocationId: input.toLocationId,
      quantity: old.values.quantity,
      transferDate: input.transferDate,
      reason: input.reason.trim().slice(0, 500),
      conditionBefore: old.values.condition,
      conditionAfter: input.conditionAfter,
      receivedById: input.receivedById,
      notes: input.notes.slice(0, 2000),
      actorUid: uid,
      createdAt: serverTimestamp(),
    });
    tx.update(from.ref, {
      refCount: from.data().refCount - 1,
      witnessKind: 'assets',
      witnessId: asset.id,
      ...meta,
    });
    tx.update(to.ref, {
      refCount: to.data().refCount + 1,
      witnessKind: 'assets',
      witnessId: asset.id,
      ...meta,
    });
    tx.set(target, {
      ...snap.data(),
      ...v,
      lastTransferId: transfer.id,
      revision,
      ...meta,
    });
    // The immutable transfer record is this revision's history entry.
  });
  return transfer.id;
}
export type Movement = MovementInput & {
  id: string;
  createdAt: Timestamp;
  createdBy: string;
  fromBalanceAfter: number;
  toBalanceAfter: number;
};
export type Balance = {
  id: string;
  storeId: string;
  materialId: string;
  quantity: number;
  revision: number;
  lastMovementId: string;
  updatedAt: Timestamp;
};
/**
 * Posts one stock movement. The movement ID is the idempotency key: a retry
 * of the same submission can never post twice. Balances are read, checked
 * for negative results and written in the same transaction; Firestore rules
 * independently re-verify every balance change against the movement.
 */
export async function postMovement(
  db: Firestore,
  company: string,
  uid: string,
  input: MovementInput,
  movementId: string,
) {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success)
    throw new UserError(
      parsed.error.issues[0]?.message || 'Check the transaction details.',
    );
  const m = parsed.data;
  if (m.movementType === 'reversal' && movementId !== reversalId(m.reversesId))
    throw new UserError('Invalid reversal reference.');
  const ref = doc(db, 'companies', company, 'stockMovements', movementId);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists())
      throw new AlreadyPostedError(
        m.movementType === 'reversal'
          ? 'This transaction has already been reversed.'
          : 'This transaction was already posted. It was not posted again.',
      );
    const material = await tx.get(
      doc(db, 'companies', company, 'materials', m.materialId),
    );
    if (!material.exists() || material.data().status !== 'active')
      throw new UserError('Choose an active material.');
    if (m.movementType === 'reversal') {
      const original = await tx.get(
        doc(db, 'companies', company, 'stockMovements', m.reversesId),
      );
      const o = original.data();
      if (
        !o ||
        o.movementType === 'reversal' ||
        o.materialId !== m.materialId ||
        o.fromStoreId !== m.toStoreId ||
        o.toStoreId !== m.fromStoreId ||
        o.quantity !== m.quantity
      )
        throw new UserError('This transaction cannot be reversed.');
    } else
      for (const storeId of [m.fromStoreId, m.toStoreId].filter(Boolean)) {
        const store = await tx.get(
          doc(db, 'companies', company, 'stores', storeId),
        );
        if (!store.exists() || store.data().status !== 'active')
          throw new UserError('Choose active stores.');
      }
    const sides = [m.fromStoreId, m.toStoreId].filter(Boolean);
    const snaps = await Promise.all(
      sides.map((s) =>
        tx.get(
          doc(
            db,
            'companies',
            company,
            'stockBalances',
            balanceId(s, m.materialId),
          ),
        ),
      ),
    );
    const current: Record<string, number> = {};
    sides.forEach((s, i) => (current[s] = snaps[i].data()?.quantity ?? 0));
    if (m.movementType === 'opening' && snaps[0].exists())
      throw new UserError(
        'Stock is already recorded for this material in this store. Use a receipt or adjustment instead.',
      );
    let next: Record<string, number>;
    try {
      next = applyMovement(current, m);
    } catch (e) {
      throw new UserError(
        e instanceof InsufficientStockError
          ? `Not enough stock. Available in the source store: ${current[m.fromStoreId] ?? 0} (smallest units).`
          : (e as Error).message,
      );
    }
    tx.set(ref, {
      ...m,
      companyId: company,
      schemaVersion: 1,
      fromBalanceAfter: m.fromStoreId ? next[m.fromStoreId] : -1,
      toBalanceAfter: m.toStoreId ? next[m.toStoreId] : -1,
      createdAt: serverTimestamp(),
      createdBy: uid,
    });
    sides.forEach((storeId, i) =>
      tx.set(snaps[i].ref as DocumentReference, {
        companyId: company,
        storeId,
        materialId: m.materialId,
        quantity: next[storeId],
        revision: (snaps[i].data()?.revision ?? 0) + 1,
        lastMovementId: movementId,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      }),
    );
  });
  return movementId;
}
export function newMovementId(db: Firestore, company: string) {
  return doc(collection(db, 'companies', company, 'stockMovements')).id;
}
export async function listMovements(
  db: Firestore,
  company: string,
  filter?: { key: string; value: string },
  cursor?: QueryDocumentSnapshot,
) {
  const c: QueryConstraint[] = [];
  if (filter?.value) c.push(where(filter.key, '==', filter.value));
  c.push(orderBy('createdAt', 'desc'));
  if (cursor) c.push(startAfter(cursor));
  c.push(limit(PAGE_SIZE + 1));
  const r = await getDocs(
    query(collection(db, 'companies', company, 'stockMovements'), ...c),
  );
  const page = r.docs.slice(0, PAGE_SIZE);
  return {
    rows: page.map((d) => ({ id: d.id, ...d.data() }) as Movement),
    cursor: page.at(-1),
    hasMore: r.docs.length > PAGE_SIZE,
  };
}
export async function listBalances(
  db: Firestore,
  company: string,
  filter?: { key: string; value: string },
  cursor?: QueryDocumentSnapshot,
) {
  const c: QueryConstraint[] = [];
  if (filter?.value) c.push(where(filter.key, '==', filter.value));
  if (cursor) c.push(startAfter(cursor));
  c.push(limit(PAGE_SIZE + 1));
  const r = await getDocs(
    query(collection(db, 'companies', company, 'stockBalances'), ...c),
  );
  const page = r.docs.slice(0, PAGE_SIZE);
  return {
    rows: page.map((d) => ({ id: d.id, ...d.data() }) as Balance),
    cursor: page.at(-1),
    hasMore: r.docs.length > PAGE_SIZE,
  };
}
export async function listSubcollection(
  db: Firestore,
  company: string,
  path: string[],
  order = 'revision',
) {
  const r = await getDocs(
    query(
      collection(db, 'companies', company, ...(path as [string])),
      orderBy(order, 'desc'),
      limit(20),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listTransfers(
  db: Firestore,
  company: string,
  assetId = '',
  cursor?: QueryDocumentSnapshot,
) {
  const c: QueryConstraint[] = [];
  if (assetId) c.push(where('assetId', '==', assetId));
  c.push(orderBy('createdAt', 'desc'));
  if (cursor) c.push(startAfter(cursor));
  c.push(limit(PAGE_SIZE + 1));
  const r = await getDocs(
    query(collection(db, 'companies', company, 'assetTransfers'), ...c),
  );
  const page = r.docs.slice(0, PAGE_SIZE);
  return {
    rows: page.map(
      (d) =>
        ({ id: d.id, ...d.data() }) as Record<string, string> & {
          id: string;
          createdAt: Timestamp;
        },
    ),
    cursor: page.at(-1),
    hasMore: r.docs.length > PAGE_SIZE,
  };
}
export async function listMembers(db: Firestore, company: string) {
  const r = await getDocs(
    query(collection(db, 'companies', company, 'members'), limit(100)),
  );
  return r.docs.map(
    (d) =>
      d.data() as {
        uid: string;
        role: string;
        status: string;
        updatedAt: Timestamp;
      },
  );
}
export { definitions };
