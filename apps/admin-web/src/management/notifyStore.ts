import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
  getCountFromServer,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore';
import {
  notificationId,
  notificationLabels,
  type NotificationType,
} from '@facilityos/shared';

/**
 * In-app notification centre. Notifications use deterministic IDs so the same
 * event never notifies the same person twice, even when a scheduler run or a
 * browser action is retried. Email and push are adapters only (not connected).
 */
export type AppNotification = {
  id: string;
  recipientUid: string;
  type: NotificationType;
  title: string;
  body: string;
  recordKind: string;
  recordId: string;
  createdAt: Timestamp;
  readAt: Timestamp | null;
};
export type Preferences = {
  inApp: Partial<Record<NotificationType, boolean>>;
  email: boolean;
  push: boolean;
};
export const defaultPreferences: Preferences = {
  inApp: {},
  email: false,
  push: false,
};
const col = (db: Firestore, c: string) =>
  collection(db, 'companies', c, 'notifications');

export type NotifyInput = {
  type: NotificationType;
  recordKind:
    | 'tasks'
    | 'workOrders'
    | 'complaints'
    | 'escalations'
    | 'recurringSchedules';
  recordId: string;
  /** Distinguishes repeated events on the same record (e.g. revision). */
  eventKey: string;
  body: string;
  title?: string;
};

const prefCache = new Map<string, Preferences>();
async function wants(
  db: Firestore,
  c: string,
  uid: string,
  type: NotificationType,
) {
  const key = `${c}/${uid}`;
  let p = prefCache.get(key);
  if (!p) {
    try {
      const s = await getDoc(
        doc(db, 'companies', c, 'notificationPreferences', uid),
      );
      p = s.exists() ? (s.data() as Preferences) : defaultPreferences;
    } catch {
      p = defaultPreferences;
    }
    prefCache.set(key, p);
  }
  return p.inApp?.[type] !== false;
}

/**
 * Creates one notification per recipient. Returns the number created (already
 * existing notifications are skipped, never duplicated or overwritten).
 */
export async function notify(
  db: Firestore,
  c: string,
  uid: string,
  recipients: string[],
  n: NotifyInput,
) {
  let created = 0;
  for (const r of [...new Set(recipients.filter(Boolean))].slice(0, 25)) {
    if (!(await wants(db, c, r, n.type))) continue;
    const id = notificationId(n.type, n.recordId, n.eventKey, r);
    const ref = doc(col(db, c), id);
    try {
      const made = await runTransaction(db, async (tx) => {
        const s = await tx.get(ref);
        if (s.exists()) return false;
        tx.set(ref, {
          companyId: c,
          schemaVersion: 1,
          recipientUid: r,
          type: n.type,
          title: (n.title || notificationLabels[n.type]).slice(0, 160),
          body: n.body.slice(0, 500),
          recordKind: n.recordKind,
          recordId: n.recordId,
          createdAt: serverTimestamp(),
          createdBy: uid,
          readAt: null,
        });
        return true;
      });
      if (made) created++;
    } catch (e) {
      // A recipient who is no longer an active member is skipped, not fatal.
      if ((e as { code?: string }).code !== 'permission-denied') throw e;
    }
  }
  return created;
}

/** Recipients: owner/admin members of the company (cached for a short time). */
const adminCache = new Map<string, { at: number; uids: string[] }>();
export async function adminUids(db: Firestore, c: string) {
  const hit = adminCache.get(c);
  if (hit && Date.now() - hit.at < 60000) return hit.uids;
  const r = await getDocs(
    query(
      collection(db, 'companies', c, 'members'),
      where('status', '==', 'active'),
      limit(100),
    ),
  );
  const uids = r.docs
    .map((d) => d.data() as { uid: string; role: string })
    .filter((m) => ['owner', 'admin'].includes(m.role))
    .map((m) => m.uid);
  adminCache.set(c, { at: Date.now(), uids });
  return uids;
}
/** Portal users linked to employees (employees.linkedUid). */
export async function linkedUids(
  db: Firestore,
  c: string,
  employeeIds: string[],
) {
  const out: string[] = [];
  for (const id of employeeIds.slice(0, 10)) {
    const s = await getDoc(doc(db, 'companies', c, 'employees', id));
    const u = s.exists() ? (s.data().linkedUid as string) : '';
    if (u) out.push(u);
  }
  return out;
}
/** Best-effort notification after a committed action; failures are logged, not thrown. */
export async function notifySafely(
  db: Firestore,
  c: string,
  uid: string,
  recipients: Promise<string[]> | string[],
  n: NotifyInput,
) {
  try {
    return await notify(db, c, uid, await recipients, n);
  } catch (e) {
    console.warn('Notification not delivered', e);
    return 0;
  }
}

export async function listNotifications(
  db: Firestore,
  c: string,
  uid: string,
  unreadOnly = false,
  max = 50,
) {
  const r = await getDocs(
    query(
      col(db, c),
      where('recipientUid', '==', uid),
      ...(unreadOnly ? [where('readAt', '==', null)] : []),
      ...(unreadOnly ? [] : [orderBy('createdAt', 'desc')]),
      limit(max),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification);
}
export async function unreadCount(db: Firestore, c: string, uid: string) {
  const r = await getCountFromServer(
    query(
      col(db, c),
      where('recipientUid', '==', uid),
      where('readAt', '==', null),
    ),
  );
  return r.data().count;
}
export async function markRead(db: Firestore, c: string, id: string) {
  await updateDoc(doc(col(db, c), id), { readAt: serverTimestamp() });
}
export async function markAllRead(db: Firestore, c: string, uid: string) {
  const unread = await listNotifications(db, c, uid, true, 100);
  for (const n of unread) await markRead(db, c, n.id);
  return unread.length;
}
export async function loadPreferences(db: Firestore, c: string, uid: string) {
  const s = await getDoc(
    doc(db, 'companies', c, 'notificationPreferences', uid),
  );
  return s.exists()
    ? ({ ...defaultPreferences, ...s.data() } as Preferences)
    : defaultPreferences;
}
export async function savePreferences(
  db: Firestore,
  c: string,
  uid: string,
  p: Preferences,
) {
  prefCache.delete(`${c}/${uid}`);
  await setDoc(doc(db, 'companies', c, 'notificationPreferences', uid), {
    companyId: c,
    uid,
    inApp: p.inApp,
    email: p.email,
    push: p.push,
    updatedAt: serverTimestamp(),
  });
}
