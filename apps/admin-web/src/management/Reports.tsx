import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3,
  FileCheck2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  caseDefinitions,
  complianceCategories,
  complianceStatus,
  costSummary,
  costTypes,
  attendanceFlags,
  reportDefinitions,
  slaMetrics,
  staffProductivity,
  stockReconciliation,
  taskMetrics,
  toLocal,
} from '@facilityos/shared';
import { formatDate, formatInstant, type Context } from './context';
import { Name } from './Tasks';
import { Picker } from './Picker';
import {
  archiveCompliance,
  listCompliance,
  loadAttendance,
  loadCases,
  loadCosts,
  loadMovements,
  loadTasks,
  recordCost,
  reopenCount,
  saveCompliance,
  taskCounts,
  type ComplianceInput,
  type ComplianceRecord,
  type Range,
} from './reportsStore';
import {
  Banner,
  Drawer,
  Empty,
  Pill,
  Segmented,
  Skeleton,
  friendly,
  humanize,
  useToast,
} from '../ui/kit';

/**
 * Phase 7 Reports & Analytics. All figures come from the shared report
 * engine (packages/shared/src/reports.ts) over bounded, admin-only reads, so
 * the numbers match the future Phase 8 exports. Each screen states its
 * definitions and says when a period was too large to read completely.
 */
export type ReportScreen =
  | 'mgmtDashboard'
  | 'taskReport'
  | 'staffReport'
  | 'siteReport'
  | 'maintenanceReport'
  | 'assetReport'
  | 'inventoryReport'
  | 'attendanceReport'
  | 'slaReport'
  | 'complianceReport';

type Period = '7d' | '30d' | 'month' | 'custom';
type Filter = { period: Period; from: string; to: string; siteId: string };
const day = 86400000;
function rangeOf(
  f: Filter,
  tz: string,
): Range & { fromDate: string; toDate: string } {
  const today = toLocal(new Date(), tz).date;
  const at = (d: string) => new Date(d + 'T00:00:00');
  let from: string, to: string;
  if (f.period === 'custom' && f.from && f.to) {
    from = f.from;
    to = f.to;
  } else if (f.period === 'month') {
    from = today.slice(0, 8) + '01';
    to = today;
  } else {
    const n = f.period === '7d' ? 6 : 29;
    from = new Date(at(today).getTime() - n * day).toISOString().slice(0, 10);
    to = today;
  }
  return {
    from: at(from),
    to: new Date(at(to).getTime() + day),
    fromDate: from,
    toDate: to,
  };
}
const fmtPct = (v: number | null) => (v === null ? '—' : `${v}%`);
const fmtMin = (v: number | null) =>
  v === null ? '—' : v >= 120 ? `${Math.round(v / 6) / 10} h` : `${v} min`;
