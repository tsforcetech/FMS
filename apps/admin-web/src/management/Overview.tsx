import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection,
  getCountFromServer,
  query,
  where,
  type Query,
} from 'firebase/firestore';
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Zap,
  Building2,
  CalendarCheck,
  Search,
  CornerDownLeft,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { definitions, type Kind } from '@facilityos/shared';
import { greeting, type Context } from './context';
import { kindIcons } from './Records';
import { pages } from '../nav';
import { IconCircle, Pill, Skeleton, type Tone } from '../ui/kit';

type Counts = Partial<
  Record<Kind | 'stockBalances' | 'legacySites', number | null>
>;
const counted: Kind[] = [
  'sites',
  'locations',
  'facilities',
  'clients',
  'contracts',
  'contractAllocations',
  'employees',
  'departments',
  'teams',
  'shifts',
  'assets',
  'materials',
  'stores',
];
function useCounts(context: Context) {
  const [counts, setCounts] = useState<Counts>();
  useEffect(() => {
    let live = true;
    const db = context.services.db,
      c = context.company.companyId;
    const count = (q: Query) =>
      getCountFromServer(q)
        .then((r) => r.data().count)
        .catch(() => null);
    Promise.all([
      ...counted.map(
        async (k) =>
          [k, await count(collection(db, 'companies', c, k))] as const,
      ),
      (async () =>
        [
          'stockBalances',
          await count(collection(db, 'companies', c, 'stockBalances')),
        ] as const)(),
      (async () =>
        [
          'legacySites',
          await count(
            query(
              collection(db, 'companies', c, 'sites'),
              where('schemaVersion', '==', 1),
            ),
          ),
        ] as const)(),
    ]).then((r) => live && setCounts(Object.fromEntries(r)));
    return () => {
      live = false;
    };
  }, [context]);
  return counts;
}
type Step = {
  title: string;
  detail: string;
  done: boolean;
  to: string;
  kind: Kind;
  count: number | null | undefined;
};
type Insight = {
  tone: Tone;
  badge: string;
  confidence: string;
  title: string;
  reason: string;
  to: string;
  cta: string;
  icon: typeof Building2;
};

