import { Timestamp } from 'firebase/firestore';
import { transitions, type TaskStatus } from '@facilityos/shared';
import type { Task } from '@admin/management/tasksStore';
import type { StaffAccess } from '@admin/management/staffStore';
import type { Vault } from './vault';
import type { Op } from './sync';

/**
 * Encrypted local copy of the signed-in employee's own tasks, refreshed when
 * online. Only tasks the server returned for this employee are ever cached,
 * so nothing can be opened offline that was not synchronized first.
 */
type Stored = Record<string, unknown>;
function freeze(v: unknown): unknown {
  if (v instanceof Timestamp) return { __ts: v.toMillis() };
  if (Array.isArray(v)) return v.map(freeze);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, freeze(x)]),
    );
  return v;
}
function thaw(v: unknown): unknown {
  if (v && typeof v === 'object' && '__ts' in (v as object))
    return Timestamp.fromMillis((v as { __ts: number }).__ts);
  if (Array.isArray(v)) return v.map(thaw);
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, thaw(x)]));
  return v;
}
export type Snapshot = { syncedAt: number; access: Stored; tasks: Stored[] };
export class TaskRepo {
  constructor(
    private vault: Vault,
    private companyId: string,
  ) {}
  private get key() {
    return `c:${this.companyId}:tasks`;
  }
  async save(access: StaffAccess, tasks: Task[]) {
    await this.vault.put(this.key, {
      syncedAt: Date.now(),
      access: freeze(access) as Stored,
      tasks: tasks.map((t) => freeze(t) as Stored),
    } satisfies Snapshot);
  }
  async load() {
    const s = await this.vault.read<Snapshot>(this.key);
    if (!s) return null;
    return {
      syncedAt: s.syncedAt,
      access: thaw(s.access) as StaffAccess,
      tasks: s.tasks.map((t) => thaw(t) as Task),
    };
  }
  async get(id: string) {
    return (await this.load())?.tasks.find((t) => t.id === id) || null;
  }
  /** Optimistically applies a queued operation to the cached task. */
  async applyLocal(op: Op) {
    const s = await this.load();
    if (!s) return null;
    const tasks = s.tasks.map((t) =>
      t.id === op.taskId ? localApply(t, op) : t,
    );
    await this.vault.put(this.key, {
      syncedAt: s.syncedAt,
      access: freeze(s.access) as Stored,
      tasks: tasks.map((t) => freeze(t) as Stored),
    });
    return tasks.find((t) => t.id === op.taskId) || null;
  }
  /** Local answers typed but not yet queued (survive app restarts). */
  async saveDraft(
    taskId: string,
    attempt: number,
    answers: Record<string, string>,
  ) {
    await this.vault.put(
      `c:${this.companyId}:draft:${taskId}:${attempt}`,
      answers,
    );
  }
  async draft(taskId: string, attempt: number) {
    return (
      (await this.vault.read<Record<string, string>>(
        `c:${this.companyId}:draft:${taskId}:${attempt}`,
      )) || null
    );
  }
  async clearDraft(taskId: string, attempt: number) {
    await this.vault.drop(`c:${this.companyId}:draft:${taskId}:${attempt}`);
  }
}
export function localApply(t: Task, op: Op): Task {
  if (op.type === 'evidence' || op.type === 'report_issue') return t;
  if (op.type === 'save_progress')
    return {
      ...t,
      draftAnswers: op.payload.answers as Record<string, string>,
      revision: t.revision + 1,
    };
  const rule = transitions[op.type as keyof typeof transitions];
  const to = rule.to(t.approvalRequired) as TaskStatus;
  return {
    ...t,
    status: to,
    revision: t.revision + 1,
    attempt: op.type === 'restart' ? t.attempt + 1 : t.attempt,
    draftAnswers:
      op.type === 'submit' || op.type === 'restart' ? {} : t.draftAnswers,
  };
}
