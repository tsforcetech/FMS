import { useEffect, useState } from 'react';
import {
  Link2,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UserCog,
} from 'lucide-react';
import {
  linkStaff,
  listLinkableMembers,
  listStaffLinks,
  staffRoleLabels,
  supervisorRoles,
  updateStaffScope,
  type StaffLink,
} from './staffStore';
import { recordById, saveRecord } from './store';
import { formatInstant, type Context } from './context';
import { Picker } from './Picker';
import { Name } from './Tasks';
import {
  Banner,
  ConfirmDialog,
  Drawer,
  Empty,
  IconCircle,
  Pill,
  Skeleton,
  friendly,
  useToast,
} from '../ui/kit';

/**
 * Staff access: links a provisioned login (company membership) to exactly
 * one employee and sets the sites the person may work in. Roles themselves are
 * provisioned by the trusted operator; nothing here can grant owner/admin.
 */
export function StaffAccessPage({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const [links, setLinks] = useState<StaffLink[]>(),
    [members, setMembers] = useState<{ uid: string; role: string }[]>([]),
    [error, setError] = useState(''),
    [editing, setEditing] = useState<StaffLink | 'new' | null>(null),
    [confirm, setConfirm] = useState<StaffLink | null>(null),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  const toast = useToast();
  useEffect(() => {
    let live = true;
    Promise.all([listStaffLinks(db, c), listLinkableMembers(db, c)])
      .then(([l, m]) => {
        if (!live) return;
        setLinks(l.sort((a, b) => a.status.localeCompare(b.status)));
        setMembers(m);
      })
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c, version]);
  const roleOf = (uid: string) =>
    members.find((m) => m.uid === uid)?.role || '';
  return (
    <>
      <Banner tone="blue" title="How staff sign in">
        1) The trusted operator creates the person’s login and company
        membership with a staff role (<code>scripts/provision-staff.mjs</code>).
        2) Link that login to the employee here and choose their sites. Staff
        then use the staff portal at <strong>/staff/</strong>. Staff never
        choose their own identity, and linking never grants admin access.
      </Banner>
      <section className="card card-pad rise">
        <div className="toolbar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Refresh"
            onClick={() => setVersion((v) => v + 1)}
          >
            <RefreshCw />
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing('new')}
          >
            <Plus /> Link a login
          </button>
        </div>
        {error && <Banner tone="red">{error}</Banner>}
        {!links && !error && <Skeleton rows={3} />}
        {links && !links.length && (
          <Empty icon={Link2} title="No staff logins linked yet">
            Link a provisioned login to an employee so they can use the staff
            portal.
          </Empty>
        )}
        {!!links?.length && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Login</th>
                  <th>Role</th>
                  <th>Sites</th>
                  <th>Updated</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.uid}>
                    <td className="cell-ref">
                      <Name
                        context={context}
                        kind="employees"
                        id={l.employeeId}
                      />
                    </td>
                    <td>
                      <span className="code-chip">{l.uid.slice(0, 10)}</span>
                    </td>
                    <td className="small">
                      {staffRoleLabels[roleOf(l.uid)] || roleOf(l.uid) || '—'}
                    </td>
                    <td className="small">
                      {l.allSites
                        ? 'All sites'
                        : l.siteIds.map((s, i) => (
                            <span key={s}>
                              {i ? ', ' : ''}
                              <Name context={context} kind="sites" id={s} />
                            </span>
                          ))}
                    </td>
                    <td className="small">
                      {l.updatedAt ? formatInstant(l.updatedAt.toDate()) : '—'}
                    </td>
                    <td>
                      <Pill tone={l.status === 'active' ? 'green' : 'gray'} dot>
                        {l.status === 'active' ? 'Active' : 'Revoked'}
                      </Pill>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setEditing(l)}
                        >
                          <UserCog /> Scope
                        </button>
                        {l.status === 'active' ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setConfirm(l)}
                          >
                            <ShieldOff /> Revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await updateStaffScope(db, c, context.uid, l, {
                                  status: 'active',
                                });
                                toast('Access restored.');
                                setVersion((v) => v + 1);
                              } catch (e) {
                                setError(friendly(e));
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            <ShieldCheck /> Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <LinkDrawer
          context={context}
          link={editing === 'new' ? null : editing}
          members={members.filter(
            (m) => editing !== 'new' || !links?.some((l) => l.uid === m.uid),
          )}
          onClose={(changed) => {
            setEditing(null);
            if (changed) setVersion((v) => v + 1);
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title="Revoke staff access?"
          confirmLabel="Revoke"
          tone="red"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await updateStaffScope(db, c, context.uid, confirm, {
                status: 'revoked',
              });
              toast(
                'Access revoked. The person can no longer open tasks or records.',
              );
              setVersion((v) => v + 1);
            } catch (e) {
              setError(friendly(e));
            } finally {
              setBusy(false);
              setConfirm(null);
            }
          }}
        >
          The login keeps its history but loses all staff portal access
          immediately. You can restore it later or link the employee to a
          different login.
        </ConfirmDialog>
      )}
    </>
  );
}

