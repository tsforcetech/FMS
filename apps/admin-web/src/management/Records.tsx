import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import {
  ArrowLeft,
  Archive,
  ArrowLeftRight,
  ChevronRight,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Save,
  FolderPlus,
  type LucideIcon,
  Building2,
  MapPin,
  Waves,
  Shapes,
  Handshake,
  FileSignature,
  Link2,
  Users,
  Network,
  BadgeCheck,
  UsersRound,
  Clock3,
  CalendarOff,
  CalendarDays,
  Boxes,
  FolderTree,
  Truck,
  Package,
  Tags,
  Warehouse,
  UserCheck,
  MapPinned,
  CalendarClock,
  AlertCircle,
} from 'lucide-react';
import {
  definitions,
  fieldsFor,
  statuses,
  defaultValues,
  inputSchema,
  isAssignment,
  isPhase2,
  weekDays,
  units,
  type FieldSpec,
  type Kind,
  type Values,
  type Operation,
} from '@facilityos/shared';
import {
  listRecords,
  saveRecord,
  listSubcollection,
  recordById,
} from './store';
import {
  clearLabelCache,
  formatDate,
  formatInstant,
  useDebounced,
  useLabel,
  type Context,
} from './context';
import { Picker } from './Picker';
import {
  Banner,
  ConfirmDialog,
  Drawer,
  Empty,
  IconCircle,
  Pill,
  Segmented,
  Skeleton,
  StatusPill,
  Tabs,
  friendly,
  humanize,
  toneFor,
  useToast,
  type Tone,
} from '../ui/kit';
import {
  TransferDrawer,
  QrDialog,
  TransferHistory,
  StockForRecord,
} from './Assets';

export const kindIcons: Record<Kind, LucideIcon> = {
  clients: Handshake,
  contracts: FileSignature,
  sites: Building2,
  contractAllocations: Link2,
  locations: MapPin,
  facilityTypes: Shapes,
  facilities: Waves,
  departments: Network,
  designations: BadgeCheck,
  employees: Users,
  teams: UsersRound,
  teamMembers: UserCheck,
  siteAssignments: MapPinned,
  shifts: Clock3,
  shiftAssignments: CalendarClock,
  holidays: CalendarDays,
  leaveRecords: CalendarOff,
  assetCategories: FolderTree,
  suppliers: Truck,
  assets: Boxes,
  materialCategories: Tags,
  materials: Package,
  stores: Warehouse,
};
const kindTone: Partial<Record<Kind, Tone>> = {
  clients: 'violet',
  contracts: 'violet',
  contractAllocations: 'violet',
  employees: 'green',
  teams: 'green',
  departments: 'green',
  assets: 'amber',
  materials: 'blue',
  stores: 'blue',
};
/** True when a Firestore read failed because Phase 2 rules are not deployed yet. */
function pendingActivation(kind: Kind, e: unknown) {
  return (
    isPhase2(kind) &&
    String((e as { code?: string })?.code || '').includes('permission-denied')
  );
}

/* ================================================================ values */
function FieldValue({
  context,
  field,
  value,
}: {
  context: Context;
  field: FieldSpec;
  value: string;
}) {
  const label = useLabel(
    context,
    field.reference,
    field.reference ? value : '',
  );
  if (!value) return <span className="muted">—</span>;
  if (field.reference) return <>{label.text}</>;
  if (field.key === 'status' || field.key === 'condition')
    return <StatusPill value={value} />;
  if (field.type === 'date') return <>{formatDate(value)}</>;
  if (field.key === 'unit') return <>{units[value]?.label || value}</>;
  if (field.key === 'workingDays') return <>{value.split(',').join(' · ')}</>;
  if (field.options) return <>{humanize(value)}</>;
  return <>{value}</>;
}
function Cell({
  context,
  kind,
  column,
  value,
}: {
  context: Context;
  kind: Kind;
  column: string;
  value: string;
}) {
  const f = fieldsFor(kind).find((x) => x.key === column)!;
  if (f.key === 'condition' && value) return <StatusPill value={value} />;
  return (
    <span className="cell-ref">
      <FieldValue context={context} field={f} value={value} />
    </span>
  );
}

