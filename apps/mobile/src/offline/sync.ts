import type { Vault } from './vault';

/**
 * Offline operation queue and synchronization engine.
 *
 * Every change the app makes is first written here as an operation, then
 * applied to the server by an executor that re-reads the server record and
 * re-checks authorization. The server's state is authoritative: an operation
 * whose base revision no longer matches is either recognised as already
 * applied (duplicate after a lost acknowledgement) or reported as a conflict;
 * it is never forced through.
 */
export type OpType =
  | 'start'
  | 'pause'
  | 'resume'
  | 'restart'
  | 'save_progress'
  | 'submit'
  | 'evidence'
  | 'report_issue';
export type OpStatus =
  'pending' | 'syncing' | 'done' | 'conflict' | 'failed' | 'blocked';
export type Op = {
  id: string;
  companyId: string;
  uid: string;
  employeeId: string;
  taskId: string;
  type: OpType;
  /** Task revision the change was made against ('' / -1 when not revisioned). */
  baseRevision: number;
  createdAt: string;
  payloadVersion: 1;
  payload: Record<string, unknown>;
  status: OpStatus;
  attempts: number;
  lastError: string;
  lastAttemptAt: string;
};
export type ApplyResult = 'applied' | 'duplicate';
export class ConflictError extends Error {
  readonly conflict = true;
}
export class AccessRevokedError extends Error {
  readonly revoked = true;
}
export interface Executor {
  /** Re-checks that the signed-in user is still authorized (throws AccessRevokedError). */
  revalidate(companyId: string): Promise<void>;
  apply(op: Op): Promise<ApplyResult>;
}
export function isNetworkError(e: unknown) {
  if (e instanceof ConflictError || e instanceof AccessRevokedError)
    return false;
  const code = String((e as { code?: string })?.code || '');
  const msg = String((e as Error)?.message || '');
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'auth/network-request-failed' ||
    /client is offline|network request failed|Failed to fetch/i.test(msg)
  );
}
const KEY = 'queue';
export class OpQueue {
  private ops: Op[] = [];
  private loaded = false;
  constructor(private vault: Vault) {}
  async load() {
    if (!this.loaded) {
      this.ops = (await this.vault.read<Op[]>(KEY)) || [];
      // An app killed mid-sync leaves "syncing" ops; they are retried safely.
      for (const o of this.ops)
        if (o.status === 'syncing') o.status = 'pending';
      this.loaded = true;
    }
    return this.ops;
  }
  private async save() {
    await this.vault.put(KEY, this.ops);
  }
  async add(
    op: Omit<
      Op,
      | 'status'
      | 'attempts'
      | 'lastError'
      | 'lastAttemptAt'
      | 'payloadVersion'
      | 'createdAt'
    > & { createdAt?: string },
  ) {
    await this.load();
    if (this.ops.some((o) => o.id === op.id)) return; // idempotent enqueue
    this.ops.push({
      payloadVersion: 1,
      createdAt: new Date().toISOString(),
      ...op,
      status: 'pending',
      attempts: 0,
      lastError: '',
      lastAttemptAt: '',
    });
    await this.save();
  }
  async list() {
    return [...(await this.load())];
  }
  async pending() {
    return (await this.load()).filter((o) => o.status === 'pending');
  }
  async update(id: string, patch: Partial<Op>) {
    await this.load();
    this.ops = this.ops.map((o) => (o.id === id ? { ...o, ...patch } : o));
    await this.save();
  }
  /** Removes finished operations and dismissed conflicts. */
  async prune(ids?: string[]) {
    await this.load();
    this.ops = this.ops.filter((o) =>
      ids ? !ids.includes(o.id) : o.status !== 'done',
    );
    await this.save();
  }
}
export type SyncReport = {
  applied: number;
  duplicates: number;
  conflicts: number;
  failed: number;
  offline: boolean;
  revoked: boolean;
};
/**
 * Runs pending operations in order. Stops on a network error (retried later),
 * marks a task's later operations as conflicts when an earlier one conflicts,
 * and blocks everything if access was revoked.
 */
export async function runSync(
  queue: OpQueue,
  exec: Executor,
  now = () => new Date(),
): Promise<SyncReport> {
  const report: SyncReport = {
    applied: 0,
    duplicates: 0,
    conflicts: 0,
    failed: 0,
    offline: false,
    revoked: false,
  };
  const pending = await queue.pending();
  if (!pending.length) return report;
  const companies = [...new Set(pending.map((o) => o.companyId))];
  try {
    for (const c of companies) await exec.revalidate(c);
  } catch (e) {
    if (isNetworkError(e)) return { ...report, offline: true };
    for (const o of pending)
      await queue.update(o.id, {
        status: 'blocked',
        lastError: 'Your access was removed. These changes were not sent.',
      });
    return { ...report, revoked: true };
  }
  const brokenTasks = new Set<string>();
  for (const op of pending) {
    if (op.taskId && brokenTasks.has(op.taskId)) {
      report.conflicts++;
      await queue.update(op.id, {
        status: 'conflict',
        lastError: 'An earlier change to this task could not be applied.',
      });
      continue;
    }
    await queue.update(op.id, {
      status: 'syncing',
      attempts: op.attempts + 1,
      lastAttemptAt: now().toISOString(),
    });
    try {
      const r = await exec.apply(op);
      r === 'applied' ? report.applied++ : report.duplicates++;
      await queue.update(op.id, { status: 'done', lastError: '' });
    } catch (e) {
      if (isNetworkError(e)) {
        await queue.update(op.id, {
          status: 'pending',
          lastError: 'Waiting for connection',
        });
        report.offline = true;
        break;
      }
      if (e instanceof AccessRevokedError) {
        await queue.update(op.id, { status: 'blocked', lastError: e.message });
        report.revoked = true;
        break;
      }
      const conflict =
        e instanceof ConflictError || (e as { conflict?: boolean }).conflict;
      if (op.taskId) brokenTasks.add(op.taskId);
      if (conflict) report.conflicts++;
      else report.failed++;
      await queue.update(op.id, {
        status: conflict ? 'conflict' : 'failed',
        lastError: (e as Error).message || 'Could not be applied',
      });
    }
  }
  return report;
}
