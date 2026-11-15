import { useEffect, useState } from 'react';
import { Copy, Mail, Plus, ShieldCheck, ShieldOff } from 'lucide-react';
import {
  featureKeys,
  featureLabels,
  featureOn,
  limitKeys,
  limitLabels,
} from '@facilityos/shared';
import { formatInstant, type Context } from './context';
import { getUsage } from './usage';
import { readOnly } from './planGate';
import {
  companyInvoices,
  createInvitation,
  decideGrant,
  invitableRoles,
  inviteLink,
  listGrants,
  listInvitations,
  revokeInvitation,
  type Invitation,
  type SupportGrant,
} from './tenantSaas';
import {
  Banner,
  Drawer,
  Empty,
  Pill,
  Skeleton,
  StatusPill,
  friendly,
  humanize,
  useToast,
} from '../ui/kit';

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [v, setV] = useState(0);
  useEffect(() => {
    let live = true;
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
const ts = (v: unknown, tz: string) =>
  v && typeof (v as { toDate?: () => Date }).toDate === 'function'
    ? formatInstant((v as { toDate: () => Date }).toDate(), tz)
    : '—';

/* ============================================================ plan & usage */
export function PlanUsage({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId,
    tz = context.company.timeZone;
  const toast = useToast();
  const plan = context.company.plan;
  const { data, error, reload } = useLoad(
    async () => ({
      usage: await getUsage(db, c),
      invoices: await companyInvoices(db, c).catch(() => []),
      grants: await listGrants(db, c).catch(() => []),
    }),
    [db, c],
  );
  return (
    <>
      {readOnly(context) && (
        <Banner tone="amber" title="Read-only subscription">
          Your subscription is suspended or has ended. All data stays available
          to view and export, but nothing can be changed. Contact Sharaco to
          reactivate.
        </Banner>
      )}
      {!plan && (
        <Banner tone="blue" title="No plan assigned yet">
          This company has no SaaS plan on record, so no plan limits apply.
          Sharaco assigns plans from the platform console.
        </Banner>
      )}
      {error && <Banner tone="red">{error}</Banner>}
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>{plan ? plan.planName : 'Current plan'}</h2>
          {plan && <StatusPill value={plan.status} />}
        </div>
        {!data ? (
          <Skeleton rows={4} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Limit</th>
                  <th>Used</th>
                  <th>Allowed</th>
                  <th aria-label="Usage" />
                </tr>
              </thead>
              <tbody>
                {limitKeys.map((k) => {
                  const used = data.usage?.[k] ?? null;
                  const max = plan?.limits?.[k] ?? -1;
                  const pct =
                    used !== null && max > 0
                      ? Math.min(100, Math.round((used / max) * 100))
                      : 0;
                  return (
                    <tr key={k}>
                      <td>{limitLabels[k]}</td>
                      <td>{used ?? '—'}</td>
                      <td>{max < 0 ? 'Unlimited' : max}</td>
                      <td>
                        {max > 0 && used !== null && (
                          <span className="bar-track">
                            <span
                              className={`bar-fill tone-${pct >= 100 ? 'red' : pct >= 80 ? 'amber' : 'green'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">
          Usage counts go up as records are created. Archived records are
          removed from the count when Sharaco runs the usage reconciliation.
          Reaching a limit never blocks viewing or exporting existing data.
        </p>
        <div className="toolbar" style={{ flexWrap: 'wrap' }}>
          {featureKeys.map((f) => (
            <Pill
              key={f}
              tone={featureOn(plan?.features, f) ? 'green' : 'gray'}
              dot
            >
              {featureLabels[f]}
            </Pill>
          ))}
        </div>
      </section>
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>Billing history</h2>
        </div>
        {!data ? (
          <Skeleton rows={2} />
        ) : !data.invoices.length ? (
          <Empty title="No invoices on record">
            Online payment is not activated yet; Sharaco records invoices
            manually.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Period</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="cell-ref">{String(i.number || i.id)}</td>
                    <td>
                      {ts(i.periodStart, tz)} – {ts(i.periodEnd, tz)}
                    </td>
                    <td>
                      {String(i.currency || '')}{' '}
                      {Number(i.amount || 0).toLocaleString('en-GB', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <StatusPill value={String(i.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>Sharaco support access</h2>
        </div>
        <p className="muted small">
          Sharaco staff cannot see your operational data. If support needs to
          look at your setup, they request access here; approval is time-limited
          (max 72 hours) and covers only your setup summary and usage — never
          tasks, employees or customer records.
        </p>
        {!data ? null : !data.grants.length ? (
          <Empty title="No support requests" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.grants.map((g: SupportGrant) => (
                  <tr key={g.uid}>
                    <td>{ts(g.requestedAt, tz)}</td>
                    <td>{g.reason}</td>
                    <td>
                      <StatusPill value={g.status} />
                    </td>
                    <td>{g.expiresAt ? ts(g.expiresAt, tz) : '—'}</td>
                    <td>
                      {g.status === 'requested' && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() =>
                            decideGrant(db, c, context.uid, g.uid, true, 24)
                              .then(
                                () => (
                                  toast('Approved for 24 hours'),
                                  reload()
                                ),
                              )
                              .catch((e) => toast(friendly(e), 'red'))
                          }
                        >
                          <ShieldCheck /> Approve 24h
                        </button>
                      )}
                      {g.status !== 'revoked' && (
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() =>
                            decideGrant(db, c, context.uid, g.uid, false)
                              .then(() => (toast('Access revoked'), reload()))
                              .catch((e) => toast(friendly(e), 'red'))
                          }
                        >
                          <ShieldOff size={14} /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ============================================================ invitations */
export function Invitations({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId,
    tz = context.company.timeZone;
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [made, setMade] = useState<{ email: string; link: string } | null>(
    null,
  );
  const { data, error, reload } = useLoad(
    () => listInvitations(db, c),
    [db, c],
  );
  const owner = context.role === 'owner';
  return (
    <>
      <Banner tone="blue" title="How invitations work">
        Invite a person by email and role. They open the link, sign in or create
        an account with that same email, verify the address and accept.
        Membership is created only for that verified email — the link alone
        grants nothing. Email delivery is not automated yet: copy the link and
        send it yourself. After they join, link staff to their employee record
        (Staff access) and customers to their client (Customer access).
      </Banner>
      {made && (
        <Banner tone="green" title={`Invitation for ${made.email}`}>
          <code style={{ wordBreak: 'break-all' }}>{made.link}</code>{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              navigator.clipboard
                ?.writeText(made.link)
                .then(() => toast('Link copied'))
            }
          >
            <Copy size={14} /> Copy
          </button>
        </Banner>
      )}
      <section className="card card-pad rise">
        <div className="toolbar">
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={readOnly(context)}
            onClick={() => setCreating(true)}
          >
            <Plus /> Invite someone
          </button>
        </div>
        {error && <Banner tone="red">{error}</Banner>}
        {!data && !error && <Skeleton rows={3} />}
        {data && !data.length && (
          <Empty icon={Mail} title="No invitations yet" />
        )}
        {!!data?.length && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.map((i: Invitation) => {
                  const expired =
                    i.status === 'pending' &&
                    i.expiresAt.toMillis() < Date.now();
                  return (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td>{humanize(i.role)}</td>
                      <td>
                        {expired ? (
                          <Pill tone="gray">Expired</Pill>
                        ) : (
                          <StatusPill value={i.status} />
                        )}
                      </td>
                      <td>{ts(i.expiresAt, tz)}</td>
                      <td>
                        {i.status === 'pending' && !expired && (
                          <>
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() =>
                                navigator.clipboard
                                  ?.writeText(inviteLink(c, i.id))
                                  .then(() => toast('Link copied'))
                              }
                            >
                              Copy link
                            </button>{' '}
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() =>
                                revokeInvitation(db, c, i.id)
                                  .then(
                                    () => (
                                      toast('Invitation revoked'),
                                      reload()
                                    ),
                                  )
                                  .catch((e) => toast(friendly(e), 'red'))
                              }
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {creating && (
        <InviteDrawer
          owner={owner}
          onClose={() => setCreating(false)}
          onCreate={async (v) => {
            const r = await createInvitation(db, c, context.uid, v);
            setMade({ email: v.email, link: r.link });
            setCreating(false);
            reload();
          }}
        />
      )}
    </>
  );
}
function InviteDrawer({
  owner,
  onClose,
  onCreate,
}: {
  owner: boolean;
  onClose: () => void;
  onCreate: (v: {
    email: string;
    role: string;
    siteIds: string[];
    note: string;
    days: number;
  }) => Promise<void>;
}) {
  const [v, setV] = useState({ email: '', role: 'staff', note: '', days: 7 });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Drawer
      title="Invite someone"
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
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await onCreate({ ...v, siteIds: [] });
              } catch (e) {
                setError(friendly(e));
                setBusy(false);
              }
            }}
          >
            Create invitation
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
          <label htmlFor="inv-email">Email</label>
          <input
            id="inv-email"
            className="input"
            type="email"
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="inv-role">Role</label>
          <select
            id="inv-role"
            className="select"
            value={v.role}
            onChange={(e) => setV({ ...v, role: e.target.value })}
          >
            {invitableRoles
              .filter((r) => r !== 'admin' || owner)
              .map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
          </select>
          <span className="help">
            Only the owner can invite admins. Owners are provisioned by Sharaco.
          </span>
        </div>
        <div className="field">
          <label htmlFor="inv-days">Expires after (days)</label>
          <input
            id="inv-days"
            className="input"
            type="number"
            min={1}
            max={14}
            value={v.days}
            onChange={(e) => setV({ ...v, days: Number(e.target.value) })}
          />
        </div>
        <div className="field wide">
          <label htmlFor="inv-note">Note (optional)</label>
          <input
            id="inv-note"
            className="input"
            maxLength={300}
            value={v.note}
            onChange={(e) => setV({ ...v, note: e.target.value })}
          />
        </div>
      </div>
    </Drawer>
  );
}