/* ================================================================ editor */
export function RecordEditor({
  context,
  kind,
  record,
  initial,
  onClose,
  onSaved,
}: {
  context: Context;
  kind: Kind;
  record?: Operation;
  initial?: Values;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const def = definitions[kind];
  const start = record?.values || { ...defaultValues(kind), ...initial };
  const [values, setValues] = useState<Values>(start),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirmClose, setConfirmClose] = useState(false);
  const formId = useId();
  const toast = useToast();
  const dirty = JSON.stringify(values) !== JSON.stringify(start);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  const close = useCallback(() => {
    if (dirty && !busy) setConfirmClose(true);
    else if (!busy) onClose();
  }, [dirty, busy, onClose]);
  function change(key: string, value: string) {
    setErrors((e) => ({ ...e, [key]: '' }));
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === 'siteId') {
        if (kind === 'locations') next.parentId = '';
        if ('locationId' in next && !initial?.locationId) next.locationId = '';
        if ('facilityId' in next) next.facilityId = '';
      }
      if (key === 'trackingMode' && value === 'individual') next.quantity = '1';
      if (key === 'trackingMode' && value === 'batch') next.serialNumber = '';
      return next;
    });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const candidate =
      def.autoCode && !record
        ? {
            ...values,
            code: values.code || 'AUTO',
            name: values.name || 'Auto',
          }
        : values;
    const parsed = inputSchema(kind).safeParse(candidate);
    if (!parsed.success) {
      const map = Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      );
      setErrors(map);
      setError('Please correct the highlighted fields.');
      document.getElementById(formId + Object.keys(map)[0])?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const id = await saveRecord(
        context.services.db,
        context.company.companyId,
        context.uid,
        kind,
        def.autoCode && !record
          ? { ...values, code: 'AUTO', name: '' }
          : parsed.data,
        record,
      );
      clearLabelCache();
      toast(`${humanize(def.singular)} ${record ? 'updated' : 'created'}.`);
      onSaved(id);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  const locked = (f: FieldSpec) =>
    !!record &&
    (f.key === 'code' ||
      f.immutable ||
      (kind === 'contractAllocations' &&
        [
          'contractId',
          'siteId',
          'locationId',
          'allocationType',
          'startDate',
          'endDate',
        ].includes(f.key)) ||
      (kind === 'assets' && ['siteId', 'locationId'].includes(f.key)) ||
      (['locations', 'facilities'].includes(kind) && f.key === 'siteId'));
  const visible = fieldsFor(kind).filter(
    (f) => !(def.autoCode && ['code', 'name'].includes(f.key)),
  );
  const sections = [...new Set(visible.map((f) => f.section || 'General'))];
  const ordered = [
    ...sections.filter((s) => s !== 'Notes'),
    ...sections.filter((s) => s === 'Notes'),
  ];
  const input = (f: FieldSpec) => {
    const id = formId + f.key;
    const common = {
      id,
      'aria-invalid': !!errors[f.key],
      'aria-required': !!f.required,
      'aria-describedby': errors[f.key]
        ? id + '-err'
        : f.help
          ? id + '-help'
          : undefined,
      disabled: locked(f),
    };
    if (f.key === 'workingDays')
      return (
        <div className="chips" role="group" aria-label={f.label}>
          {weekDays.map((day) => {
            const on = values.workingDays.split(',').includes(day);
            return (
              <button
                type="button"
                key={day}
                className="chip-toggle"
                aria-pressed={on}
                aria-label={day}
                onClick={() =>
                  change(
                    'workingDays',
                    weekDays
                      .filter((d) =>
                        d === day
                          ? !on
                          : values.workingDays.split(',').includes(d),
                      )
                      .join(','),
                  )
                }
              >
                {day}
              </button>
            );
          })}
        </div>
      );
    if (f.reference)
      return (
        <Picker
          context={context}
          kind={f.reference}
          value={values[f.key]}
          label={f.label}
          inputId={id}
          invalid={!!errors[f.key]}
          disabled={locked(f) || (!!f.scopedBy && !values[f.scopedBy])}
          placeholder={
            f.scopedBy && !values[f.scopedBy]
              ? 'Choose a site first'
              : undefined
          }
          exclude={record?.id}
          filter={
            f.scopedBy
              ? { key: f.scopedBy, value: values[f.scopedBy] }
              : f.rootOnly
                ? { key: 'parentId', value: '__root__' }
                : undefined
          }
          onChange={(v) => change(f.key, v)}
        />
      );
    if (f.options)
      return (
        <select
          {...common}
          className="input"
          value={values[f.key]}
          onChange={(e) => change(f.key, e.target.value)}
        >
          {!f.required && <option value="">Not set</option>}
          {f.options.map((o) => (
            <option key={o} value={o}>
              {f.key === 'unit' ? units[o]?.label || o : humanize(o)}
            </option>
          ))}
        </select>
      );
    if (f.type === 'textarea')
      return (
        <textarea
          {...common}
          className="input"
          rows={3}
          maxLength={2000}
          value={values[f.key]}
          onChange={(e) => change(f.key, e.target.value)}
        />
      );
    return (
      <input
        {...common}
        className="input"
        type={
          f.type === 'date' || f.type === 'time' || f.type === 'email'
            ? f.type
            : 'text'
        }
        inputMode={
          ['integer', 'decimal', 'money'].includes(f.type || '')
            ? 'decimal'
            : undefined
        }
        value={values[f.key]}
        maxLength={f.max || 200}
        disabled={
          locked(f) ||
          (kind === 'assets' &&
            f.key === 'quantity' &&
            values.trackingMode === 'individual')
        }
        placeholder={
          f.key === 'code'
            ? 'e.g. ' + def.singular.slice(0, 3).toUpperCase() + '-001'
            : undefined
        }
        onChange={(e) =>
          change(
            f.key,
            f.key === 'code' ? e.target.value.toUpperCase() : e.target.value,
          )
        }
      />
    );
  };
  return (
    <>
      <Drawer
        title={`${record ? 'Edit' : 'New'} ${def.singular}`}
        subtitle={
          record
            ? `${record.values.name} · ${record.values.code}`
            : def.description
        }
        icon={
          <IconCircle icon={kindIcons[kind]} tone={kindTone[kind] || 'blue'} />
        }
        onClose={close}
        footer={
          <>
            <span className="note">
              Fields marked <span style={{ color: 'var(--red)' }}>*</span> are
              required
            </span>
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              className="btn btn-primary"
              disabled={busy}
            >
              <Save />
              {busy ? 'Saving…' : `Save ${def.singular}`}
            </button>
          </>
        }
      >
        {kind === 'sites' && (
          <Banner tone="blue">
            Sites are physical properties and never need a client or contract.
            Connect clients later through Contract allocations.
          </Banner>
        )}
        {kind === 'sites' && record?.legacyLinks && (
          <Banner tone="amber" title="Legacy client link preserved">
            This site was created before the site/contract correction. Its
            original client link is kept for migration review and is not changed
            by this edit.
          </Banner>
        )}
        {kind === 'contractAllocations' && (
          <>
            <Banner tone="blue">
              Service coverage can cover a whole site. Occupancy needs a
              specific space and dates within one calendar year. Dates are
              inclusive and cannot be edited after saving.
            </Banner>
            {values.contractId && (
              <DerivedClient context={context} contractId={values.contractId} />
            )}
          </>
        )}
        {kind === 'assets' && record && (
          <Banner tone="blue">
            Use <strong>Transfer</strong> on the asset page to move it to
            another location. Every move is recorded.
          </Banner>
        )}
        {kind === 'designations' && (
          <Banner tone="blue">
            Designations describe a job. They never grant access to FacilityOS.
          </Banner>
        )}
        <form id={formId} onSubmit={(e) => void submit(e)} noValidate>
          <fieldset
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            {ordered.map((section, n) => (
              <section className="form-section" key={section}>
                <h3>
                  <span className="num">{n + 1}</span>
                  {section}
                </h3>
                <div className="form-grid">
                  {visible
                    .filter((f) => (f.section || 'General') === section)
                    .map((f) => (
                      <div
                        key={f.key}
                        className={
                          'field ' +
                          (f.type === 'textarea' || f.key === 'workingDays'
                            ? 'wide'
                            : '')
                        }
                      >
                        <label htmlFor={formId + f.key}>
                          {f.label}
                          {f.required && (
                            <span className="req" aria-hidden="true">
                              *
                            </span>
                          )}
                        </label>
                        {input(f)}
                        {errors[f.key] ? (
                          <span
                            className="err"
                            id={formId + f.key + '-err'}
                            role="alert"
                          >
                            <AlertCircle size={14} />
                            {errors[f.key]}
                          </span>
                        ) : (
                          f.help && (
                            <span
                              className="help"
                              id={formId + f.key + '-help'}
                            >
                              {f.help}
                            </span>
                          )
                        )}
                      </div>
                    ))}
                </div>
              </section>
            ))}
          </fieldset>
          {error && (
            <Banner tone="red" role="alert">
              {error}
            </Banner>
          )}
        </form>
      </Drawer>
      {confirmClose && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          confirmLabel="Discard changes"
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => {
            setConfirmClose(false);
            onClose();
          }}
        >
          Your changes to this {def.singular} have not been saved.
        </ConfirmDialog>
      )}
    </>
  );
}
function DerivedClient({
  context,
  contractId,
}: {
  context: Context;
  contractId: string;
}) {
  const [clientId, setClientId] = useState('');
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() =>
      recordById(
        context.services.db,
        context.company.companyId,
        'contracts',
        contractId,
      ).then((r) => live && setClientId(r?.values.clientId || '')),
    );
    return () => {
      live = false;
    };
  }, [context, contractId]);
  const client = useLabel(context, 'clients', clientId);
  return (
    <Banner tone="green" title="Client taken from the contract">
      {clientId ? client.text : 'Loading…'}
    </Banner>
  );
}

