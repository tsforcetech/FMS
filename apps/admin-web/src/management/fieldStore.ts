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
import { attendanceId, evidenceId, type QrTarget } from '@facilityos/shared';
import { UserError } from './store';
import type { Task } from './tasksStore';

/** A GPS reading captured for an explicit action (never continuous tracking). */
export type GeoReading = {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: Date;
};
export type Attendance = {
  id: string;
  employeeId: string;
  uid: string;
  date: string;
  siteId: string;
  shiftId: string;
  checkInAt: Timestamp;
  checkInLocation: {
    lat: number;
    lng: number;
    accuracy: number;
    capturedAt: Timestamp;
  } | null;
  checkOutAt: Timestamp | null;
  checkOutLocation: {
    lat: number;
    lng: number;
    accuracy: number;
    capturedAt: Timestamp;
  } | null;
  status: 'checked_in' | 'checked_out' | 'corrected';
  lateMinutes: number;
  source: 'mobile' | 'web';
  correction: { reason: string; by: string; at: Timestamp } | null;
  revision: number;
};
export type Evidence = {
  id: string;
  taskId: string;
  attempt: number;
  questionId: string;
  type: 'qr' | 'gps';
  refKind: string;
  refId: string;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
    capturedAt: Timestamp;
  } | null;
  capturedAt: Timestamp;
  recordedAt: Timestamp;
  status: 'verified' | 'recorded';
};
const ref = (db: Firestore, c: string, name: string, id: string) =>
  doc(db, 'companies', c, name, id);
const geo = (g: GeoReading | null) =>
  g
    ? {
        lat: g.lat,
        lng: g.lng,
        accuracy: Math.round(g.accuracy * 10) / 10,
        capturedAt: Timestamp.fromDate(g.capturedAt),
      }
    : null;

/* ================================================================ attendance */
export async function checkIn(
  db: Firestore,
  c: string,
  uid: string,
  input: {
    employeeId: string;
    date: string;
    siteId: string;
    shiftId: string;
    lateMinutes: number;
    location: GeoReading | null;
    source: 'mobile' | 'web';
  },
) {
  const id = attendanceId(input.employeeId, input.date);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'attendance', id));
    if (s.exists()) return { id, created: false };
    tx.set(ref(db, c, 'attendance', id), {
      companyId: c,
      schemaVersion: 1,
      employeeId: input.employeeId,
      uid,
      date: input.date,
      siteId: input.siteId,
      shiftId: input.shiftId,
      checkInAt: serverTimestamp(),
      checkInLocation: geo(input.location),
      checkOutAt: null,
      checkOutLocation: null,
      status: 'checked_in',
      lateMinutes: Math.max(0, Math.round(input.lateMinutes)),
      source: input.source,
      correction: null,
      revision: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    return { id, created: true };
  });
}
export async function checkOut(
  db: Firestore,
  c: string,
  uid: string,
  id: string,
  location: GeoReading | null,
) {
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'attendance', id));
    if (!s.exists()) throw new UserError('Check in first.');
    const a = s.data() as Attendance;
    if (a.status !== 'checked_in') return; // already checked out (idempotent retry)
    tx.update(s.ref, {
      checkOutAt: serverTimestamp(),
      checkOutLocation: geo(location),
      status: 'checked_out',
      revision: a.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  });
}
/** Supervisor/admin correction with a reason; timestamps are set by the corrector. */
export async function correctAttendance(
  db: Firestore,
  c: string,
  uid: string,
  a: Attendance,
  checkInAt: Date,
  checkOutAt: Date | null,
  reason: string,
) {
  if (!reason.trim())
    throw new UserError('Enter the reason for the correction.');
  if (checkOutAt && checkOutAt <= checkInAt)
    throw new UserError('Check-out must be after check-in.');
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'attendance', a.id));
    if (!s.exists() || s.data().revision !== a.revision)
      throw new UserError('This record changed. Reload and try again.');
    tx.update(s.ref, {
      checkInAt: Timestamp.fromDate(checkInAt),
      checkOutAt: checkOutAt ? Timestamp.fromDate(checkOutAt) : null,
      status: 'corrected',
      correction: {
        reason: reason.trim().slice(0, 500),
        by: uid,
        at: serverTimestamp(),
      },
      revision: a.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  });
}
export async function myAttendance(
  db: Firestore,
  c: string,
  employeeId: string,
  max = 30,
) {
  const r = await getDocs(
    query(
      collection(db, 'companies', c, 'attendance'),
      where('employeeId', '==', employeeId),
      orderBy('date', 'desc'),
      limit(max),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as Attendance);
}
export async function getAttendance(db: Firestore, c: string, id: string) {
  const s = await getDoc(ref(db, c, 'attendance', id));
  return s.exists() ? ({ id: s.id, ...s.data() } as Attendance) : null;
}
export async function siteAttendance(
  db: Firestore,
  c: string,
  siteIds: string[] | null,
  max = 100,
) {
  const r = await getDocs(
    query(
      collection(db, 'companies', c, 'attendance'),
      ...(siteIds ? [where('siteId', 'in', siteIds.slice(0, 10))] : []),
      orderBy('date', 'desc'),
      limit(max),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as Attendance);
}

/* ================================================================ task evidence */
/** QR scan matched against the task's own asset/location/facility (verified by the rules too). */
export function qrMatchesTask(
  t: Pick<Task, 'assetId' | 'locationId' | 'facilityId'>,
  q: QrTarget,
) {
  return (
    (q.kind === 'assets' && q.id === t.assetId) ||
    (q.kind === 'locations' && q.id === t.locationId) ||
    (q.kind === 'facilities' && q.id === t.facilityId)
  );
}
export async function recordEvidence(
  db: Firestore,
  c: string,
  uid: string,
  employeeId: string,
  task: Task,
  questionId: string,
  e:
    | { type: 'qr'; target: QrTarget; capturedAt: Date }
    | { type: 'gps'; location: GeoReading },
) {
  if (e.type === 'qr' && !qrMatchesTask(task, e.target))
    throw new UserError(
      'This code does not belong to this task’s asset or location.',
    );
  const id = evidenceId(task.id, task.attempt, questionId);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'taskEvidence', id));
    if (s.exists()) return;
    tx.set(ref(db, c, 'taskEvidence', id), {
      companyId: c,
      schemaVersion: 1,
      taskId: task.id,
      attempt: task.attempt,
      questionId,
      type: e.type,
      refKind: e.type === 'qr' ? e.target.kind : '',
      refId: e.type === 'qr' ? e.target.id : '',
      location: e.type === 'gps' ? geo(e.location) : null,
      capturedAt: Timestamp.fromDate(
        e.type === 'qr' ? e.capturedAt : e.location.capturedAt,
      ),
      recordedAt: serverTimestamp(),
      uid,
      employeeId,
      status: e.type === 'qr' ? 'verified' : 'recorded',
    });
  });
  return id;
}
export async function getEvidence(
  db: Firestore,
  c: string,
  task: Task,
  questionId: string,
) {
  const s = await getDoc(
    ref(db, c, 'taskEvidence', evidenceId(task.id, task.attempt, questionId)),
  );
  return s.exists() ? ({ id: s.id, ...s.data() } as Evidence) : null;
}
