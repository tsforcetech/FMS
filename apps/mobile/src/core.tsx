import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Firestore } from 'firebase/firestore';
import { addDays } from '@facilityos/shared';
import type { Task } from '@admin/management/tasksStore';
import {
  myOverdue,
  myTasksBetween,
  myTasksByStatus,
  resolveStaff,
  staffCompanies,
  type StaffAccess,
  type StaffDenied,
} from '@admin/management/staffStore';
import type { Resolver } from '@staff/App';
import { useStaff } from '@staff/App';
import { lookup, primeLabel } from '@admin/management/context';
import { localDay, todayIn } from '@staff/screens/common';
import { Vault } from './offline/vault';
import { OpQueue, runSync, type Op, type SyncReport } from './offline/sync';
import { TaskRepo } from './offline/repo';
import { firestoreExecutor } from './offline/executor';
import { keyStore, kv, onlineNow, watchNetwork } from './platform';

/* ================================================================ per-user storage */
const vaults = new Map<string, Vault>();
export function vaultFor(uid: string) {
  if (!vaults.has(uid)) vaults.set(uid, new Vault(uid, keyStore, kv));
  return vaults.get(uid)!;
}
/** Destroys everything cached for a user (sign-out, revoked access). */
export async function wipe(uid: string) {
  await vaultFor(uid).destroy();
  vaults.delete(uid);
}
type AccessSnapshot = Omit<StaffAccess, never>;
const accessKey = (c: string) => `c:${c}:access`;
/**
 * Offline-aware identity: online it always asks the server (and remembers the
 * verified answer, encrypted); offline it uses only that last verified answer.
 * A denial from the server wipes the device copy.
 */
export const mobileResolver: Resolver = {
  async companies(db, uid) {
    const names = await vaultFor(uid).names('c:');
    const cached = [
      ...new Set(
        names.filter((n) => n.endsWith(':access')).map((n) => n.split(':')[1]),
      ),
    ];
    if (await onlineNow()) {
      try {
        // An empty answer can come from the local cache while the network is
        // unreachable; the per-company check below still asks the server.
        const live = await staffCompanies(db, uid);
        if (live.length) return live;
      } catch {
        /* fall through to cached */
      }
    }
    return cached;
  },
  async resolve(db, c, uid) {
    const v = vaultFor(uid);
    if (await onlineNow()) {
      const r = await resolveStaff(db, c, uid);
      if ('link' in r) {
        await v.put(accessKey(c), r);
        return r;
      }
      if (r.reason !== 'error') {
        await v.drop(accessKey(c));
        return r;
      }
    }
    const cached = await v.read<AccessSnapshot>(accessKey(c));
    return cached || ({ companyId: c, reason: 'error' } as StaffDenied);
  },
  async onDenied(uid) {
    await wipe(uid);
  },
};

