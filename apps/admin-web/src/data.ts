import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  startAfter,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  accessSchema,
  companySchema,
  memberSchema,
  profileSchema,
  canOpenAdmin,
} from '@facilityos/shared';
export async function loadAccess(
  db: Firestore,
  uid: string,
  cursor?: QueryDocumentSnapshot,
) {
  const q = query(
    collection(db, 'users', uid, 'companyAccess'),
    orderBy('__name__'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(25),
  );
  const snapshot = await getDocsFromServer(q);
  const candidates = await Promise.all(
    snapshot.docs.map(async (row) => {
      const { companyId } = accessSchema.parse(row.data());
      if (row.id !== companyId)
        throw new Error('Invalid company directory record');
      try {
        const membership = await getDocFromServer(
          doc(db, 'companies', companyId, 'members', uid),
        );
        if (!membership.exists()) return null;
        const member = memberSchema.parse(membership.data());
        if (
          member.uid !== uid ||
          member.companyId !== companyId ||
          member.status !== 'active' ||
          !['owner', 'admin'].includes(member.role)
        )
          return null;
        const companyDoc = await getDocFromServer(
          doc(db, 'companies', companyId),
        );
        if (!companyDoc.exists()) return null;
        const company = companySchema.parse(companyDoc.data());
        return canOpenAdmin(member, company, uid) ? { company, member } : null;
      } catch (error) {
        if ((error as { code?: string }).code === 'permission-denied')
          return null;
        throw error;
      }
    }),
  );
  return {
    items: candidates.filter((v) => v !== null),
    cursor: snapshot.docs.at(-1),
    hasMore: snapshot.size === 25,
  };
}
export async function loadProfile(db: Firestore, uid: string) {
  const snap = await getDocFromServer(doc(db, 'users', uid));
  if (!snap.exists()) throw new Error('Profile not provisioned');
  const profile = profileSchema.parse(snap.data());
  if (profile.uid !== uid) throw new Error('Profile mismatch');
  return profile;
}
