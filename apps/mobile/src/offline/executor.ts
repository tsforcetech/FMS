import { doc, getDoc, Timestamp, type Firestore } from 'firebase/firestore';
import {
  getTask,
  reportException,
  saveProgress,
  submitTask,
  transitionTask,
} from '@admin/management/tasksStore';
import { createCase, emptyCase } from '@admin/management/casesStore';
import { recordEvidence, type GeoReading } from '@admin/management/fieldStore';
import { resolveStaff } from '@admin/management/staffStore';
import type { QrTarget } from '@facilityos/shared';
import {
  AccessRevokedError,
  ConflictError,
  type Executor,
  type Op,
} from './sync';

/** Applies queued operations against Firestore using the same data layer as the web apps. */
export function firestoreExecutor(db: Firestore, uid: string): Executor {
  const asConflict = async <T>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (e) {
      const err = e as {
        userFacing?: boolean;
        name?: string;
        message?: string;
        code?: string;
      };
      if (err.code === 'permission-denied')
        throw new ConflictError(
          'You are no longer allowed to change this task.',
        );
      if (err.userFacing || err.name === 'UserError')
        throw new ConflictError(
          err.message || 'The server refused this change.',
        );
      throw e;
    }
  };
  return {
    async revalidate(companyId) {
      const r = await resolveStaff(db, companyId, uid);
      if ('link' in r) return;
      if (r.reason === 'error')
        throw Object.assign(new Error('Network unavailable'), {
          code: 'unavailable',
        });
      throw new AccessRevokedError('Your access to this company was removed.');
    },
    async apply(op: Op) {
      const c = op.companyId;
      const fresh = await getTask(db, c, op.taskId).catch((e) => {
        if ((e as { code?: string }).code === 'permission-denied')
          throw new ConflictError('This task is no longer assigned to you.');
        throw e;
      });
      if (!fresh) throw new ConflictError('This task no longer exists.');
      const p = op.payload;
      if (op.type === 'evidence') {
        const e =
          p.kind === 'qr'
            ? {
                type: 'qr' as const,
                target: p.target as QrTarget,
                capturedAt: new Date(p.capturedAt as string),
              }
            : {
                type: 'gps' as const,
                location: {
                  ...(p.location as GeoReading),
                  capturedAt: new Date(
                    (p.location as { capturedAt: string }).capturedAt,
                  ),
                },
              };
        if (fresh.attempt !== p.attempt)
          throw new ConflictError(
            'The task attempt changed before this evidence was sent.',
          );
        await asConflict(() =>
          recordEvidence(
            db,
            c,
            uid,
            op.employeeId,
            fresh,
            String(p.questionId),
            e,
          ),
        );
        return 'applied';
      }
      if (op.type === 'report_issue') {
        const exId = await asConflict(() =>
          reportException(
            db,
            c,
            uid,
            fresh,
            {
              type: String(p.category),
              severity: p.severity as 'warning' | 'critical',
              description: String(p.description),
              questionId: String(p.questionId || ''),
            },
            op.id,
          ),
        );
        if (p.workOrder)
          await asConflict(() =>
            createCase(db, c, uid, 'workOrders', {
              ...emptyCase('workOrders'),
              title: `${p.category}: ${p.description}`.slice(0, 160),
              description: String(p.description),
              priority: p.severity === 'critical' ? 'high' : 'medium',
              severity: p.severity === 'critical' ? 'high' : 'medium',
              category: String(p.category),
              siteId: fresh.siteId,
              locationId: fresh.locationId,
              facilityId: fresh.facilityId,
              assetId: fresh.assetId,
              departmentId: fresh.departmentId,
              sourceType: 'task_exception',
              sourceId: exId,
              reportedBy: String(p.reportedBy || ''),
            }),
          );
        return 'applied';
      }
      if (fresh.revision !== op.baseRevision) {
        if (fresh.revision > op.baseRevision) {
          // Lost acknowledgement: the same user already applied exactly this change.
          const ev = await getDoc(
            doc(
              db,
              'companies',
              c,
              'taskEvents',
              `${op.taskId}_${op.baseRevision + 1}`,
            ),
          ).catch(() => null);
          if (
            ev?.exists() &&
            ev.data().actorUid === uid &&
            ev.data().action === op.type
          )
            return 'duplicate';
          if (
            op.type === 'save_progress' &&
            fresh.revision === op.baseRevision + 1 &&
            (fresh as { updatedBy?: string }).updatedBy === uid &&
            JSON.stringify(fresh.draftAnswers || {}) ===
              JSON.stringify(clean(p.answers as Record<string, string>))
          )
            return 'duplicate';
        }
        throw new ConflictError(
          `This task was changed by someone else (now ${fresh.status.replaceAll('_', ' ')}). Your offline change was not applied.`,
        );
      }
      if (op.type === 'save_progress')
        await asConflict(() =>
          saveProgress(db, c, uid, fresh, p.answers as Record<string, string>),
        );
      else if (op.type === 'submit')
        await asConflict(() =>
          submitTask(
            db,
            c,
            uid,
            fresh,
            p.answers as Record<string, string>,
            String(p.remarks || ''),
          ),
        );
      else
        await asConflict(() =>
          transitionTask(
            db,
            c,
            uid,
            fresh,
            op.type as 'start' | 'pause' | 'resume' | 'restart',
          ),
        );
      return 'applied';
    },
  };
}
function clean(a: Record<string, string> = {}) {
  return Object.fromEntries(
    Object.entries(a)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => [k, v.slice(0, 4000)]),
  );
}
export const ts = (ms: number) => Timestamp.fromMillis(ms);