function LinkDrawer({
  context,
  link,
  members,
  onClose,
}: {
  context: Context;
  link: StaffLink | null;
  members: { uid: string; role: string }[];
  onClose: (changed: boolean) => void;
}) {
  const db = context.services.db,
    c = context.company.companyId;
  const [uid, setUid] = useState(link?.uid || ''),
    [employeeId, setEmployeeId] = useState(link?.employeeId || ''),
    [siteIds, setSiteIds] = useState<string[]>(link?.siteIds || []),
    [allSites, setAllSites] = useState(link?.allSites || false),
    [pick, setPick] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  const role = members.find((m) => m.uid === uid)?.role || '';
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (link)
        await updateStaffScope(db, c, context.uid, link, { siteIds, allSites });
      else {
        await linkStaff(db, c, context.uid, {
          uid,
          employeeId,
          siteIds,
          allSites,
        });
        // Keep the employee record's informational login reference in step (used to route notifications).
        const e = await recordById(db, c, 'employees', employeeId);
        if (e && e.values.linkedUid !== uid && /^[a-zA-Z0-9]+$/.test(uid))
          await saveRecord(
            db,
            c,
            context.uid,
            'employees',
            { ...e.values, linkedUid: uid },
            e,
          ).catch(() => undefined);
      }
      toast(link ? 'Scope updated.' : 'Login linked to the employee.');
      onClose(true);
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  }
  return (
    <Drawer
      title={link ? 'Staff scope' : 'Link a login to an employee'}
      subtitle="Staff see only tasks assigned to them; supervisors and site managers also see work in these sites."
      icon={<IconCircle icon={Link2} tone="blue" />}
      onClose={() => !busy && onClose(false)}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => onClose(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || (!link && (!uid || !employeeId))}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : link ? 'Save scope' : 'Link login'}
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
        {!link && (
          <div className="field wide">
            <label htmlFor="staff-login">Login (company member)</label>
            <select
              id="staff-login"
              className="select"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
            >
              <option value="">Choose a provisioned login</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.uid} · {staffRoleLabels[m.role] || m.role}
                </option>
              ))}
            </select>
            <span className="small muted">
              Only active members created by trusted provisioning are listed.
              Logins already linked are hidden.
            </span>
          </div>
        )}
        {!link && (
          <div className="field wide">
            <span className="field-label">Employee</span>
            <Picker
              context={context}
              kind="employees"
              label="Employee"
              value={employeeId}
              onChange={setEmployeeId}
            />
          </div>
        )}
        {role && (
          <div className="field wide">
            <Pill tone={supervisorRoles.includes(role) ? 'violet' : 'blue'}>
              {staffRoleLabels[role] || role}
            </Pill>
          </div>
        )}
        <label className="toggle wide">
          <input
            type="checkbox"
            checked={allSites}
            onChange={(e) => setAllSites(e.target.checked)}
          />
          All sites of the company
        </label>
        {!allSites && (
          <div className="field wide">
            <span className="field-label">Sites (up to 10)</span>
            <div className="chips">
              {siteIds.map((s) => (
                <span key={s} className="pill tone-blue">
                  <Name context={context} kind="sites" id={s} />
                  <button
                    type="button"
                    className="chip-x"
                    aria-label="Remove site"
                    onClick={() => setSiteIds(siteIds.filter((x) => x !== s))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            {siteIds.length < 10 && (
              <Picker
                context={context}
                kind="sites"
                label="Add site"
                value={pick}
                onChange={(x) => {
                  if (x && !siteIds.includes(x)) setSiteIds([...siteIds, x]);
                  setPick('');
                }}
              />
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