/* ================================================================ context */
export type SyncState = {
  online: boolean;
  running: boolean;
  pending: number;
  conflicts: number;
  lastSyncAt: number | null;
  lastReport: SyncReport | null;
};
type Mobile = {
  repo: TaskRepo;
  queue: OpQueue;
  tasks: Task[];
  state: SyncState;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
  /** Queues a change, applies it to the local copy and syncs when online. */
  enqueue: (
    op: Omit<
      Op,
      | 'status'
      | 'attempts'
      | 'lastError'
      | 'lastAttemptAt'
      | 'payloadVersion'
      | 'createdAt'
      | 'companyId'
      | 'uid'
      | 'employeeId'
    >,
  ) => Promise<Task | null>;
  ops: Op[];
};
const Ctx = createContext<Mobile | null>(null);
export function useMobile() {
  const m = useContext(Ctx);
  if (!m) throw new Error('Mobile context missing');
  return m;
}
export function newId() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 20);
}
async function fetchMine(db: Firestore, a: StaffAccess) {
  const tz = a.timeZone,
    c = a.companyId,
    e = a.employee.id;
  const today = todayIn(tz);
  const [window, active, overdue, done] = await Promise.all([
    myTasksBetween(
      db,
      c,
      e,
      localDay(tz, addDays(today, -1))[0],
      localDay(tz, addDays(today, 8))[1],
      300,
    ),
    myTasksByStatus(db, c, e, [
      'in_progress',
      'paused',
      'rework_required',
      'awaiting_approval',
    ]),
    myOverdue(db, c, e),
    myTasksByStatus(db, c, e, ['completed'], true, 20),
  ]);
  return [
    ...new Map(
      [...window, ...active, ...overdue, ...done].map((t) => [t.id, t]),
    ).values(),
  ];
}
/** Names of the places in my tasks, kept encrypted so cards read well offline. */
async function saveLabels(staff: ReturnType<typeof useStaff>, tasks: Task[]) {
  const refs = new Set<string>();
  for (const t of tasks)
    for (const [kind, id] of [
      ['sites', t.siteId],
      ['locations', t.locationId],
      ['assets', t.assetId],
      ['facilities', t.facilityId],
    ] as const)
      if (id) refs.add(`${kind}|${id}`);
  const out: [string, string, string][] = [];
  for (const r of [...refs].slice(0, 200)) {
    const [kind, id] = r.split('|') as ['sites', string];
    const l = await lookup(staff.context, kind, id).catch(() => null);
    if (l) out.push([kind, id, l.name]);
  }
  await vaultFor(staff.uid).put(`c:${staff.companyId}:labels`, out);
}
export function MobileProvider({ children }: { children: ReactNode }) {
  const staff = useStaff();
  const db = staff.context.services.db;
  const vault = vaultFor(staff.uid);
  const repo = useMemo(
    () => new TaskRepo(vault, staff.companyId),
    [vault, staff.companyId],
  );
  const queue = useMemo(() => new OpQueue(vault), [vault]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ops, setOps] = useState<Op[]>([]);
  const [state, setState] = useState<SyncState>({
    online: navigator.onLine,
    running: false,
    pending: 0,
    conflicts: 0,
    lastSyncAt: null,
    lastReport: null,
  });
  const busy = useRef(false);
  const reloadLocal = useCallback(async () => {
    const snap = await repo.load();
    const names = await vault.read<[string, string, string][]>(
      `c:${staff.companyId}:labels`,
    );
    for (const [kind, id, name] of names || [])
      primeLabel(staff.context, kind as 'sites', id, name);
    setTasks(snap?.tasks || []);
    const list = (await queue.list()).filter(
      (o) => o.companyId === staff.companyId,
    );
    setOps(list);
    setState((s) => ({
      ...s,
      lastSyncAt: snap?.syncedAt ?? s.lastSyncAt,
      pending: list.filter(
        (o) => o.status === 'pending' || o.status === 'syncing',
      ).length,
      conflicts: list.filter((o) =>
        ['conflict', 'failed', 'blocked'].includes(o.status),
      ).length,
    }));
  }, [repo, queue, staff.companyId, staff.context, vault]);
  const syncNow = useCallback(async () => {
    if (busy.current) return;
    if (!(await onlineNow())) {
      setState((s) => ({ ...s, online: false }));
      return;
    }
    busy.current = true;
    setState((s) => ({ ...s, running: true, online: true }));
    try {
      const report = await runSync(queue, firestoreExecutor(db, staff.uid));
      if (report.revoked) {
        await wipe(staff.uid);
        location.reload();
        return;
      }
      if (!report.offline) {
        const fresh = await fetchMine(db, staff);
        // Keep local optimistic state for tasks that still have unsent changes.
        const unsent = new Set((await queue.pending()).map((o) => o.taskId));
        const local = new Map(
          (await repo.load())?.tasks.map((t) => [t.id, t]) || [],
        );
        const plain: StaffAccess = {
          companyId: staff.companyId,
          companyName: staff.companyName,
          timeZone: staff.timeZone,
          role: staff.role,
          link: staff.link,
          employee: staff.employee,
          supervisor: staff.supervisor,
        };
        await saveLabels(staff, fresh);
        await repo.save(
          plain,
          fresh.map((t) =>
            unsent.has(t.id) && local.get(t.id) ? local.get(t.id)! : t,
          ),
        );
      }
      setState((s) => ({ ...s, lastReport: report, online: !report.offline }));
    } catch {
      setState((s) => ({ ...s, online: navigator.onLine }));
    } finally {
      busy.current = false;
      setState((s) => ({ ...s, running: false }));
      await reloadLocal();
    }
  }, [queue, db, staff, repo, reloadLocal]);
  const enqueue = useCallback<Mobile['enqueue']>(
    async (op) => {
      const full = {
        ...op,
        companyId: staff.companyId,
        uid: staff.uid,
        employeeId: staff.employee.id,
      };
      await queue.add(full);
      const local = await repo.applyLocal({
        ...full,
        payloadVersion: 1,
        createdAt: new Date().toISOString(),
        status: 'pending',
        attempts: 0,
        lastError: '',
        lastAttemptAt: '',
      });
      await reloadLocal();
      void syncNow();
      return local;
    },
    [queue, repo, staff, reloadLocal, syncNow],
  );
  useEffect(() => {
    void reloadLocal().then(syncNow);
    const stop = watchNetwork((online) => {
      setState((s) => ({ ...s, online }));
      if (online) void syncNow();
    });
    const on = () => void syncNow();
    window.addEventListener('online', on);
    const off = () => setState((s) => ({ ...s, online: false }));
    window.addEventListener('offline', off);
    const timer = setInterval(() => void syncNow(), 120000);
    return () => {
      stop();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(timer);
    };
  }, [reloadLocal, syncNow]);
  // Switching company removes the previous company's cached operational data.
  useEffect(() => {
    void vault
      .names('c:')
      .then((names) =>
        Promise.all(
          names
            .filter((n) => !n.startsWith(`c:${staff.companyId}:`))
            .map((n) => vault.drop(n)),
        ),
      );
  }, [vault, staff.companyId]);
  const value = useMemo<Mobile>(
    () => ({
      repo,
      queue,
      tasks,
      state,
      refresh: syncNow,
      syncNow,
      enqueue,
      ops,
    }),
    [repo, queue, tasks, state, syncNow, enqueue, ops],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