/* ================================================================ list */
export function RecordList({
  context,
  kind,
  filter,
  initial,
  assetClasses,
  embedded,
  onOpen,
  version: outerVersion = 0,
  onChanged,
}: {
  context: Context;
  kind: Kind;
  filter?: { key: string; value: string };
  initial?: Values;
  assetClasses?: string[];
  embedded?: boolean;
  onOpen?: (r: Operation) => void;
  version?: number;
  onChanged?: () => void;
}) {
  const def = definitions[kind];
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [assetClass, setAssetClass] = useState(assetClasses?.[0] || ''),
    [rows, setRows] = useState<Operation[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false),
    [truncated, setTruncated] = useState(false),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false),
    [busy, setBusy] = useState(true),
    [version, setVersion] = useState(0),
    [editing, setEditing] = useState<{ record?: Operation } | null>(null),
    [archive, setArchive] = useState<Operation>(),
    [archiving, setArchiving] = useState(false),
    [detail, setDetail] = useState<Operation>();
  const toast = useToast();
  const term = useDebounced(search);
  const effectiveFilter =
    filter ||
    (assetClass ? { key: 'assetClass', value: assetClass } : undefined);
  const fKey = effectiveFilter?.key,
    fValue = effectiveFilter?.value;
  useEffect(() => {
    let live = true;
    setBusy(true);
    listRecords(
      context.services.db,
      context.company.companyId,
      kind,
      term,
      status,
      undefined,
      fKey ? { key: fKey, value: fValue || '' } : undefined,
    )
      .then((r) => {
        if (!live) return;
        setRows(r.rows);
        setCursor(r.cursor);
        setMore(r.hasMore);
        setTruncated(r.truncated);
        setError('');
        setPending(false);
      })
      .catch((e) => {
        if (!live) return;
        setPending(pendingActivation(kind, e));
        setError(friendly(e));
      })
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [context, kind, term, status, fKey, fValue, version, outerVersion]);
  async function next() {
    setBusy(true);
    try {
      const r = await listRecords(
        context.services.db,
        context.company.companyId,
        kind,
        term,
        status,
        cursor,
        fKey ? { key: fKey, value: fValue || '' } : undefined,
      );
      setRows((v) => [...v, ...r.rows]);
      setCursor(r.cursor);
      setMore(r.hasMore);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  function refresh() {
    setVersion((v) => v + 1);
    onChanged?.();
  }
  async function confirmArchive() {
    if (!archive) return;
    setArchiving(true);
    try {
      await saveRecord(
        context.services.db,
        context.company.companyId,
        context.uid,
        kind,
        { ...archive.values, status: 'archived' },
        archive,
      );
      clearLabelCache();
      toast(`${archive.values.name} archived.`);
      setArchive(undefined);
      refresh();
    } catch (e) {
      toast(friendly(e), 'red');
      setArchive(undefined);
    } finally {
      setArchiving(false);
    }
  }
  const open = (r: Operation) => (onOpen ? onOpen(r) : setDetail(r));
  if (detail && !onOpen)
    return (
      <RecordDetail
        context={context}
        kind={kind}
        record={detail}
        onBack={() => {
          setDetail(undefined);
          refresh();
        }}
      />
    );
  const columns = def.columns.filter((c) => !(filter && c === filter.key));
  const statusOptions = statuses(kind);
  const archivable = (r: Operation) =>
    r.values.status !== 'archived' &&
    !(isAssignment(kind) && r.values.status === 'active') &&
    !(kind === 'contractAllocations' && r.values.status === 'active');
  const addLabel = `Add ${def.singular}`;
  const body = (
    <>
      <div className="toolbar">
        <div className="search">
          <Search />
          <input
            aria-label={`Search ${def.title.toLowerCase()}`}
            placeholder={`Search ${def.title.toLowerCase()} by name…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {assetClasses && assetClasses.length > 1 && (
          <Segmented
            label="Asset class"
            value={assetClass}
            onChange={setAssetClass}
            options={assetClasses.map((c) => ({ value: c, label: c }))}
          />
        )}
        <select
          className="select"
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-btn"
          aria-label="Refresh"
          title="Refresh"
          onClick={refresh}
        >
          <RefreshCw />
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginLeft: 'auto' }}
          disabled={pending}
          onClick={() => setEditing({})}
        >
          <Plus />
          {addLabel}
        </button>
      </div>
      {pending ? (
        <Empty icon={AlertCircle} title="Module pending activation">
          {def.title} are ready in the app, but the matching database security
          rules have not been deployed to this environment yet. An administrator
          needs to publish the latest Firestore rules and indexes.
        </Empty>
      ) : error ? (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      ) : null}
      {!pending && (
        <div className="table-wrap">
          {rows.length > 0 && (
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  {columns.map((c) => (
                    <th key={c}>
                      {fieldsFor(kind).find((f) => f.key === c)!.label}
                    </th>
                  ))}
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const Icon = kindIcons[kind];
                  return (
                    <tr
                      key={r.id}
                      className="clickable"
                      style={{ ['--i' as string]: i }}
                      onClick={() => open(r)}
                    >
                      <td>
                        <div className="cell-main">
                          <span
                            className={`icon-circle tone-${kindTone[kind] || 'blue'}`}
                            style={{ width: 38, height: 38 }}
                          >
                            <Icon size={17} />
                          </span>
                          <div>
                            <button
                              type="button"
                              className="text-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                open(r);
                              }}
                            >
                              {r.values.name}
                            </button>
                            <div className="s">
                              <span className="code-chip">{r.values.code}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      {columns.map((c) => (
                        <td key={c}>
                          <Cell
                            context={context}
                            kind={kind}
                            column={c}
                            value={r.values[c]}
                          />
                        </td>
                      ))}
                      <td>
                        <StatusPill value={r.values.status} />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn sm"
                            aria-label={'Edit ' + r.values.name}
                            title="Edit"
                            onClick={() => setEditing({ record: r })}
                          >
                            <Pencil />
                          </button>
                          {archivable(r) && (
                            <button
                              type="button"
                              className="icon-btn sm"
                              aria-label={'Archive ' + r.values.name}
                              title="Archive"
                              onClick={() => setArchive(r)}
                            >
                              <Archive />
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-btn sm"
                            aria-label={'Open ' + r.values.name}
                            title="Open"
                            onClick={() => open(r)}
                          >
                            <ChevronRight />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {busy && <Skeleton rows={rows.length ? 1 : 4} />}
          {!busy && !error && !rows.length && (
            <Empty
              icon={kindIcons[kind]}
              title={
                term || status
                  ? 'No matching records'
                  : `No ${def.title.toLowerCase()} yet`
              }
              action={
                !term && !status ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setEditing({})}
                  >
                    <Plus />
                    {addLabel}
                  </button>
                ) : undefined
              }
            >
              {term || status
                ? 'Try a different name or status filter.'
                : def.description}
            </Empty>
          )}
          {(more || truncated || rows.length > 0) && (
            <div className="list-foot">
              <span>
                Showing {rows.length} {rows.length === 1 ? 'record' : 'records'}
                {truncated && ' · refine your search to see more'}
              </span>
              {more && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={busy}
                  onClick={() => void next()}
                >
                  Load more
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
  return (
    <>
      {embedded ? (
        body
      ) : (
        <section className="card card-pad rise">{body}</section>
      )}
      {editing && (
        <RecordEditor
          context={context}
          kind={kind}
          record={editing.record}
          initial={{
            ...initial,
            ...(assetClass && !editing.record ? { assetClass } : {}),
          }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {archive && (
        <ConfirmDialog
          title={`Archive ${archive.values.name}?`}
          confirmLabel="Archive"
          busy={archiving}
          onCancel={() => setArchive(undefined)}
          onConfirm={() => void confirmArchive()}
        >
          Archived records stay in history and keep their code reserved. Records
          still linked to this one must be archived or reassigned first.
        </ConfirmDialog>
      )}
    </>
  );
}

/* ================================================================ detail */
type Related = {
  label: string;
  kind: Kind;
  key: string;
  initial?: (r: Operation) => Values;
};
function relatedFor(kind: Kind): Related[] {
  const rel = (
    label: string,
    k: Kind,
    key: string,
    initial?: Related['initial'],
  ) => ({
    label,
    kind: k,
    key,
    initial: initial || ((r: Operation) => ({ [key]: r.id })),
  });
  switch (kind) {
    case 'sites':
      return [
        rel('Locations', 'locations', 'siteId'),
        rel('Facilities', 'facilities', 'siteId'),
        rel('Assets', 'assets', 'siteId'),
        rel('Stores', 'stores', 'siteId'),
        rel('Allocations', 'contractAllocations', 'siteId'),
        rel('Staff', 'siteAssignments', 'siteId'),
        rel('Shifts', 'shifts', 'siteId'),
      ];
    case 'locations':
      return [
        rel('Child locations', 'locations', 'parentId', (r) => ({
          siteId: r.values.siteId,
          parentId: r.id,
        })),
        rel('Facilities', 'facilities', 'locationId', (r) => ({
          siteId: r.values.siteId,
          locationId: r.id,
        })),
        rel('Assets', 'assets', 'locationId', (r) => ({
          siteId: r.values.siteId,
          locationId: r.id,
        })),
      ];
    case 'clients':
      return [rel('Contracts', 'contracts', 'clientId')];
    case 'contracts':
      return [rel('Allocations', 'contractAllocations', 'contractId')];
    case 'facilityTypes':
      return [rel('Facilities', 'facilities', 'typeId')];
    case 'facilities':
      return [
        rel('Assets', 'assets', 'facilityId', (r) => ({
          siteId: r.values.siteId,
          locationId: r.values.locationId,
          facilityId: r.id,
        })),
      ];
    case 'departments':
      return [
        rel('Employees', 'employees', 'departmentId'),
        rel('Designations', 'designations', 'departmentId'),
        rel('Teams', 'teams', 'departmentId'),
        rel('Sub-departments', 'departments', 'parentId'),
      ];
    case 'designations':
      return [rel('Employees', 'employees', 'designationId')];
    case 'employees':
      return [
        rel('Sites', 'siteAssignments', 'employeeId'),
        rel('Teams', 'teamMembers', 'employeeId'),
        rel('Shifts', 'shiftAssignments', 'employeeId'),
        rel('Leave', 'leaveRecords', 'employeeId'),
        rel('Assets in custody', 'assets', 'custodianId'),
        rel('Direct reports', 'employees', 'supervisorId'),
      ];
    case 'teams':
      return [rel('Members', 'teamMembers', 'teamId')];
    case 'shifts':
      return [rel('Assigned employees', 'shiftAssignments', 'shiftId')];
    case 'assetCategories':
      return [
        rel('Assets', 'assets', 'categoryId'),
        rel('Subcategories', 'assetCategories', 'parentId'),
      ];
    case 'suppliers':
      return [
        rel('Assets', 'assets', 'supplierId'),
        rel('Materials', 'materials', 'preferredSupplierId'),
      ];
    case 'materialCategories':
      return [rel('Materials', 'materials', 'categoryId')];
    default:
      return [];
  }
}
export function RecordDetail({
  context,
  kind,
  record: initialRecord,
  onBack,
}: {
  context: Context;
  kind: Kind;
  record: Operation;
  onBack: () => void;
}) {
  const def = definitions[kind];
  const [record, setRecord] = useState(initialRecord),
    [tab, setTab] = useState('overview'),
    [editing, setEditing] = useState(false),
    [transfer, setTransfer] = useState(false),
    [qr, setQr] = useState(false),
    [archive, setArchive] = useState(false),
    [archiving, setArchiving] = useState(false),
    [version, setVersion] = useState(0);
  const toast = useToast();
  const related = relatedFor(kind);
  const extraTabs = [
    ...(['facilities', 'contractAllocations', 'assets'].includes(kind)
      ? [{ value: 'history', label: 'History' }]
      : []),
    ...(kind === 'assets' ? [{ value: 'transfers', label: 'Transfers' }] : []),
    ...(['materials', 'stores'].includes(kind)
      ? [{ value: 'stock', label: 'Stock' }]
      : []),
  ];
  const tabs = [
    { value: 'overview', label: 'Overview' },
    ...(kind === 'sites' ? [{ value: 'tree', label: 'Location tree' }] : []),
    ...related.map((r) => ({ value: 'rel:' + r.label, label: r.label })),
    ...extraTabs,
  ];
  async function reload() {
    const r = await recordById(
      context.services.db,
      context.company.companyId,
      kind,
      record.id,
    );
    if (r) setRecord(r);
    setVersion((v) => v + 1);
  }
  async function confirmArchive() {
    setArchiving(true);
    try {
      await saveRecord(
        context.services.db,
        context.company.companyId,
        context.uid,
        kind,
        { ...record.values, status: 'archived' },
        record,
      );
      clearLabelCache();
      toast(`${record.values.name} archived.`);
      setArchive(false);
      await reload();
    } catch (e) {
      toast(friendly(e), 'red');
      setArchive(false);
    } finally {
      setArchiving(false);
    }
  }
  const sections = [
    ...new Set(fieldsFor(kind).map((f) => f.section || 'General')),
  ];
  const Icon = kindIcons[kind];
  return (
    <section className="card card-pad rise">
      <button
        type="button"
        className="link-btn"
        onClick={onBack}
        style={{ marginBottom: 14 }}
      >
        <ArrowLeft />
        Back to {def.title.toLowerCase()}
      </button>
      <div className="detail-head">
        <IconCircle icon={Icon} tone={kindTone[kind] || 'blue'} size="lg" />
        <div className="grow">
          <h1>{record.values.name}</h1>
          <div className="meta">
            <span className="code-chip">{record.values.code}</span>
            <StatusPill value={record.values.status} />
            {record.refCount > 0 && (
              <Pill tone="blue">
                {record.refCount} active link{record.refCount === 1 ? '' : 's'}
              </Pill>
            )}
          </div>
        </div>
        <div className="page-actions">
          {kind === 'locations' && record.values.status !== 'archived' && (
            <AddChild context={context} record={record} onDone={reload} />
          )}
          {kind === 'assets' && record.values.status !== 'archived' && (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setQr(true)}
              >
                <QrCode />
                QR label
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setTransfer(true)}
              >
                <ArrowLeftRight />
                Transfer
              </button>
            </>
          )}
          {record.values.status !== 'archived' &&
            !(isAssignment(kind) && record.values.status === 'active') &&
            !(
              kind === 'contractAllocations' &&
              record.values.status === 'active'
            ) && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setArchive(true)}
              >
                <Archive />
                Archive
              </button>
            )}
          <button
            type="button"
            className="btn btn-dark"
            onClick={() => setEditing(true)}
          >
            <Pencil />
            Edit
          </button>
        </div>
      </div>
      <Tabs
        label={`${def.singular} sections`}
        tabs={tabs}
        value={tab}
        onChange={setTab}
      />
      {tab === 'overview' && (
        <div key={version}>
          {sections.map((s) => (
            <div className="fact-group" key={s}>
              <h3>{s}</h3>
              <dl className="facts">
                {fieldsFor(kind)
                  .filter((f) => (f.section || 'General') === s)
                  .map((f) => (
                    <div
                      key={f.key}
                      className={
                        'fact ' + (f.type === 'textarea' ? 'wide' : '')
                      }
                    >
                      <dt>{f.label}</dt>
                      <dd>
                        <FieldValue
                          context={context}
                          field={f}
                          value={record.values[f.key]}
                        />
                      </dd>
                    </div>
                  ))}
                {s === 'General' && kind === 'contractAllocations' && (
                  <div className="fact">
                    <dt>Client at allocation</dt>
                    <dd>
                      <FieldValue
                        context={context}
                        field={{ key: 'c', label: '', reference: 'clients' }}
                        value={record.clientIdSnapshot || ''}
                      />
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
          <p className="muted small" style={{ marginTop: 18 }}>
            Created {formatInstant(record.createdAt.toDate())} · Updated{' '}
            {formatInstant(record.updatedAt.toDate())} · Revision{' '}
            {record.revision}
          </p>
        </div>
      )}
      {tab === 'tree' && <LocationTree context={context} siteId={record.id} />}
      {tab.startsWith('rel:') &&
        related
          .filter((r) => 'rel:' + r.label === tab)
          .map((r) => (
            <RecordList
              key={r.label + version}
              embedded
              context={context}
              kind={r.kind}
              filter={{ key: r.key, value: record.id }}
              initial={r.initial?.(record)}
            />
          ))}
      {tab === 'history' && (
        <HistoryTimeline
          context={context}
          kind={kind}
          id={record.id}
          key={version}
        />
      )}
      {tab === 'transfers' && (
        <TransferHistory context={context} assetId={record.id} key={version} />
      )}
      {tab === 'stock' && (
        <StockForRecord
          context={context}
          kind={kind as 'materials' | 'stores'}
          record={record}
        />
      )}
      {editing && (
        <RecordEditor
          context={context}
          kind={kind}
          record={record}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void reload();
          }}
        />
      )}
      {transfer && (
        <TransferDrawer
          context={context}
          asset={record}
          onClose={() => setTransfer(false)}
          onDone={() => {
            setTransfer(false);
            void reload();
          }}
        />
      )}
      {qr && (
        <QrDialog
          context={context}
          asset={record}
          onClose={() => setQr(false)}
        />
      )}
      {archive && (
        <ConfirmDialog
          title={`Archive ${record.values.name}?`}
          confirmLabel="Archive"
          busy={archiving}
          onCancel={() => setArchive(false)}
          onConfirm={() => void confirmArchive()}
        >
          Archived records stay in history and keep their code reserved. Records
          still linked to this one must be archived or reassigned first.
        </ConfirmDialog>
      )}
    </section>
  );
}
function AddChild({
  context,
  record,
  onDone,
}: {
  context: Context;
  record: Operation;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => setOpen(true)}
      >
        <FolderPlus />
        Add child location
      </button>
      {open && (
        <RecordEditor
          context={context}
          kind="locations"
          initial={{ siteId: record.values.siteId, parentId: record.id }}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onDone();
          }}
        />
      )}
    </>
  );
}

/* ================================================================ history */
function HistoryTimeline({
  context,
  kind,
  id,
}: {
  context: Context;
  kind: Kind;
  id: string;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>(),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    listSubcollection(context.services.db, context.company.companyId, [
      kind,
      id,
      'history',
    ])
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [context, kind, id]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!rows) return <Skeleton rows={3} />;
  if (!rows.length) return <Empty title="No history yet" />;
  return (
    <>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Latest 20 recorded changes, newest first. Entries are attributed to the
        signed-in user and cannot be edited or deleted.
      </p>
      <ol className="timeline">
        {rows.map((h) => {
          const snap = (h.snapshot as Values) || (h as unknown as Values);
          const status = String(snap.status || h.status || '');
          return (
            <li key={String(h.id)}>
              <span className="node" aria-hidden />
              <div className="what">
                Revision {String(h.revision)}
                {status && <StatusPill value={status} />}
                {h.condition ? (
                  <Pill tone={toneFor(String(h.condition))}>
                    {String(h.condition)}
                  </Pill>
                ) : null}
                {h.transferId ? <Pill tone="violet">Transferred</Pill> : null}
                {snap.effectiveEndDate && (
                  <span className="muted small">
                    through {formatDate(snap.effectiveEndDate)}
                  </span>
                )}
                {kind === 'assets' && h.quantity && h.quantity !== '1' ? (
                  <span className="muted small">Qty {String(h.quantity)}</span>
                ) : null}
              </div>
              <div className="when">
                {h.occurredAt &&
                typeof (h.occurredAt as { toDate?: () => Date }).toDate ===
                  'function'
                  ? formatInstant(
                      (h.occurredAt as { toDate: () => Date }).toDate(),
                    )
                  : ''}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/* ================================================================ location tree */
function LocationTree({
  context,
  siteId,
}: {
  context: Context;
  siteId: string;
}) {
  return (
    <>
      <p className="muted" style={{ marginBottom: 14 }}>
        Expand a location to see what is inside it. Manage locations from the
        Locations tab.
      </p>
      <TreeLevel context={context} siteId={siteId} parentId="" root />
    </>
  );
}
function TreeLevel({
  context,
  siteId,
  parentId,
  root,
}: {
  context: Context;
  siteId: string;
  parentId: string;
  root?: boolean;
}) {
  const [rows, setRows] = useState<Operation[]>(),
    [open, setOpen] = useState<string[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    listRecords(
      context.services.db,
      context.company.companyId,
      'locations',
      '',
      '',
      undefined,
      { key: 'parentId', value: parentId || '__root__' },
      { key: 'siteId', value: siteId },
    )
      .then((r) => live && setRows(r.rows))
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [context, siteId, parentId]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!rows) return <Skeleton rows={1} />;
  if (!rows.length)
    return root ? (
      <Empty icon={MapPin} title="No locations yet">
        Add buildings, floors and rooms from the Locations tab.
      </Empty>
    ) : (
      <p className="muted small">No locations inside.</p>
    );
  return (
    <ul className={'tree ' + (root ? 'root' : '')}>
      {rows.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            className="tree-node"
            aria-expanded={open.includes(r.id)}
            onClick={() =>
              setOpen((v) =>
                v.includes(r.id) ? v.filter((x) => x !== r.id) : [...v, r.id],
              )
            }
          >
            <ChevronRight className="chev" />
            {r.values.name}
            <span className="muted small">{r.values.locationType}</span>
            {r.values.status === 'archived' && (
              <Pill tone="gray">Archived</Pill>
            )}
          </button>
          {open.includes(r.id) && (
            <TreeLevel context={context} siteId={siteId} parentId={r.id} />
          )}
        </li>
      ))}
    </ul>
  );
}

/* ================================================================ page */
export function RecordPage({
  context,
  kinds,
  assetClasses,
}: {
  context: Context;
  kinds: Kind[];
  assetClasses?: string[];
}) {
  const [kind, setKind] = useState<Kind>(kinds[0]);
  const [params, setParams] = useSearchParams();
  const [opened, setOpened] = useState<Operation>();
  const openId = params.get('open') || '';
  // Deep links such as QR labels: /assets?open=<id>. Access is still enforced by rules.
  useEffect(() => {
    if (!openId) return;
    let live = true;
    Promise.resolve().then(() =>
      recordById(
        context.services.db,
        context.company.companyId,
        kinds[0],
        openId,
      )
        .then((r) => live && r && setOpened(r))
        .catch(() => undefined),
    );
    return () => {
      live = false;
    };
  }, [openId, context, kinds]);
  if (opened)
    return (
      <RecordDetail
        context={context}
        kind={kinds[0]}
        record={opened}
        onBack={() => {
          setOpened(undefined);
          setParams({});
        }}
      />
    );
  return (
    <>
      {kinds.length > 1 && (
        <div className="rise">
          <Segmented
            label="Record type"
            value={kind}
            onChange={setKind}
            options={kinds.map((k) => ({
              value: k,
              label: definitions[k].title,
            }))}
          />
        </div>
      )}
      <RecordList
        key={kind}
        context={context}
        kind={kind}
        assetClasses={assetClasses}
      />
    </>
  );
}

/* Small reads used by the dashboard. */
export async function latest(
  context: Context,
  path: string[],
  order = 'createdAt',
) {
  const r = await getDocs(
    query(
      collection(
        context.services.db,
        'companies',
        context.company.companyId,
        ...(path as [string]),
      ),
      orderBy(order, 'desc'),
      limit(5),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }));
}