export function Overview({
  context,
  name,
}: {
  context: Context;
  name: string;
}) {
  const counts = useCounts(context);
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const n = (k: keyof Counts) => counts?.[k] ?? 0;
  const steps: Step[] = [
    {
      title: 'Add your sites',
      detail: 'Physical properties you manage',
      kind: 'sites',
      to: '/sites',
    },
    {
      title: 'Map locations',
      detail: 'Buildings, floors and rooms',
      kind: 'locations',
      to: '/locations',
    },
    {
      title: 'Register clients & contracts',
      detail: 'Who you serve and on what terms',
      kind: 'contracts',
      to: '/contracts',
    },
    {
      title: 'Build your team directory',
      detail: 'Employees, departments and shifts',
      kind: 'employees',
      to: '/employees',
    },
    {
      title: 'Register assets',
      detail: 'Equipment, furniture and fixtures',
      kind: 'assets',
      to: '/assets',
    },
    {
      title: 'Set up stores & materials',
      detail: 'Stock locations and consumables',
      kind: 'stores',
      to: '/stores',
    },
  ].map((s) => ({
    ...s,
    kind: s.kind as Kind,
    count: counts?.[s.kind as Kind],
    done: (counts?.[s.kind as Kind] ?? 0) > 0,
  }));
  const stepsKnown = steps.filter((s) => s.count !== null);
  const score = stepsKnown.length
    ? Math.round(
        (stepsKnown.filter((s) => s.done).length / stepsKnown.length) * 100,
      )
    : 0;
  const insights = useMemo(() => {
    const list: Insight[] = [];
    if (!counts) return list;
    if ((counts.legacySites ?? 0) > 0)
      list.push({
        tone: 'amber',
        badge: 'Review needed',
        confidence: 'Data quality',
        title: `${counts.legacySites} site${counts.legacySites === 1 ? '' : 's'} still carry legacy client links`,
        reason:
          'These sites were created before clients moved to contract allocations. Their links are preserved until the reviewed migration runs.',
        to: '/sites',
        cta: 'Review sites',
        icon: Building2,
      });
    if (!n('sites'))
      list.push({
        tone: 'red',
        badge: 'Start here',
        confidence: 'Setup',
        title: 'Add your first physical site',
        reason:
          'Sites anchor everything else: locations, facilities, assets, stores and staff assignments.',
        to: '/sites',
        cta: 'Add a site',
        icon: Building2,
      });
    else if (!n('locations'))
      list.push({
        tone: 'red',
        badge: 'Next step',
        confidence: 'Setup',
        title: 'Map the locations inside your sites',
        reason:
          'Assets, facilities and stores are placed at specific buildings, floors or rooms.',
        to: '/locations',
        cta: 'Add locations',
        icon: kindIcons.locations,
      });
    if (counts.employees === 0)
      list.push({
        tone: 'blue',
        badge: 'People',
        confidence: 'Recommended',
        title: 'Build your team directory',
        reason:
          'Add departments, designations and employees so shifts, custodians and teams can be assigned.',
        to: '/employees',
        cta: 'Add employees',
        icon: kindIcons.employees,
      });
    if (counts.materials && counts.stockBalances === 0)
      list.push({
        tone: 'blue',
        badge: 'Inventory',
        confidence: 'Recommended',
        title: 'Record opening stock',
        reason: `You have ${counts.materials} material${counts.materials === 1 ? '' : 's'} but no balances yet. Opening stock starts the movement ledger.`,
        to: '/stock-transactions',
        cta: 'Post opening stock',
        icon: kindIcons.materials,
      });
    if (counts.assets === 0 && n('locations'))
      list.push({
        tone: 'blue',
        badge: 'Assets',
        confidence: 'Recommended',
        title: 'Register equipment and furniture',
        reason:
          'Track condition, custodians, transfers and QR labels for every asset.',
        to: '/assets',
        cta: 'Register assets',
        icon: kindIcons.assets,
      });
    if (!list.length)
      list.push({
        tone: 'green',
        badge: 'All set',
        confidence: 'Healthy',
        title: 'Your workspace is fully set up',
        reason:
          'Sites, people, assets and inventory are all in place. Operations modules arrive in the next phase.',
        to: '/assets',
        cta: 'Open asset register',
        icon: Sparkles,
      });
    return list.slice(0, 3);
  }, [counts]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (insights.length < 2) return;
    const t = setInterval(
      () => setSlide((s) => (s + 1) % insights.length),
      7000,
    );
    return () => clearInterval(t);
  }, [insights.length]);
  const current = insights[Math.min(slide, insights.length - 1)];
  const queue = steps.filter((s) => !s.done && s.count !== null).slice(0, 3);
  return (
    <>
      <header className="page-head">
        <div>
          <h1>
            {greeting(context.company.timeZone)}, {name.split(' ')[0]}{' '}
            <span aria-hidden>👋</span>
          </h1>
          <p>
            Here is what needs attention across {context.company.name} today.
          </p>
        </div>
      </header>
      <h2 className="sr-only">Your company workspace</h2>
      <div className="dash-grid">
        <div className="dash-col">
          <section
            className="card card-pad hero rise"
            aria-roledescription="carousel"
            aria-label="Priorities"
          >
            {!counts ? (
              <Skeleton rows={2} />
            ) : (
              current && (
                <div className="hero-slide" key={slide}>
                  <div className="hero-top">
                    <div className="hero-badges">
                      <Pill tone={current.tone}>{current.badge}</Pill>
                      <span className="divider" aria-hidden />
                      <Pill tone="green" dot>
                        {current.confidence}
                      </Pill>
                    </div>
                  </div>
                  <div className="hero-title">
                    <IconCircle icon={current.icon} tone={current.tone} />
                    {current.title}
                  </div>
                  <p>
                    <strong>Why: </strong>
                    {current.reason}
                  </p>
                  <div className="page-actions hero-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() =>
                        document
                          .getElementById('setup-queue')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => navigate(current.to)}
                    >
                      <Zap />
                      {current.cta}
                    </button>
                  </div>
                </div>
              )
            )}
            {insights.length > 1 && (
              <div className="dots" role="tablist" aria-label="Choose priority">
                {insights.map((x, i) => (
                  <button
                    key={x.title}
                    type="button"
                    aria-label={`Priority ${i + 1}`}
                    aria-current={i === slide}
                    onClick={() => setSlide(i)}
                  />
                ))}
              </div>
            )}
          </section>
          <section
            id="setup-queue"
            className="card card-pad rise"
            style={{ ['--i' as string]: 1 }}
          >
            <div className="card-head">
              <div className="title">
                <h2>Setup queue</h2>
                <span className="count-chip">{queue.length} remaining</span>
              </div>
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/sites')}
              >
                View all <ArrowRight />
              </button>
            </div>
            <div className="queue">
              {!counts && <Skeleton rows={3} />}
              {counts &&
                (queue.length ? queue : steps.slice(0, 3)).map((s, i) => (
                  <div className="queue-row" key={s.title}>
                    <IconCircle
                      icon={kindIcons[s.kind]}
                      tone={s.done ? 'green' : i === 0 ? 'blue' : 'gray'}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="t">{s.title}</div>
                      <div className="s">
                        <Building2 />
                        {s.detail}
                      </div>
                    </div>
                    <div className="queue-meta">
                      <CalendarCheck />
                      {s.count ?? 0} {definitions[s.kind].title.toLowerCase()}
                    </div>
                    <span className="hide-sm">
                      {s.done ? (
                        <Pill tone="green">Done</Pill>
                      ) : i === 0 ? (
                        <Pill tone="red">Next</Pill>
                      ) : (
                        <Pill tone="amber">Pending</Pill>
                      )}
                    </span>
                    <button
                      type="button"
                      className="icon-btn sm"
                      aria-label={`Open ${s.title}`}
                      onClick={() => navigate(s.to)}
                    >
                      <ArrowUpRight />
                    </button>
                  </div>
                ))}
            </div>
          </section>
          <div
            className="dash-grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            }}
          >
            <section
              className="card card-pad rise"
              style={{ ['--i' as string]: 2 }}
            >
              <div className="card-head">
                <h2>Records overview</h2>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => navigate('/assets')}
                >
                  Explore <ArrowRight />
                </button>
              </div>
              {!counts ? (
                <Skeleton rows={2} />
              ) : (
                <div className="stat-grid">
                  {counted
                    .filter((k) => counts[k] !== null)
                    .slice(0, 8)
                    .map((k) => {
                      const Icon = kindIcons[k];
                      const page = pages.find((p) => p.kinds?.[0] === k);
                      return (
                        <Link
                          key={k}
                          className="stat"
                          to={'/' + (page?.id || '')}
                        >
                          <Icon size={18} color="var(--blue)" />
                          <strong>{counts[k]}</strong>
                          <span>{definitions[k].title}</span>
                        </Link>
                      );
                    })}
                </div>
              )}
            </section>
            <section
              className="card card-pad rise"
              style={{ ['--i' as string]: 3 }}
            >
              <div className="card-head">
                <h2>Workspace pulse</h2>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => navigate('/company')}
                >
                  Settings <ArrowRight />
                </button>
              </div>
              <div className="pulse">
                <div>
                  <small>Setup progress</small>
                  <div className="big">
                    {score >= 80
                      ? 'On track'
                      : score >= 40
                        ? 'Building up'
                        : 'Getting started'}{' '}
                    {score >= 80 ? '👍' : '🚀'}
                  </div>
                  <small>
                    {stepsKnown.filter((s) => s.done).length} of{' '}
                    {stepsKnown.length} areas configured
                  </small>
                </div>
                <Gauge value={score} />
              </div>
              <ul
                className="queue"
                style={{ listStyle: 'none', padding: 0, margin: '14px 0 0' }}
              >
                {steps.map((s) => (
                  <li
                    key={s.title}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 13.5,
                    }}
                  >
                    {s.done ? (
                      <CheckCircle2 size={17} color="var(--green)" />
                    ) : (
                      <Circle size={17} color="var(--muted)" />
                    )}
                    <span
                      style={{ color: s.done ? 'var(--ink)' : 'var(--ink-3)' }}
                    >
                      {s.title}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <section
            className="card card-pad rise"
            style={{ ['--i' as string]: 4 }}
          >
            <IconCircle icon={Building2} tone="blue" />
            <h2 style={{ marginTop: 12 }}>{context.company.name}</h2>
            <p className="muted" style={{ marginTop: 4 }}>
              {context.company.companyId} · {context.company.timeZone} ·{' '}
              {context.role === 'owner' ? 'Company owner' : 'Company admin'}
            </p>
          </section>
        </div>
        <QuickActions name={name} />
      </div>
    </>
  );
}
function Gauge({ value }: { value: number }) {
  const segs = 24;
  const lit = Math.round((value / 100) * segs);
  return (
    <div className="gauge" role="img" aria-label={`Setup ${value}%`}>
      <svg viewBox="0 0 150 84">
        {Array.from({ length: segs }, (_, i) => {
          const a = Math.PI - (i / (segs - 1)) * Math.PI;
          const x1 = 75 + Math.cos(a) * 52,
            y1 = 78 - Math.sin(a) * 52,
            x2 = 75 + Math.cos(a) * 70,
            y2 = 78 - Math.sin(a) * 70;
          return (
            <line
              key={i}
              className="seg"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#fff"
              strokeWidth="5"
              strokeLinecap="round"
              opacity={i < lit ? 1 : 0.3}
              style={{ transitionDelay: `${i * 25}ms` }}
            />
          );
        })}
      </svg>
      <div className="gauge-value">
        <strong>{value}%</strong>
        <small>Setup score</small>
      </div>
    </div>
  );
}
function QuickActions({ name }: { name: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const available = pages.filter((p) => !p.phase && p.id);
  const matches = q.trim()
    ? available.filter((p) =>
        (p.label + ' ' + p.group.label).toLowerCase().includes(q.toLowerCase()),
      )
    : [];
  const suggestions = [
    { label: 'Add a new site', to: '/sites' },
    { label: 'Register an asset', to: '/assets' },
    { label: 'Post a stock receipt', to: '/stock-transactions' },
    { label: 'Add an employee', to: '/employees' },
  ];
  return (
    <aside
      className="card assistant rise"
      style={{ ['--i' as string]: 1 }}
      aria-label="Quick actions"
    >
      <div className="assistant-head">
        <Sparkles size={20} color="var(--blue)" />
        <strong>Quick actions</strong>
      </div>
      <div className="assistant-hero">
        <h2>
          What would you
          <br />
          like to do, <b>{name.split(' ')[0]}?</b>
        </h2>
        <p>Jump to any module or start a common task.</p>
      </div>
      <div className="suggestions">
        {(matches.length
          ? matches
              .slice(0, 6)
              .map((p) => ({ label: p.label, to: '/' + p.id, icon: p.icon }))
          : suggestions.map((s) => ({ ...s, icon: ArrowRight }))
        ).map((s) => (
          <button
            type="button"
            key={s.label}
            className="suggestion"
            onClick={() => navigate(s.to)}
          >
            <s.icon />
            {s.label}
          </button>
        ))}
        {q && !matches.length && (
          <p className="muted small" style={{ textAlign: 'center' }}>
            No module matches “{q}”.
          </p>
        )}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (matches[0]) navigate('/' + matches[0].id);
        }}
      >
        <input
          aria-label="Find a module"
          placeholder="Search modules, e.g. stores…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="composer-row">
          <span
            className="muted small"
            style={{ display: 'flex', gap: 6, alignItems: 'center' }}
          >
            <Search size={14} /> Type to search
          </span>
          <button className="btn btn-dark btn-sm" disabled={!matches.length}>
            Go <CornerDownLeft />
          </button>
        </div>
      </form>
    </aside>
  );
}
