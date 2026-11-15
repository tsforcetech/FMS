import { describe, expect, it } from 'vitest';
import {
  allocationActive,
  allocationCovers,
  attendanceFlags,
  complianceStatus,
  costSummary,
  customerStatus,
  recordedMinutes,
  slaFacts,
  slaMetrics,
  staffProductivity,
  stockReconciliation,
  taskMetrics,
  type TaskFacts,
} from './reports';

const d = (s: string) => new Date(s);
const task = (v: Partial<TaskFacts>): TaskFacts => ({
  status: 'assigned',
  dueAt: d('2026-11-15T10:00:00Z'),
  completedAt: null,
  attempt: 1,
  exceptionCount: 0,
  approvalRequired: true,
  assigneeIds: ['e1'],
  estimatedMinutes: 30,
  ...v,
});
const now = d('2026-11-15T12:00:00Z');
describe('task metrics', () => {
  it('excludes cancelled tasks from rates, counts rework and on-time completion', () => {
    const m = taskMetrics(
      [
        task({
          status: 'completed',
          completedAt: d('2026-11-15T09:30:00Z'),
          startedAt: d('2026-11-15T09:00:00Z'),
          submittedAt: d('2026-11-15T09:25:00Z'),
        }),
        task({
          status: 'completed',
          completedAt: d('2026-11-15T11:00:00Z'),
          attempt: 2,
        }),
        task({ status: 'cancelled' }),
        task({ status: 'assigned' }),
        task({ status: 'awaiting_approval' }),
        task({ status: 'rejected', exceptionCount: 2 }),
        task({
          status: 'pending',
          assigneeIds: [],
          dueAt: d('2026-11-16T10:00:00Z'),
        }),
      ],
      now,
    );
    expect(m).toMatchObject({
      generated: 7,
      cancelled: 1,
      completed: 2,
      pending: 3,
      awaitingApproval: 1,
      overdue: 1,
      rejected: 1,
      reworkCount: 1,
      exceptions: 2,
      onTimeRate: 50,
      approvalRate: 66.7,
      avgCompletionMinutes: 25,
      durationCoverage: 50,
      assigned: 5,
    });
  });
  it('measures recorded duration only when start and submission were recorded', () => {
    expect(
      recordedMinutes({
        startedAt: d('2026-01-01T08:00:00Z'),
        submittedAt: d('2026-01-01T08:40:00Z'),
        completedAt: null,
      }),
    ).toBe(40);
    expect(
      recordedMinutes({
        startedAt: null,
        submittedAt: d('2026-01-01T08:40:00Z'),
        completedAt: null,
      }),
    ).toBeNull();
  });
  it('reports staff workload alongside counts', () => {
    const rows = staffProductivity(
      [
        task({ assigneeIds: ['a'], estimatedMinutes: 60 }),
        task({
          assigneeIds: ['a', 'b'],
          status: 'completed',
          completedAt: d('2026-11-15T09:00:00Z'),
        }),
        task({ assigneeIds: ['b'], status: 'cancelled' }),
      ],
      now,
    );
    const a = rows.find((r) => r.employeeId === 'a')!;
    expect(a).toMatchObject({
      assigned: 2,
      completed: 1,
      overdue: 1,
      workloadMinutes: 90,
      onTimeRate: 100,
    });
    expect(rows.find((r) => r.employeeId === 'b')!.assigned).toBe(1);
  });
});
describe('SLA', () => {
  const base = {
    kind: 'workOrders',
    priority: 'high',
    createdAt: d('2026-11-15T08:00:00Z'),
    responseDueAt: d('2026-11-15T09:00:00Z'),
    resolutionDueAt: d('2026-11-15T12:00:00Z'),
  };
  it('uses the stored targets and the actual times', () => {
    expect(
      slaFacts(
        {
          ...base,
          status: 'closed',
          open: false,
          respondedAt: d('2026-11-15T08:30:00Z'),
          resolvedAt: d('2026-11-15T11:00:00Z'),
        },
        now,
      ),
    ).toMatchObject({
      responseBreached: false,
      resolutionBreached: false,
      responseMinutes: 30,
      resolutionMinutes: 180,
    });
    expect(
      slaFacts(
        {
          ...base,
          status: 'in_progress',
          open: true,
          respondedAt: d('2026-11-15T09:30:00Z'),
          resolvedAt: null,
        },
        d('2026-11-15T13:00:00Z'),
      ),
    ).toMatchObject({ responseBreached: true, resolutionBreached: true });
    const m = slaMetrics(
      [
        {
          ...base,
          status: 'open',
          open: true,
          priority: 'critical',
          respondedAt: null,
          resolvedAt: null,
        },
        {
          ...base,
          kind: 'escalations',
          status: 'closed',
          open: false,
          respondedAt: d('2026-11-15T08:10:00Z'),
          resolvedAt: d('2026-11-15T08:50:00Z'),
          responseDueAt: null,
          resolutionDueAt: null,
        },
      ],
      now,
      1,
    );
    expect(m).toMatchObject({
      total: 2,
      withTargets: 1,
      withinSla: 0,
      responseBreached: 1,
      resolutionBreached: 0,
      escalations: 1,
      openCritical: 1,
      reopened: 1,
    });
  });
});
describe('inventory reconciliation', () => {
  it('derives closing balances from the ledger including transfers and reversals', () => {
    const m = (
      movementType: string,
      q: number,
      from: string,
      to: string,
      at: string,
    ) => ({
      materialId: 'm',
      movementType,
      quantity: q,
      fromStoreId: from,
      toStoreId: to,
      createdAt: d(at),
    });
    const lines = stockReconciliation(
      [
        m('opening', 40, '', 'A', '2026-10-01T00:00:00Z'),
        m('receipt', 60, '', 'A', '2026-11-02T00:00:00Z'),
        m('issue', 6, 'A', '', '2026-11-03T00:00:00Z'),
        m('transfer', 10, 'A', 'B', '2026-11-04T00:00:00Z'),
        m('adjustment_out', 1, 'A', '', '2026-11-05T00:00:00Z'),
        m('reversal', 60, 'A', '', '2026-11-06T00:00:00Z'),
        m('receipt', 5, '', 'A', '2026-12-01T00:00:00Z'),
      ],
      d('2026-11-01T00:00:00Z'),
      d('2026-11-30T23:59:59Z'),
    );
    const a = lines.find((l) => l.storeId === 'A')!;
    expect(a).toMatchObject({
      opening: 40,
      received: 60,
      issued: 6,
      transferOut: 10,
      adjusted: -1,
      reversed: -60,
      closing: 23,
    });
    expect(lines.find((l) => l.storeId === 'B')!.closing).toBe(10);
  });
});
describe('attendance, compliance, costs and customer scope', () => {
  it('flags lateness, missed check-out and corrections in local dates', () => {
    expect(
      attendanceFlags(
        {
          date: '2026-11-14',
          status: 'checked_in',
          checkIn: now,
          checkOut: null,
          lateMinutes: 12,
          corrected: false,
          hasLocation: true,
        },
        '2026-11-15',
      ),
    ).toEqual(['late', 'missed_check_out']);
    expect(
      attendanceFlags(
        {
          date: '2026-11-15',
          status: 'checked_in',
          checkIn: now,
          checkOut: null,
          lateMinutes: 0,
          corrected: true,
          hasLocation: false,
        },
        '2026-11-15',
      ),
    ).toEqual(['corrected']);
  });
  it('treats compliance as valid only with verified evidence', () => {
    expect(
      complianceStatus(
        { verified: false, expiryDate: '2027-06-01', evidenceRef: 'CERT-1' },
        '2026-11-15',
      ),
    ).toBe('evidence_pending');
    expect(
      complianceStatus(
        { verified: true, expiryDate: '2027-06-01', evidenceRef: '' },
        '2026-11-15',
      ),
    ).toBe('evidence_pending');
    expect(
      complianceStatus(
        { verified: true, expiryDate: '2027-06-01', evidenceRef: 'CERT-1' },
        '2026-11-15',
      ),
    ).toBe('valid');
    expect(
      complianceStatus(
        { verified: true, expiryDate: '2026-12-01', evidenceRef: 'CERT-1' },
        '2026-11-15',
      ),
    ).toBe('expiring');
    expect(
      complianceStatus(
        { verified: true, expiryDate: '2026-11-01', evidenceRef: 'CERT-1' },
        '2026-11-15',
      ),
    ).toBe('expired');
  });
  it('sums recorded costs by type only', () => {
    expect(
      costSummary([
        { type: 'labor', amount: 300, workOrderId: 'w', assetId: '' },
        { type: 'vendor', amount: 1200, workOrderId: 'w', assetId: '' },
        { type: 'weird', amount: 5, workOrderId: '', assetId: '' },
      ]),
    ).toEqual({
      total: 1505,
      byType: { labor: 300, vendor: 1200, material: 0, other: 5 },
    });
  });
  it('limits customers to active allocations and their exact rooms', () => {
    const room201 = {
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      effectiveEndDate: '',
      siteId: 'S',
      locationId: '201',
    };
    expect(allocationActive(room201, '2026-11-15')).toBe(true);
    expect(
      allocationActive(
        { ...room201, effectiveEndDate: '2026-10-31', status: 'terminated' },
        '2026-11-15',
      ),
    ).toBe(false);
    expect(allocationActive(room201, '2027-01-02')).toBe(false);
    expect(allocationCovers(room201, 'S', '201')).toBe(true);
    expect(allocationCovers(room201, 'S', '202')).toBe(false);
    expect(allocationCovers({ ...room201, locationId: '' }, 'S', '202')).toBe(
      true,
    );
    expect(customerStatus('assigned')).toBe('in_progress');
  });
});