const money = (v: number, cur = '') =>
  `${cur ? cur + ' ' : ''}${v.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

function Filters({
  context,
  value,
  onChange,
  site = true,
}: {
  context: Context;
  value: Filter;
  onChange: (f: Filter) => void;
  site?: boolean;
}) {
  return (
    <div className="toolbar report-filters">
      <Segmented
        label="Period"
        value={value.period}
        onChange={(period) => onChange({ ...value, period })}
        options={[
          { value: '7d', label: '7 days' },
          { value: '30d', label: '30 days' },
          { value: 'month', label: 'This month' },
          { value: 'custom', label: 'Custom' },
        ]}
      />
      {value.period === 'custom' && (
        <>
          <label className="sr-only" htmlFor="rf-from">
            From
          </label>
          <input
            className="input"
            id="rf-from"
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <label className="sr-only" htmlFor="rf-to">
            To
          </label>
          <input
            className="input"
            id="rf-to"
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </>
      )}
      {site && (
        <div style={{ minWidth: 220 }}>
          <label className="field-label" htmlFor="rf-site">
            Site
          </label>
          <Picker
            context={context}
            kind="sites"
            label="Site"
            inputId="rf-site"
            value={value.siteId}
            onChange={(siteId) => onChange({ ...value, siteId })}
            placeholder="All sites"
          />
        </div>
      )}
    </div>
  );
}
function Stats({ items }: { items: [string, ReactNode, string?][] }) {
  return (
    <div className="stat-grid">
      {items.map(([label, v, tone]) => (
        <div key={label} className={`stat${tone ? ' stat-' + tone : ''}`}>
          <strong>{v}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
function Bar({
  value,
  max,
  tone = 'blue',
}: {
  value: number;
  max: number;
  tone?: string;
}) {
  const w = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <span className="bar-track" aria-hidden="true">
      <span className={`bar-fill tone-${tone}`} style={{ width: `${w}%` }} />
    </span>
  );
}
function Table({
  head,
  rows,
  empty = 'No data in this period.',
}: {
  head: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  if (!rows.length) return <Empty icon={BarChart3} title={empty} />;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Card({
  title,
  children,
  note,
}: {
  title: string;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <section className="card card-pad rise">
      <div className="card-head">
        <h2>{title}</h2>
      </div>
      {children}
      {note && <p className="muted small">{note}</p>}
    </section>
  );
}
function Truncated({ on }: { on: boolean }) {
  return on ? (
    <Banner tone="amber" title="Partial period">
      This period holds more records than an interactive report reads at once.
      Narrow the dates or choose a site; full exports arrive in Phase 8.
    </Banner>
  ) : null;
}
function Definitions({ id }: { id: string }) {
  const d = reportDefinitions[id];
  return d ? <p className="muted small">{d.description}</p> : null;
}
/** Loads data for the current filter; re-runs when it changes. */
function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [v, setV] = useState(0);
  useEffect(() => {
    let live = true;
    setData(undefined);
    setError('');
    fn()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, v]);
  return { data, error, reload: () => setV((x) => x + 1) };
}

export function ReportsArea({
  context,
  screen,
}: {
  context: Context;
  screen: ReportScreen;
}) {
  const tz = context.company.timeZone;
  const [f, setF] = useState<Filter>({
    period: '30d',
    from: '',
    to: '',
    siteId: '',
  });
  const r = useMemo(() => rangeOf(f, tz), [f, tz]);
  const body =
    screen === 'complianceReport' ? (
      <Compliance context={context} />
    ) : screen === 'mgmtDashboard' ? (
      <Management context={context} r={r} siteId={f.siteId} />
    ) : screen === 'taskReport' ? (
      <TaskReport context={context} r={r} siteId={f.siteId} />
    ) : screen === 'staffReport' ? (
      <StaffReport context={context} r={r} siteId={f.siteId} />
    ) : screen === 'siteReport' ? (
      <SiteReport context={context} r={r} />
    ) : screen === 'maintenanceReport' || screen === 'assetReport' ? (
      <MaintenanceReport
        context={context}
        r={r}
        siteId={f.siteId}
        assets={screen === 'assetReport'}
      />
    ) : screen === 'inventoryReport' ? (
      <InventoryReport context={context} r={r} />
    ) : screen === 'attendanceReport' ? (
      <AttendanceReport context={context} r={r} siteId={f.siteId} />
    ) : (
      <SlaReport context={context} r={r} siteId={f.siteId} />
    );
  return (
    <>
      {screen !== 'complianceReport' && (
        <Filters
          context={context}
          value={f}
          onChange={setF}
          site={!['siteReport', 'inventoryReport'].includes(screen)}
        />
      )}
      {screen !== 'complianceReport' && (
        <p className="muted small">
          {formatDate(r.fromDate)} – {formatDate(r.toDate)} · {tz}
        </p>
      )}
      {body}
    </>
  );
}
const bySite = <T extends { siteId: string }>(rows: T[], siteId: string) =>
  siteId ? rows.filter((x) => x.siteId === siteId) : rows;

/* ===================================================== management dashboard */
function Management({
  context,
  r,
  siteId,
}: {
  context: Context;
  r: Range;
  siteId: string;
}) {
  const db = context.services.db,
    c = context.company.companyId;
  const { data, error } = useLoad(async () => {
    const [counts, tasks, wo, cmp, esc] = await Promise.all([
      taskCounts(db, c, r, siteId),
      loadTasks(db, c, r),
      loadCases(db, c, 'workOrders', r, caseDefinitions.workOrders.open),
      loadCases(db, c, 'complaints', r, caseDefinitions.complaints.open),
      loadCases(db, c, 'escalations', r, caseDefinitions.escalations.open),
    ]);
    return { counts, tasks, wo, cmp, esc };
  }, [db, c, r.from.getTime(), r.to.getTime(), siteId]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={5} />;
  const tasks = bySite(data.tasks.rows, siteId);
  const m = taskMetrics(tasks);
  const cases = [...data.wo.rows, ...data.cmp.rows, ...data.esc.rows].filter(
    (x) => !siteId || x.siteId === siteId,
  );
  const sla = slaMetrics(cases);
  const perSite = new Map<string, number[]>();
  for (const t of data.tasks.rows) {
    const v = perSite.get(t.siteId) || [0, 0, 0];
    v[0]++;
    if (t.status === 'completed') v[1]++;
    if (taskMetrics([t]).overdue) v[2]++;
    perSite.set(t.siteId, v);
  }
  const sites = [...perSite.entries()]
    .sort((a, b) => b[1][2] - a[1][2])
    .slice(0, 8);
  const max = Math.max(1, ...sites.map((s) => s[1][0]));
  return (
    <>
      <Truncated on={data.tasks.truncated} />
      <Card
        title="Operations at a glance"
        note="Counts are server aggregates over tasks due in the period. Rates exclude cancelled tasks."
      >
        <Stats
          items={[
            ['Open tasks', data.counts.open],
            [
              'Overdue now',
              data.counts.overdue,
              data.counts.overdue ? 'red' : 'green',
            ],
            ['Awaiting approval', data.counts.awaiting, 'amber'],
            ['Completed', data.counts.completed, 'green'],
            ['On-time completion', fmtPct(m.onTimeRate)],
            [
              'Rework (extra attempts)',
              m.reworkCount,
              m.reworkCount ? 'amber' : undefined,
            ],
            [
              'Open critical cases',
              sla.openCritical,
              sla.openCritical ? 'red' : undefined,
            ],
            [
              'SLA breaches',
              sla.responseBreached + sla.resolutionBreached,
              sla.resolutionBreached ? 'red' : 'green',
            ],
          ]}
        />
      </Card>
      <div className="dash-grid">
        <Card title="Sites needing attention">
          <Table
            head={['Site', 'Tasks', 'Completed', 'Overdue', '']}
            rows={sites.map(([s, v]) => [
              <Name key="n" context={context} kind="sites" id={s} />,
              v[0],
              v[1],
              v[2],
              <Bar
                key="b"
                value={v[0]}
                max={max}
                tone={v[2] ? 'red' : 'green'}
              />,
            ])}
          />
        </Card>
        <Card title="Cases raised in period">
          <Stats
            items={[
              ['Work orders', data.wo.rows.length],
              ['Complaints', data.cmp.rows.length],
              [
                'From customer portal',
                data.cmp.rows.filter((x) => x.sourceType === 'service_request')
                  .length,
              ],
              ['Escalations', data.esc.rows.length],
            ]}
          />
        </Card>
      </div>
    </>
  );
}

/* ===================================================================== tasks */
function TaskReport({
  context,
  r,
  siteId,
}: {
  context: Context;
  r: Range;
  siteId: string;
}) {
  const db = context.services.db,
    c = context.company.companyId;
  const { data, error } = useLoad(
    () => loadTasks(db, c, r),
    [db, c, r.from.getTime(), r.to.getTime()],
  );
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={5} />;
  const tasks = bySite(data.rows, siteId);
  const m = taskMetrics(tasks);
  const byTemplate = new Map<string, typeof tasks>();
  for (const t of tasks)
    byTemplate.set(t.templateId, [...(byTemplate.get(t.templateId) || []), t]);
  return (
    <>
      <Truncated on={data.truncated} />
      <Definitions id="tasks" />
      <Card
        title="Task performance"
        note={`Average time is recorded only where the task was started and submitted (${fmtPct(m.durationCoverage)} of completed tasks).`}
      >
        <Stats
          items={[
            ['Generated', m.generated],
            ['Assigned', m.assigned],
            ['Completed', m.completed, 'green'],
            ['Pending', m.pending],
            ['Overdue', m.overdue, m.overdue ? 'red' : undefined],
            ['Rejected', m.rejected, m.rejected ? 'amber' : undefined],
            ['Rework', m.reworkCount],
            ['Exceptions', m.exceptions],
            ['Avg completion', fmtMin(m.avgCompletionMinutes)],
            ['On-time rate', fmtPct(m.onTimeRate)],
            ['Approval rate', fmtPct(m.approvalRate)],
            ['Cancelled (excluded)', m.cancelled],
          ]}
        />
      </Card>
      <Card title="By checklist template">
        <Table
          head={[
            'Template',
            'Tasks',
            'Completed',
            'Overdue',
            'On time',
            'Rework',
          ]}
          rows={[...byTemplate.entries()].map(([id, list]) => {
            const x = taskMetrics(list);
            return [
              id ? (
                <Name key="n" context={context} kind="taskTemplates" id={id} />
              ) : (
                'Ad hoc'
              ),
              x.generated,
              x.completed,
              x.overdue,
              fmtPct(x.onTimeRate),
              x.reworkCount,
            ];
          })}
        />
      </Card>
    </>
  );
}

/* ===================================================================== staff */
function StaffReport({
  context,
  r,
  siteId,
}: {
  context: Context;
  r: Range;
  siteId: string;
}) {
  const db = context.services.db,
    c = context.company.companyId;
  const { data, error } = useLoad(
    () => loadTasks(db, c, r),
    [db, c, r.from.getTime(), r.to.getTime()],
  );
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={5} />;
  const rows = staffProductivity(bySite(data.rows, siteId)).sort(
    (a, b) => b.assigned - a.assigned,
  );
  const max = Math.max(1, ...rows.map((x) => x.workloadMinutes));
  return (
    <>
      <Truncated on={data.truncated} />
      <Definitions id="staff" />
      <Card
        title="Staff productivity"
        note="Planned workload uses each task's estimate; recorded time uses actual start and submission times. Compare people doing similar work only."
      >
        <Table
          head={[
            'Employee',
            'Assigned',
            'Completed',
            'Pending',
            'Overdue',
            'Rework',
            'On time',
            'Planned',
            'Recorded',
            'Load',
          ]}
          rows={rows.map((x) => [
            <Name
              key="n"
              context={context}
              kind="employees"
              id={x.employeeId}
            />,
            x.assigned,
            x.completed,
            x.pending,
            x.overdue,
            x.rework,
            fmtPct(x.onTimeRate),
            fmtMin(x.workloadMinutes),
            fmtMin(x.recordedMinutes || null),
            <Bar
              key="b"
              value={x.workloadMinutes}
              max={max}
              tone={x.overdue ? 'amber' : 'blue'}
            />,
          ])}
        />
      </Card>
    </>
  );
}

/* ===================================================================== sites */
function SiteReport({ context, r }: { context: Context; r: Range }) {
  const db = context.services.db,
    c = context.company.companyId;
  const { data, error } = useLoad(
    async () => ({
      tasks: await loadTasks(db, c, r),
      cases: await loadCases(
        db,
        c,
        'complaints',
        r,
        caseDefinitions.complaints.open,
      ),
      wo: await loadCases(
        db,
        c,
        'workOrders',
        r,
        caseDefinitions.workOrders.open,
      ),
    }),
    [db, c, r.from.getTime(), r.to.getTime()],
  );
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={5} />;
  const ids = [
    ...new Set(
      [...data.tasks.rows, ...data.cases.rows, ...data.wo.rows].map(
        (x) => x.siteId,
      ),
    ),
  ];
  return (
    <>
      <Truncated on={data.tasks.truncated} />
      <Card
        title="Site performance"
        note="SLA uses the targets stored on each case when it was raised."
      >
        <Table
          head={[
            'Site',
            'Tasks',
            'Completed',
            'Overdue',
            'On time',
            'Work orders',
            'Complaints',
            'SLA breaches',
          ]}
          rows={ids.map((s) => {
            const t = taskMetrics(
              data.tasks.rows.filter((x) => x.siteId === s),
            );
            const cs = [...data.cases.rows, ...data.wo.rows].filter(
              (x) => x.siteId === s,
            );
            const sla = slaMetrics(cs);
            return [
              <Name key="n" context={context} kind="sites" id={s} />,
              t.generated,
              t.completed,
              t.overdue,
              fmtPct(t.onTimeRate),
              data.wo.rows.filter((x) => x.siteId === s).length,
              data.cases.rows.filter((x) => x.siteId === s).length,
              sla.responseBreached + sla.resolutionBreached,
            ];
          })}
        />
      </Card>
    </>
  );
}

/* ========================================================= maintenance/assets */
function MaintenanceReport({
  context,
  r,
  siteId,
  assets,
}: {
  context: Context;
  r: Range & { fromDate?: string; toDate?: string };
  siteId: string;
  assets: boolean;
}) {
  const db = context.services.db,
    c = context.company.companyId;
  const range = r as Range & { fromDate: string; toDate: string };
  const [adding, setAdding] = useState(false);
  const { data, error, reload } = useLoad(
    async () => ({
      wo: await loadCases(
        db,
        c,
        'workOrders',
        r,
        caseDefinitions.workOrders.open,
      ),
      costs: await loadCosts(db, c, range.fromDate, range.toDate),
    }),
    [db, c, r.from.getTime(), r.to.getTime()],
  );
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={5} />;
  const wo = bySite(data.wo.rows, siteId);
  const costs = bySite(data.costs.rows, siteId);
  const sum = costSummary(costs);
  const currency = costs[0]?.currency || '';
  const mixed = new Set(costs.map((x) => x.currency)).size > 1;
  const preventive = wo.filter(
    (x) => x.sourceType === 'schedule' || x.sourceType === 'pm',
  ).length;
  const sla = slaMetrics(wo);
  const byAsset = new Map<string, { wo: number; cost: number }>();
  for (const w of wo)
    if (w.assetId)
      byAsset.set(w.assetId, {
        ...(byAsset.get(w.assetId) || { wo: 0, cost: 0 }),
        wo: (byAsset.get(w.assetId)?.wo || 0) + 1,
      });
  for (const x of costs)
    if (x.assetId)
      byAsset.set(x.assetId, {
        wo: byAsset.get(x.assetId)?.wo || 0,
        cost: (byAsset.get(x.assetId)?.cost || 0) + x.amount,
      });
  return (
    <>
      <Truncated on={data.wo.truncated || data.costs.truncated} />
      <Definitions id={assets ? 'assets' : 'maintenance'} />
      {mixed && (
        <Banner tone="amber">
          Costs are recorded in more than one currency; totals below add them
          without conversion.
        </Banner>
      )}
      <Card
        title={assets ? 'Asset performance & cost' : 'Maintenance'}
        note="Cost figures are only the maintenance costs recorded below — never asset purchase value. Material use is reported in quantities on the inventory report."
      >
        <Stats
          items={[
            ['Work orders', wo.length],
            ['Preventive', preventive],
            ['Corrective', wo.length - preventive],
            ['Open', wo.filter((x) => x.open).length],
            ['Avg resolution', fmtMin(sla.avgResolutionMinutes)],
            ['Recorded cost', money(sum.total, currency)],
            ...costTypes.map(
              (t) =>
                [humanize(t), money(sum.byType[t], currency)] as [
                  string,
                  string,
                ],
            ),
          ]}
        />
        <div className="toolbar">
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAdding(true)}
          >
            <Plus /> Record cost
          </button>
        </div>
      </Card>
      {assets ? (
        <Card title="By asset">
          <Table
            head={['Asset', 'Work orders', 'Recorded cost']}
            rows={[...byAsset.entries()]
              .sort((a, b) => b[1].cost - a[1].cost || b[1].wo - a[1].wo)
              .map(([id, v]) => [
                <Name key="n" context={context} kind="assets" id={id} />,
                v.wo,
                money(v.cost, currency),
              ])}
          />
        </Card>
      ) : (
        <Card title="Recorded costs">
          <Table
            head={['Date', 'Site', 'Type', 'Description', 'Amount']}
            rows={costs.map((x) => [
              formatDate(x.incurredDate),
              <Name key="n" context={context} kind="sites" id={x.siteId} />,
              humanize(x.type),
              x.description,
              money(x.amount, x.currency),
            ])}
          />
        </Card>
      )}
      {adding && (
        <CostDrawer
          context={context}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
    </>
  );
}
function CostDrawer({
  context,
  onClose,
  onSaved,
}: {
  context: Context;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [v, setV] = useState({
    siteId: '',
    assetId: '',
    workOrderId: '',
    type: 'vendor',
    amount: '',
    currency: 'AED',
    description: '',
    incurredDate: toLocal(new Date(), context.company.timeZone).date,
  });
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError('');
    try {
      await recordCost(
        context.services.db,
        context.company.companyId,
        context.uid,
        {
          ...v,
          amount: Number(v.amount),
          currency: v.currency.toUpperCase(),
        },
      );
      toast('Cost recorded');
      onSaved();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Drawer
      title="Record maintenance cost"
      subtitle="Costs are append-only. To correct one, record an adjusting entry."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void save()}
          >
            Save cost
          </button>
        </>
      }
    >
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <div className="form-grid">
        <div className="field wide">
          <label className="field-label" htmlFor="cost-site">
            Site
          </label>
          <Picker
            context={context}
            kind="sites"
            label="Site"
            inputId="cost-site"
            value={v.siteId}
            onChange={(siteId) => setV({ ...v, siteId, assetId: '' })}
          />
        </div>
        <div className="field wide">
          <label className="field-label" htmlFor="cost-asset">
            Asset (optional)
          </label>
          <Picker
            context={context}
            kind="assets"
            label="Asset (optional)"
            inputId="cost-asset"
            value={v.assetId}
            filter={v.siteId ? { key: 'siteId', value: v.siteId } : undefined}
            onChange={(assetId) => setV({ ...v, assetId })}
          />
        </div>
        <div className="field">
          <label htmlFor="cost-type">Type</label>
          <select
            className="select"
            id="cost-type"
            value={v.type}
            onChange={(e) => setV({ ...v, type: e.target.value })}
          >
            {costTypes.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cost-date">Date</label>
          <input
            className="input"
            id="cost-date"
            type="date"
            value={v.incurredDate}
            onChange={(e) => setV({ ...v, incurredDate: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="cost-amount">Amount</label>
          <input
            className="input"
            id="cost-amount"
            inputMode="decimal"
            value={v.amount}
            onChange={(e) => setV({ ...v, amount: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="cost-cur">Currency</label>
          <input
            className="input"
            id="cost-cur"
            maxLength={3}
            value={v.currency}
            onChange={(e) => setV({ ...v, currency: e.target.value })}
          />
        </div>
        <div className="field wide">
          <label htmlFor="cost-desc">Description</label>
          <input
            className="input"
            id="cost-desc"
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
        </div>
      </div>
    </Drawer>
  );
}

/* ================================================================= inventory */
function InventoryReport({ context, r }: { context: Context; r: Range }) {
  const db = context.services.db,
    c = context.company.companyId;
  const { data, error } = useLoad(
    () => loadMovements(db, c, r),
    [db, c, r.from.getTime(), r.to.getTime()],
  );
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={5} />;
  const lines = stockReconciliation(data.rows, r.from, r.to).filter(
    (l) =>
      l.opening ||
      l.closing ||
      l.received ||
      l.issued ||
      l.transferIn ||
      l.transferOut ||
      l.adjusted ||
      l.reversed,
  );
  return (
    <>
      {data.truncated && (
        <Banner tone="red" title="Ledger too large to reconcile here">
          Opening balances need the full movement history, which exceeds what an
          interactive report reads. Use the stock balance screen for current
          balances.
        </Banner>
      )}
      <Definitions id="inventory" />
      <Card
        title="Stock reconciliation"
        note="Opening + received − issued + transfers in − transfers out ± adjustments ± reversals = closing. Quantities only; no unit costs are recorded."
      >
        <Table
          head={[
            'Store',
            'Material',
            'Opening',
            'Received',
            'Issued',
            'Transfer in',
            'Transfer out',
            'Adjusted',
            'Reversed',
            'Closing',
          ]}
          rows={lines.map((l) => [
            <Name key="s" context={context} kind="stores" id={l.storeId} />,
            <Name
              key="m"
              context={context}
              kind="materials"
              id={l.materialId}
            />,
            l.opening,
            l.received,
            l.issued,
            l.transferIn,
            l.transferOut,
            l.adjusted,
            l.reversed,
            <strong key="c">{l.closing}</strong>,
          ])}
        />
      </Card>
    </>
  );
}

/* ================================================================ attendance */
function AttendanceReport({
  context,
  r,
  siteId,
}: {
  context: Context;
  r: Range & { fromDate?: string; toDate?: string };
  siteId: string;
}) {
  const db = context.services.db,
    c = context.company.companyId;
  const range = r as Range & { fromDate: string; toDate: string };
  const { data, error } = useLoad(
    () => loadAttendance(db, c, range.fromDate, range.toDate),
    [db, c, range.fromDate, range.toDate],
  );
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={5} />;
  const today = toLocal(new Date(), context.company.timeZone).date;
  const rows = bySite(data.rows, siteId);
  const by = new Map<string, typeof rows>();
  for (const a of rows)
    by.set(a.employeeId, [...(by.get(a.employeeId) || []), a]);
  const flagged = rows.map((a) => ({ a, f: attendanceFlags(a, today) }));
  return (
    <>
      <Truncated on={data.truncated} />
      <Definitions id="attendance" />
      <Card
        title="Attendance"
        note="Times are server timestamps. Corrections are made by supervisors with a reason and are flagged here. Location coordinates are not shown in reports."
      >
        <Stats
          items={[
            ['Check-ins', rows.length],
            [
              'Late',
              flagged.filter((x) => x.f.includes('late')).length,
              'amber',
            ],
            [
              'Missed check-out',
              flagged.filter((x) => x.f.includes('missed_check_out')).length,
              'red',
            ],
            [
              'Corrected',
              flagged.filter((x) => x.f.includes('corrected')).length,
              'violet',
            ],
          ]}
        />
      </Card>
      <Card title="By employee">
        <Table
          head={[
            'Employee',
            'Days',
            'Late',
            'Late minutes',
            'Missed check-out',
            'Corrected',
          ]}
          rows={[...by.entries()].map(([e, list]) => {
            const f = list.map((a) => attendanceFlags(a, today));
            return [
              <Name key="n" context={context} kind="employees" id={e} />,
              list.length,
              f.filter((x) => x.includes('late')).length,
              list.reduce((s, a) => s + a.lateMinutes, 0),
              f.filter((x) => x.includes('missed_check_out')).length,
              f.filter((x) => x.includes('corrected')).length,
            ];
          })}
        />
      </Card>
    </>
  );
}

/* ======================================================================= SLA */
function SlaReport({
  context,
  r,
  siteId,
}: {
  context: Context;
  r: Range;
  siteId: string;
}) {
  const db = context.services.db,
    c = context.company.companyId;
  const { data, error } = useLoad(async () => {
    const [wo, cmp, esc, reopened] = await Promise.all([
      loadCases(db, c, 'workOrders', r, caseDefinitions.workOrders.open),
      loadCases(db, c, 'complaints', r, caseDefinitions.complaints.open),
      loadCases(db, c, 'escalations', r, caseDefinitions.escalations.open),
      reopenCount(db, c, r),
    ]);
    return { wo, cmp, esc, reopened };
  }, [db, c, r.from.getTime(), r.to.getTime()]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={5} />;
  const groups = [
    ['Work orders', bySite(data.wo.rows, siteId)],
    ['Complaints', bySite(data.cmp.rows, siteId)],
    ['Escalations', bySite(data.esc.rows, siteId)],
  ] as const;
  const all = groups.flatMap((g) => g[1]);
  const m = slaMetrics(all, new Date(), data.reopened ?? 0);
  return (
    <>
      <Truncated on={data.wo.truncated || data.cmp.truncated} />
      <Definitions id="sla" />
      <Card
        title="SLA performance"
        note="Breaches use the response and resolution targets stored on each case when it was raised, so later policy edits do not rewrite history."
      >
        <Stats
          items={[
            ['Cases', m.total],
            ['With SLA targets', m.withTargets],
            ['Within SLA', m.withinSla, 'green'],
            [
              'Response breached',
              m.responseBreached,
              m.responseBreached ? 'red' : undefined,
            ],
            [
              'Resolution breached',
              m.resolutionBreached,
              m.resolutionBreached ? 'red' : undefined,
            ],
            ['Avg response', fmtMin(m.avgResponseMinutes)],
            ['Avg resolution', fmtMin(m.avgResolutionMinutes)],
            ['Reopened complaints', data.reopened ?? '—'],
          ]}
        />
      </Card>
      <Card title="By record type">
        <Table
          head={[
            'Type',
            'Cases',
            'Within SLA',
            'Response breached',
            'Resolution breached',
            'Open critical',
          ]}
          rows={groups.map(([label, list]) => {
            const x = slaMetrics([...list]);
            return [
              label,
              x.total,
              x.withinSla,
              x.responseBreached,
              x.resolutionBreached,
              x.openCritical,
            ];
          })}
        />
      </Card>
    </>
  );
}

/* ================================================================ compliance */
const blankCompliance: ComplianceInput = {
  category: 'Fire safety',
  title: '',
  siteId: '',
  assetId: '',
  facilityId: '',
  issuer: '',
  reference: '',
  issuedDate: '',
  expiryDate: '',
  evidenceRef: '',
  verified: false,
  notes: '',
};
const complianceTone = {
  valid: 'green',
  expiring: 'amber',
  expired: 'red',
  evidence_pending: 'gray',
} as const;
function Compliance({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const [editing, setEditing] = useState<ComplianceRecord | 'new' | null>(null);
  const { data, error, reload } = useLoad(() => listCompliance(db, c), [db, c]);
  const today = toLocal(new Date(), context.company.timeZone).date;
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={5} />;
  const rows = data.rows.filter((x) => x.status === 'active');
  const st = rows.map((x) => complianceStatus(x, today));
  return (
    <>
      <Banner tone="blue" title="Verified means evidenced">
        A record counts as valid only when it is marked verified with an
        evidence reference (certificate number, document location or link).
        Records without evidence are shown as “evidence pending”, never as
        compliant.
      </Banner>
      <Card title="Compliance & inspections">
        <Stats
          items={[
            ['Valid', st.filter((x) => x === 'valid').length, 'green'],
            [
              'Expiring ≤30 days',
              st.filter((x) => x === 'expiring').length,
              'amber',
            ],
            ['Expired', st.filter((x) => x === 'expired').length, 'red'],
            [
              'Evidence pending',
              st.filter((x) => x === 'evidence_pending').length,
            ],
          ]}
        />
        <div className="toolbar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Refresh"
            onClick={reload}
          >
            <RefreshCw />
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing('new')}
          >
            <Plus /> Add record
          </button>
        </div>
        {!rows.length ? (
          <Empty icon={ShieldCheck} title="No compliance records yet">
            Add certificates and statutory inspections with their expiry dates.
          </Empty>
        ) : (
          <Table
            head={[
              'Record',
              'Category',
              'Site',
              'Reference',
              'Expiry',
              'Status',
              '',
            ]}
            rows={rows
              .map((x, i) => ({ x, s: st[i] }))
              .sort((a, b) =>
                (a.x.expiryDate || '9999').localeCompare(
                  b.x.expiryDate || '9999',
                ),
              )
              .map(({ x, s }) => [
                <strong key="t">{x.title}</strong>,
                x.category,
                <Name key="n" context={context} kind="sites" id={x.siteId} />,
                x.reference || '—',
                x.expiryDate ? formatDate(x.expiryDate) : 'No expiry',
                <Pill key="p" tone={complianceTone[s]}>
                  {humanize(s)}
                </Pill>,
                <button
                  key="e"
                  type="button"
                  className="link-btn"
                  onClick={() => setEditing(x)}
                >
                  Edit
                </button>,
              ])}
          />
        )}
      </Card>
      {editing && (
        <ComplianceDrawer
          context={context}
          record={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
function ComplianceDrawer({
  context,
  record,
  onClose,
  onSaved,
}: {
  context: Context;
  record: ComplianceRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [v, setV] = useState<ComplianceInput>(() => {
    if (!record) return blankCompliance;
    const rest: Partial<ComplianceInput> = {};
    for (const k of Object.keys(blankCompliance) as (keyof ComplianceInput)[])
      (rest as Record<string, unknown>)[k] = record[k];
    return { ...blankCompliance, ...rest };
  });
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const db = context.services.db,
    c = context.company.companyId;
  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    setError('');
    try {
      await fn();
      toast(msg);
      onSaved();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  const text = (key: keyof ComplianceInput, label: string, type = 'text') => (
    <div className="field">
      <label htmlFor={`cmp-${key}`}>{label}</label>
      <input
        className="input"
        id={`cmp-${key}`}
        type={type}
        value={v[key] as string}
        onChange={(e) => setV({ ...v, [key]: e.target.value })}
      />
    </div>
  );
  return (
    <Drawer
      title={record ? 'Edit compliance record' : 'New compliance record'}
      icon={<FileCheck2 />}
      onClose={onClose}
      footer={
        <>
          {record && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() =>
                void run(
                  () => archiveCompliance(db, c, context.uid, record.id),
                  'Record archived',
                )
              }
            >
              Archive
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              void run(
                () => saveCompliance(db, c, context.uid, v, record?.id),
                'Record saved',
              )
            }
          >
            Save
          </button>
        </>
      }
    >
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <div className="form-grid">
        <div className="field wide">
          <label htmlFor="cmp-title">Title</label>
          <input
            className="input"
            id="cmp-title"
            value={v.title}
            onChange={(e) => setV({ ...v, title: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="cmp-cat">Category</label>
          <select
            className="select"
            id="cmp-cat"
            value={v.category}
            onChange={(e) => setV({ ...v, category: e.target.value })}
          >
            {complianceCategories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="cmp-site">
            Site
          </label>
          <Picker
            context={context}
            kind="sites"
            label="Site"
            inputId="cmp-site"
            value={v.siteId}
            onChange={(siteId) => setV({ ...v, siteId })}
          />
        </div>
        <div className="field wide">
          <label className="field-label" htmlFor="cmp-asset">
            Asset (optional)
          </label>
          <Picker
            context={context}
            kind="assets"
            label="Asset (optional)"
            inputId="cmp-asset"
            value={v.assetId}
            filter={v.siteId ? { key: 'siteId', value: v.siteId } : undefined}
            onChange={(assetId) => setV({ ...v, assetId })}
          />
        </div>
        {text('issuer', 'Issuer / inspector')}
        {text('reference', 'Certificate / report no.')}
        {text('issuedDate', 'Issued', 'date')}
        {text('expiryDate', 'Expires', 'date')}
        <div className="field wide">
          <label htmlFor="cmp-evidence">Evidence reference</label>
          <input
            className="input"
            id="cmp-evidence"
            placeholder="Document location, link or certificate number"
            value={v.evidenceRef}
            onChange={(e) => setV({ ...v, evidenceRef: e.target.value })}
          />
        </div>
        <label className="field wide check">
          <input
            type="checkbox"
            checked={v.verified}
            onChange={(e) => setV({ ...v, verified: e.target.checked })}
          />{' '}
          I have checked the evidence and it is genuine
        </label>
        <div className="field wide">
          <label htmlFor="cmp-notes">Notes</label>
          <textarea
            className="input"
            id="cmp-notes"
            value={v.notes}
            onChange={(e) => setV({ ...v, notes: e.target.value })}
          />
        </div>
      </div>
      {record?.verifiedAt && (
        <p className="muted small">
          Verified{' '}
          {formatInstant(record.verifiedAt.toDate(), context.company.timeZone)}
        </p>
      )}
    </Drawer>
  );
}
