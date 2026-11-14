import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { Save, ShieldCheck, KeyRound, Building2, Lock } from 'lucide-react';
import {
  companySchema,
  timeZones,
  permissionAreas,
  rolePermissions,
} from '@facilityos/shared';
import { listMembers } from './store';
import { formatInstant, type Context } from './context';
import {
  Avatar,
  Banner,
  Empty,
  IconCircle,
  Pill,
  Skeleton,
  StatusPill,
  friendly,
  humanize,
  useToast,
} from '../ui/kit';

export function CompanySettings({ context }: { context: Context }) {
  const c = context.company;
  const start = {
    name: c.name,
    timeZone: c.timeZone,
    contactEmail: c.contactEmail || '',
    contactPhone: c.contactPhone || '',
    address: c.address || '',
    country: c.country || '',
  };
  const [v, setV] = useState(start),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  const id = useId();
  const dirty = JSON.stringify(v) !== JSON.stringify(start);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      companySchema.parse({ ...c, ...v });
      await updateDoc(doc(context.services.db, 'companies', c.companyId), {
        ...v,
        updatedAt: serverTimestamp(),
        updatedBy: context.uid,
      });
      toast('Company profile saved.');
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  const field = (
    key: keyof typeof v,
    label: string,
    type = 'text',
    wide = false,
  ) => (
    <div className={'field ' + (wide ? 'wide' : '')}>
      <label htmlFor={id + key}>{label}</label>
      {key === 'timeZone' ? (
        <select
          id={id + key}
          className="input"
          value={v.timeZone}
          onChange={(e) => setV({ ...v, timeZone: e.target.value })}
        >
          {timeZones.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
      ) : key === 'address' ? (
        <textarea
          id={id + key}
          className="input"
          rows={3}
          value={v[key]}
          onChange={(e) => setV({ ...v, [key]: e.target.value })}
        />
      ) : (
        <input
          id={id + key}
          className="input"
          type={type}
          value={v[key]}
          onChange={(e) => setV({ ...v, [key]: e.target.value })}
        />
      )}
    </div>
  );
  return (
    <div className="dash-grid">
      <section className="card card-pad rise">
        <form onSubmit={(e) => void submit(e)}>
          <section className="form-section">
            <h3>
              <span className="num">1</span>Company profile
            </h3>
            <div className="form-grid">
              {field('name', 'Company name')}
              {field('timeZone', 'Time zone')}
            </div>
          </section>
          <section className="form-section">
            <h3>
              <span className="num">2</span>Contact
            </h3>
            <div className="form-grid">
              {field('contactEmail', 'Contact email', 'email')}
              {field('contactPhone', 'Contact phone')}
              {field('country', 'Country')}
              {field('address', 'Address', 'text', true)}
            </div>
          </section>
          {error && (
            <Banner tone="red" role="alert">
              {error}
            </Banner>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="btn btn-outline"
              disabled={!dirty || busy}
              onClick={() => setV(start)}
            >
              Discard changes
            </button>
            <button className="btn btn-primary" disabled={!dirty || busy}>
              <Save />
              {busy ? 'Saving…' : 'Save company profile'}
            </button>
          </div>
        </form>
      </section>
      <aside className="card card-pad rise" style={{ ['--i' as string]: 1 }}>
        <IconCircle icon={Building2} tone="blue" size="lg" />
        <h2 style={{ marginTop: 14 }}>{c.name}</h2>
        <dl
          className="facts"
          style={{ marginTop: 16, gridTemplateColumns: '1fr' }}
        >
          <div className="fact">
            <dt>Company ID</dt>
            <dd>{c.companyId}</dd>
          </div>
          <div className="fact">
            <dt>Status</dt>
            <dd>
              <StatusPill value={c.status} />
            </dd>
          </div>
          <div className="fact">
            <dt>Created</dt>
            <dd>{formatInstant(c.createdAt.toDate())}</dd>
          </div>
        </dl>
        <p className="muted small" style={{ marginTop: 14 }}>
          Company ID, status, billing and owner membership are managed by the
          trusted system operator and cannot be changed here.
        </p>
      </aside>
    </div>
  );
}

export function RolesPage() {
  const roles = Object.entries(rolePermissions);
  return (
    <section className="card card-pad rise">
      <Banner tone="blue" title="How access works">
        Owners and administrators manage the whole company today, and every
        change is checked by the database security rules, not only the screen.
        The other roles are the prepared site- and department-scoped model; they
        stay without portal access until their permissions are tested and
        released. Roles are granted only by trusted provisioning, so nobody can
        promote themselves.
      </Banner>
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="data matrix">
          <thead>
            <tr>
              <th>Role</th>
              <th>Scope</th>
              {permissionAreas.map((a) => (
                <th key={a}>{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map(([role, p], i) => (
              <tr key={role} style={{ ['--i' as string]: i }}>
                <td>
                  <div className="cell-main" style={{ minWidth: 180 }}>
                    <span
                      className={`icon-circle tone-${p.enforced ? 'green' : 'gray'}`}
                      style={{ width: 34, height: 34 }}
                    >
                      {p.enforced ? (
                        <ShieldCheck size={16} />
                      ) : (
                        <Lock size={16} />
                      )}
                    </span>
                    <div>
                      <div className="t">{humanize(role)}</div>
                      <div className="s">
                        {p.enforced ? 'Active' : 'Prepared'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="muted">{p.scope}</td>
                {permissionAreas.map((a) => (
                  <td key={a}>
                    {p.access[a] ? (
                      <Pill
                        tone={
                          p.enforced
                            ? p.access[a] === 'Manage'
                              ? 'green'
                              : 'blue'
                            : 'gray'
                        }
                      >
                        {p.access[a]}
                      </Pill>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type Member = Awaited<ReturnType<typeof listMembers>>[number];
export function AccessPage({ context }: { context: Context }) {
  const [rows, setRows] = useState<Member[]>(),
    [names, setNames] = useState<Record<string, string>>({}),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    listMembers(context.services.db, context.company.companyId)
      .then(async (m) => {
        if (!live) return;
        setRows(m);
        const found: Record<string, string> = {};
        await Promise.all(
          m.map(async (x) => {
            try {
              const r = await getDocs(
                query(
                  collection(
                    context.services.db,
                    'companies',
                    context.company.companyId,
                    'employees',
                  ),
                  where('linkedUid', '==', x.uid),
                  limit(1),
                ),
              );
              if (r.docs[0]) found[x.uid] = String(r.docs[0].data().name);
            } catch {
              /* employee directory not yet available */
            }
          }),
        );
        if (live) setNames(found);
      })
      .catch(
        (e) =>
          live &&
          setError(
            String((e as { code?: string }).code).includes('permission')
              ? 'Member listing will be available once the latest database rules are published.'
              : friendly(e),
          ),
      );
    return () => {
      live = false;
    };
  }, [context]);
  return (
    <section className="card card-pad rise">
      <Banner tone="blue" title="Accounts are provisioned securely">
        Sign-in accounts and roles are created by the trusted operator
        procedure, never from this browser. Link an account to an employee
        record from the employee form; the link is informational and grants no
        access.
      </Banner>
      <div style={{ height: 12 }} />
      {error && <Banner tone="amber">{error}</Banner>}
      {!rows && !error && <Skeleton rows={3} />}
      {rows && !rows.length && (
        <Empty icon={KeyRound} title="No members found" />
      )}
      {rows && rows.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Status</th>
                <th>Linked employee</th>
                <th>Last change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={m.uid} style={{ ['--i' as string]: i }}>
                  <td>
                    <div className="cell-main">
                      <Avatar name={names[m.uid] || m.uid} />
                      <div>
                        <div className="t">{names[m.uid] || 'Account'}</div>
                        <div className="s">
                          <span className="code-chip">
                            {m.uid.slice(0, 12)}
                          </span>
                          {m.uid === context.uid && (
                            <Pill tone="blue">You</Pill>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Pill
                      tone={
                        ['owner', 'admin'].includes(m.role) ? 'violet' : 'gray'
                      }
                    >
                      {humanize(m.role)}
                    </Pill>
                  </td>
                  <td>
                    <StatusPill value={m.status} />
                  </td>
                  <td className="muted">{names[m.uid] || 'Not linked'}</td>
                  <td className="muted small">
                    {m.updatedAt?.toDate
                      ? formatInstant(m.updatedAt.toDate())
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
