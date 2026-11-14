import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { doc, getDoc, type QueryDocumentSnapshot } from 'firebase/firestore';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Printer,
  Plus,
  RefreshCw,
  Undo2,
  Save,
  PackageCheck,
  PackageOpen,
  Repeat,
  SlidersHorizontal,
  Receipt,
  BarChart3,
} from 'lucide-react';
import {
  definitions,
  movementLabels,
  movementSides,
  parseQuantity,
  formatQuantity,
  unitDecimals,
  units,
  belowReorder,
  reversalOf,
  reversalId,
  balanceId,
  type MovementInput,
  type MovementType,
  type Operation,
} from '@facilityos/shared';
import {
  transferAsset,
  listTransfers,
  listBalances,
  listMovements,
  postMovement,
  newMovementId,
  recordById,
  AlreadyPostedError,
  type Balance,
  type Movement,
} from './store';
import {
  clearLabelCache,
  formatDate,
  formatInstant,
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
  friendly,
  useToast,
} from '../ui/kit';

const today = () => new Date().toISOString().slice(0, 10);
function Label({
  context,
  kind,
  id,
}: {
  context: Context;
  kind: Parameters<typeof useLabel>[1];
  id: string;
}) {
  return <>{useLabel(context, kind, id).text}</>;
}
function Field({
  label,
  required,
  children,
  error,
  help,
  wide,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
  help?: string;
  wide?: boolean;
}) {
  return (
    <div className={'field ' + (wide ? 'wide' : '')}>
      <span className="field-label">
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
      </span>
      {children}
      {error ? (
        <span className="err" role="alert">
          {error}
        </span>
      ) : (
        help && <span className="help">{help}</span>
      )}
    </div>
  );
}
function pendingFor(e: unknown) {
  return String((e as { code?: string })?.code || '').includes(
    'permission-denied',
  );
}
function Pending({ what }: { what: string }) {
  return (
    <Empty title="Module pending activation">
      {what} is ready in the app, but the matching database security rules have
      not been deployed to this environment yet.
    </Empty>
  );
}

/* ================================================================ transfers */
export function TransferDrawer({
  context,
  asset,
  onClose,
  onDone,
}: {
  context: Context;
  asset: Operation;
  onClose: () => void;
  onDone: () => void;
}) {
  const [v, setV] = useState({
    toSiteId: asset.values.siteId,
    toLocationId: '',
    transferDate: today(),
    reason: '',
    conditionAfter: asset.values.condition,
    receivedById: '',
    notes: '',
  });
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const toast = useToast();
  const id = useId();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await transferAsset(
        context.services.db,
        context.company.companyId,
        context.uid,
        asset,
        v,
      );
      clearLabelCache();
      toast(`${asset.values.name} transferred.`);
      onDone();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Drawer
      narrow
      title="Transfer asset"
      subtitle={`${asset.values.name} · ${asset.values.code}`}
      icon={<IconCircle icon={ArrowLeftRight} tone="violet" />}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form={id}
            className="btn btn-primary"
            disabled={busy}
          >
            <ArrowLeftRight />
            {busy ? 'Transferring…' : 'Confirm transfer'}
          </button>
        </>
      }
    >
      <form id={id} onSubmit={(e) => void submit(e)} noValidate>
        <section className="form-section">
          <h3>
            <span className="num">1</span>From
          </h3>
          <div className="inset" style={{ padding: 14 }}>
            <strong>
              <Label
                context={context}
                kind="locations"
                id={asset.values.locationId}
              />
            </strong>
            <div className="muted small">
              <Label context={context} kind="sites" id={asset.values.siteId} />{' '}
              · condition {asset.values.condition}
              {asset.values.trackingMode === 'batch' &&
                ` · ${asset.values.quantity} items`}
            </div>
          </div>
        </section>
        <section className="form-section">
          <h3>
            <span className="num">2</span>To
          </h3>
          <div className="form-grid">
            <Field label="Destination site" required>
              <Picker
                context={context}
                kind="sites"
                label="Destination site"
                value={v.toSiteId}
                onChange={(x) => setV({ ...v, toSiteId: x, toLocationId: '' })}
              />
            </Field>
            <Field label="Destination location" required>
              <Picker
                context={context}
                kind="locations"
                label="Destination location"
                value={v.toLocationId}
                disabled={!v.toSiteId}
                filter={{ key: 'siteId', value: v.toSiteId }}
                exclude={asset.values.locationId}
                onChange={(x) => setV({ ...v, toLocationId: x })}
              />
            </Field>
          </div>
        </section>
        <section className="form-section">
          <h3>
            <span className="num">3</span>Details
          </h3>
          <div className="form-grid">
            <Field label="Transfer date" required>
              <input
                className="input"
                type="date"
                aria-label="Transfer date"
                value={v.transferDate}
                onChange={(e) => setV({ ...v, transferDate: e.target.value })}
              />
            </Field>
            <Field label="Condition on arrival" required>
              <select
                className="input"
                aria-label="Condition on arrival"
                value={v.conditionAfter}
                onChange={(e) => setV({ ...v, conditionAfter: e.target.value })}
              >
                {['Excellent', 'Good', 'Fair', 'Poor', 'Critical'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Reason" required wide>
              <input
                className="input"
                aria-label="Reason"
                maxLength={500}
                value={v.reason}
                placeholder="e.g. Relocated to new office"
                onChange={(e) => setV({ ...v, reason: e.target.value })}
              />
            </Field>
            <Field
              label="Received by"
              help="Optional acknowledgment by an employee at the destination."
            >
              <Picker
                context={context}
                kind="employees"
                label="Receiving employee"
                value={v.receivedById}
                onChange={(x) => setV({ ...v, receivedById: x })}
              />
            </Field>
            <Field label="Notes" wide>
              <textarea
                className="input"
                aria-label="Notes"
                rows={3}
                value={v.notes}
                onChange={(e) => setV({ ...v, notes: e.target.value })}
              />
            </Field>
          </div>
        </section>
        {error && (
          <Banner tone="red" role="alert">
            {error}
          </Banner>
        )}
      </form>
    </Drawer>
  );
}
type TransferRow = Awaited<ReturnType<typeof listTransfers>>['rows'][number];
function TransferRows({
  context,
  rows,
  showAsset,
}: {
  context: Context;
  rows: TransferRow[];
  showAsset?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {showAsset && <th>Asset</th>}
            <th>From</th>
            <th>To</th>
            <th>Date</th>
            <th>Condition</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.id} style={{ ['--i' as string]: i }}>
              {showAsset && (
                <td>
                  <strong>
                    <Label context={context} kind="assets" id={t.assetId} />
                  </strong>
                </td>
              )}
              <td className="cell-ref">
                <Label
                  context={context}
                  kind="locations"
                  id={t.fromLocationId}
                />
              </td>
              <td className="cell-ref">
                <Label context={context} kind="locations" id={t.toLocationId} />
              </td>
              <td>{formatDate(t.transferDate)}</td>
              <td>
                <span
                  style={{
                    display: 'inline-flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <StatusPill value={t.conditionBefore} />→
                  <StatusPill value={t.conditionAfter} />
                </span>
              </td>
              <td className="cell-ref">{t.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function TransferHistory({
  context,
  assetId,
}: {
  context: Context;
  assetId: string;
}) {
  const [rows, setRows] = useState<TransferRow[]>(),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    listTransfers(context.services.db, context.company.companyId, assetId)
      .then((r) => live && setRows(r.rows))
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [context, assetId]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!rows) return <Skeleton rows={2} />;
  if (!rows.length)
    return (
      <Empty icon={ArrowLeftRight} title="No transfers yet">
        Moves made with Transfer appear here.
      </Empty>
    );
  return <TransferRows context={context} rows={rows} />;
}
export function TransfersPage({ context }: { context: Context }) {
  const [rows, setRows] = useState<TransferRow[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setBusy(true);
    listTransfers(context.services.db, context.company.companyId)
      .then((r) => {
        if (!live) return;
        setRows(r.rows);
        setCursor(r.cursor);
        setMore(r.hasMore);
        setError('');
      })
      .catch((e) => {
        if (!live) return;
        setPending(pendingFor(e));
        setError(friendly(e));
      })
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [context, version]);
  return (
    <section className="card card-pad rise">
      <div className="card-head">
        <div className="title">
          <h2>Transfer log</h2>
          <span className="count-chip">{rows.length} shown</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Refresh"
          onClick={() => setVersion((v) => v + 1)}
        >
          <RefreshCw />
        </button>
      </div>
      <Banner tone="blue">
        To move an asset, open it in the Asset register and choose{' '}
        <strong>Transfer</strong>. Each transfer is permanent and cannot be
        edited.
      </Banner>
      <div style={{ height: 12 }} />
      {pending ? (
        <Pending what="Asset transfers" />
      ) : error ? (
        <Banner tone="red">{error}</Banner>
      ) : null}
      {!pending && rows.length > 0 && (
        <TransferRows context={context} rows={rows} showAsset />
      )}
      {busy && <Skeleton rows={3} />}
      {!busy && !error && !rows.length && (
        <Empty icon={ArrowLeftRight} title="No transfers recorded yet" />
      )}
      {more && (
        <div className="list-foot">
          <span />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={async () => {
              const r = await listTransfers(
                context.services.db,
                context.company.companyId,
                '',
                cursor,
              );
              setRows((v) => [...v, ...r.rows]);
              setCursor(r.cursor);
              setMore(r.hasMore);
            }}
          >
            Load more
          </button>
        </div>
      )}
    </section>
  );
}
export function assetLink(assetId: string) {
  const base = location.origin + location.pathname;
  return import.meta.env.VITE_ROUTER_MODE === 'hash'
    ? `${base}#/assets?open=${assetId}`
    : `${location.origin}${import.meta.env.BASE_URL || '/'}assets?open=${assetId}`.replace(
        /([^:])\/\//,
        '$1/',
      );
}
export function QrDialog({
  context,
  asset,
  onClose,
}: {
  context: Context;
  asset: Operation;
  onClose: () => void;
}) {
  const [src, setSrc] = useState('');
  const link = assetLink(asset.id);
  useEffect(() => {
    QRCode.toDataURL(link, {
      margin: 1,
      width: 440,
      color: { dark: '#101a2e' },
    }).then(setSrc);
  }, [link]);
  return (
    <Drawer
      narrow
      title="QR label"
      subtitle="Scanning opens this asset after sign-in. The code contains no credentials."
      onClose={onClose}
      footer={
        <>
          <a
            className="btn btn-outline"
            href={src}
            download={`${asset.values.code}.png`}
          >
            <Download />
            Download
          </a>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const w = window.open('', '_blank', 'width=420,height=560');
              if (!w) return;
              w.document.write(
                `<title>${asset.values.code}</title><body style="font-family:sans-serif;text-align:center;padding:24px"><img src="${src}" style="width:260px"/><h2 style="letter-spacing:.06em">${asset.values.code}</h2><p>${asset.values.name.replace(/</g, '&lt;')}</p><p style="color:#64748b">${context.company.name.replace(/</g, '&lt;')}</p><script>onload=()=>print()</script></body>`,
              );
              w.document.close();
            }}
          >
            <Printer />
            Print label
          </button>
        </>
      }
    >
      <div className="qr-card">
        {src ? (
          <img src={src} alt={`QR code for ${asset.values.code}`} />
        ) : (
          <Skeleton rows={1} />
        )}
        <div className="tag">{asset.values.code}</div>
        <p className="muted">{asset.values.name}</p>
        <p className="muted small" style={{ marginTop: 12 }}>
          Mobile scanning arrives with the staff app. Today, any phone camera
          opens the asset page, which still requires an authorised FacilityOS
          sign-in.
        </p>
      </div>
    </Drawer>
  );
}

/* ================================================================ inventory */
function useMaterial(context: Context, id: string) {
  const [m, setM] = useState<Operation | null>(null);
  useEffect(() => {
    let live = true;
    if (!id) return;
    recordById(
      context.services.db,
      context.company.companyId,
      'materials',
      id,
    ).then((r) => live && setM(r));
    return () => {
      live = false;
    };
  }, [context, id]);
  return id ? m : null;
}
function Quantity({
  context,
  materialId,
  minor,
  signed,
}: {
  context: Context;
  materialId: string;
  minor: number;
  signed?: 1 | -1;
}) {
  const m = useMaterial(context, materialId);
  if (!m) return <span className="mono">…</span>;
  const d = unitDecimals(m.values.unit);
  return (
    <span
      className="mono"
      style={{
        fontWeight: 650,
        color:
          signed === 1
            ? 'var(--green)'
            : signed === -1
              ? 'var(--red)'
              : undefined,
      }}
    >
      {signed === 1 ? '+' : signed === -1 ? '−' : ''}
      {formatQuantity(minor, d)}{' '}
      <span className="muted small">{m.values.unit}</span>
    </span>
  );
}
function BalanceRow({
  context,
  b,
  i,
  hide,
}: {
  context: Context;
  b: Balance;
  i: number;
  hide?: 'store' | 'material';
}) {
  const m = useMaterial(context, b.materialId);
  const low = m
    ? belowReorder(
        b.quantity,
        m.values.reorderLevel,
        unitDecimals(m.values.unit),
      )
    : false;
  return (
    <tr style={{ ['--i' as string]: i }}>
      {hide !== 'material' && (
        <td>
          <div className="cell-main">
            <span
              className="icon-circle tone-blue"
              style={{ width: 38, height: 38 }}
            >
              <PackageCheck size={17} />
            </span>
            <div>
              <div className="t">{m?.values.name || '…'}</div>
              <div className="s">
                <span className="code-chip">{m?.values.code}</span>
              </div>
            </div>
          </div>
        </td>
      )}
      {hide !== 'store' && (
        <td className="cell-ref">
          <Label context={context} kind="stores" id={b.storeId} />
        </td>
      )}
      <td>
        <Quantity
          context={context}
          materialId={b.materialId}
          minor={b.quantity}
        />
      </td>
      <td>
        {m?.values.reorderLevel ? (
          <span className="mono">
            {m.values.reorderLevel} {m.values.unit}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        {low ? (
          <Pill tone="red" dot>
            Reorder
          </Pill>
        ) : b.quantity === 0 ? (
          <Pill tone="gray">Empty</Pill>
        ) : (
          <Pill tone="green" dot>
            In stock
          </Pill>
        )}
      </td>
      <td className="muted small">
        {b.updatedAt ? formatInstant(b.updatedAt.toDate()) : ''}
      </td>
    </tr>
  );
}
function BalanceTable({
  context,
  filter,
  hide,
}: {
  context: Context;
  filter?: { key: string; value: string };
  hide?: 'store' | 'material';
}) {
  const [rows, setRows] = useState<Balance[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  const key = filter?.key,
    value = filter?.value;
  useEffect(() => {
    let live = true;
    setBusy(true);
    listBalances(
      context.services.db,
      context.company.companyId,
      key ? { key, value: value || '' } : undefined,
    )
      .then((r) => {
        if (!live) return;
        setRows(r.rows);
        setCursor(r.cursor);
        setMore(r.hasMore);
        setError('');
      })
      .catch((e) => {
        if (!live) return;
        setPending(pendingFor(e));
        setError(friendly(e));
      })
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [context, key, value]);
  if (pending) return <Pending what="Stock balances" />;
  return (
    <>
      {error && <Banner tone="red">{error}</Banner>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {hide !== 'material' && <th>Material</th>}
                {hide !== 'store' && <th>Store</th>}
                <th>On hand</th>
                <th>Reorder level</th>
                <th>Status</th>
                <th>Last movement</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => (
                <BalanceRow
                  key={b.id}
                  context={context}
                  b={b}
                  i={i}
                  hide={hide}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {busy && <Skeleton rows={3} />}
      {!busy && !error && !rows.length && (
        <Empty icon={BarChart3} title="No stock recorded yet">
          Balances appear after you post opening stock or a receipt in Stock
          transactions.
        </Empty>
      )}
      {more && (
        <div className="list-foot">
          <span>Showing {rows.length}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={async () => {
              const r = await listBalances(
                context.services.db,
                context.company.companyId,
                key ? { key, value: value || '' } : undefined,
                cursor,
              );
              setRows((v) => [...v, ...r.rows]);
              setCursor(r.cursor);
              setMore(r.hasMore);
            }}
          >
            Load more
          </button>
        </div>
      )}
    </>
  );
}
export function StockForRecord({
  context,
  kind,
  record,
}: {
  context: Context;
  kind: 'materials' | 'stores';
  record: Operation;
}) {
  return (
    <BalanceTable
      context={context}
      filter={{
        key: kind === 'materials' ? 'materialId' : 'storeId',
        value: record.id,
      }}
      hide={kind === 'materials' ? 'material' : 'store'}
    />
  );
}
export function BalancesPage({ context }: { context: Context }) {
  const [by, setBy] = useState<'all' | 'store' | 'material'>('all'),
    [store, setStore] = useState(''),
    [material, setMaterial] = useState('');
  const filter =
    by === 'store' && store
      ? { key: 'storeId', value: store }
      : by === 'material' && material
        ? { key: 'materialId', value: material }
        : undefined;
  return (
    <section className="card card-pad rise">
      <div className="toolbar">
        <Segmented
          label="View balances by"
          value={by}
          onChange={setBy}
          options={[
            { value: 'all', label: 'All balances' },
            { value: 'store', label: 'By store' },
            { value: 'material', label: 'By material' },
          ]}
        />
        {by === 'store' && (
          <div style={{ minWidth: 260 }}>
            <Picker
              context={context}
              kind="stores"
              label="Store"
              value={store}
              onChange={setStore}
            />
          </div>
        )}
        {by === 'material' && (
          <div style={{ minWidth: 260 }}>
            <Picker
              context={context}
              kind="materials"
              label="Material"
              value={material}
              onChange={setMaterial}
            />
          </div>
        )}
      </div>
      <Banner tone="blue">
        Balances are calculated only from posted transactions and cannot be
        edited directly. Reorder flags compare each store’s balance with the
        material’s reorder level.
      </Banner>
      <div style={{ height: 8 }} />
      <BalanceTable
        key={JSON.stringify(filter)}
        context={context}
        filter={filter}
        hide={
          by === 'store' && store
            ? 'store'
            : by === 'material' && material
              ? 'material'
              : undefined
        }
      />
    </section>
  );
}
const typeIcon: Record<MovementType, typeof Plus> = {
  opening: PackageOpen,
  receipt: ArrowDownLeft,
  issue: ArrowUpRight,
  transfer: Repeat,
  adjustment_in: SlidersHorizontal,
  adjustment_out: SlidersHorizontal,
  reversal: Undo2,
};
const typeTone = (t: MovementType) =>
  t === 'issue' || t === 'adjustment_out'
    ? 'red'
    : t === 'transfer'
      ? 'violet'
      : t === 'reversal'
        ? 'amber'
        : 'green';
export function PostMovementDrawer({
  context,
  onClose,
  onDone,
  initialType = 'receipt',
}: {
  context: Context;
  onClose: () => void;
  onDone: () => void;
  initialType?: Exclude<MovementType, 'reversal'>;
}) {
  const [type, setType] =
    useState<Exclude<MovementType, 'reversal'>>(initialType);
  const [v, setV] = useState({
    materialId: '',
    fromStoreId: '',
    toStoreId: '',
    quantity: '',
    movementDate: today(),
    reason: '',
    reference: '',
    notes: '',
    issuedToEmployeeId: '',
    issuedToLocationId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  // One idempotency key per open form: a retried submit can never post twice.
  const movementId = useMemo(
    () => newMovementId(context.services.db, context.company.companyId),
    [context],
  );
  const material = useMaterial(context, v.materialId);
  const toast = useToast();
  const id = useId();
  const sides = movementSides[type];
  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!v.materialId) errs.materialId = 'Choose a material';
    if (sides.from && !v.fromStoreId)
      errs.fromStoreId = 'Choose the source store';
    if (sides.to && !v.toStoreId)
      errs.toStoreId = 'Choose the destination store';
    if (sides.from && sides.to && v.fromStoreId === v.toStoreId)
      errs.toStoreId = 'Choose a different store';
    const q = material
      ? parseQuantity(v.quantity, unitDecimals(material.values.unit))
      : null;
    if (!q || !q.ok || q.minor <= 0)
      errs.quantity =
        q && !q.ok ? q.error : 'Enter a quantity greater than zero';
    if (type.startsWith('adjustment') && !v.reason.trim())
      errs.reason = 'Explain the adjustment';
    setErrors(errs);
    if (Object.keys(errs).length || !q || !q.ok) return;
    setBusy(true);
    setError('');
    const input: MovementInput = {
      movementType: type,
      materialId: v.materialId,
      fromStoreId: sides.from ? v.fromStoreId : '',
      toStoreId: sides.to ? v.toStoreId : '',
      quantity: q.minor,
      movementDate: v.movementDate,
      reason: v.reason.trim(),
      reference: v.reference.trim(),
      notes: v.notes,
      issuedToEmployeeId: type === 'issue' ? v.issuedToEmployeeId : '',
      issuedToLocationId: type === 'issue' ? v.issuedToLocationId : '',
      reversesId: '',
    };
    try {
      await postMovement(
        context.services.db,
        context.company.companyId,
        context.uid,
        input,
        movementId,
      );
      toast(`${movementLabels[type]} posted.`);
      onDone();
    } catch (e) {
      if (e instanceof AlreadyPostedError) {
        toast(e.message, 'blue');
        onDone();
      } else setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  const storeSite = useLabel(
    context,
    'stores',
    sides.from ? v.fromStoreId : v.toStoreId,
  );
  void storeSite;
  return (
    <Drawer
      title="New stock transaction"
      subtitle="Posted transactions are permanent. Correct mistakes with a reversal."
      icon={<IconCircle icon={Receipt} tone="blue" />}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <span className="note">Reference {movementId.slice(0, 8)}</span>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form={id}
            className="btn btn-primary"
            disabled={busy}
          >
            <Save />
            {busy ? 'Posting…' : `Post ${movementLabels[type].toLowerCase()}`}
          </button>
        </>
      }
    >
      <form id={id} onSubmit={(e) => void submit(e)} noValidate>
        <section className="form-section">
          <h3>
            <span className="num">1</span>Transaction type
          </h3>
          <Segmented
            label="Transaction type"
            value={type}
            onChange={(t) => {
              setType(t);
              setErrors({});
            }}
            options={(
              Object.keys(movementSides) as Exclude<MovementType, 'reversal'>[]
            ).map((t) => ({ value: t, label: movementLabels[t] }))}
          />
          <p className="muted small" style={{ marginTop: 10 }}>
            {type === 'opening'
              ? 'Records the first balance of a material in a store. Allowed once per store and material.'
              : type === 'receipt'
                ? 'Adds stock received from a supplier or another source.'
                : type === 'issue'
                  ? 'Removes stock consumed or handed out. Stock can never go below zero.'
                  : type === 'transfer'
                    ? 'Moves stock between two stores in one step.'
                    : 'Corrects a counted difference. A reason is required.'}
          </p>
        </section>
        <section className="form-section">
          <h3>
            <span className="num">2</span>Material & stores
          </h3>
          <div className="form-grid">
            <Field label="Material" required error={errors.materialId} wide>
              <Picker
                context={context}
                kind="materials"
                label="Material"
                value={v.materialId}
                invalid={!!errors.materialId}
                onChange={(x) => setV({ ...v, materialId: x })}
              />
            </Field>
            {sides.from && (
              <Field
                label={type === 'transfer' ? 'From store' : 'Store'}
                required
                error={errors.fromStoreId}
              >
                <Picker
                  context={context}
                  kind="stores"
                  label="Source store"
                  value={v.fromStoreId}
                  invalid={!!errors.fromStoreId}
                  onChange={(x) => setV({ ...v, fromStoreId: x })}
                />
              </Field>
            )}
            {sides.to && (
              <Field
                label={type === 'transfer' ? 'To store' : 'Store'}
                required
                error={errors.toStoreId}
              >
                <Picker
                  context={context}
                  kind="stores"
                  label="Destination store"
                  value={v.toStoreId}
                  exclude={v.fromStoreId}
                  invalid={!!errors.toStoreId}
                  onChange={(x) => setV({ ...v, toStoreId: x })}
                />
              </Field>
            )}
            <Field
              label="Quantity"
              required
              error={errors.quantity}
              help={
                material
                  ? `Up to ${unitDecimals(material.values.unit)} decimal places for ${units[material.values.unit]?.label || material.values.unit}.`
                  : 'Choose a material first.'
              }
            >
              <div className="input-suffix">
                <input
                  className="input"
                  aria-label="Quantity"
                  inputMode="decimal"
                  value={v.quantity}
                  disabled={!material}
                  aria-invalid={!!errors.quantity}
                  onChange={(e) => setV({ ...v, quantity: e.target.value })}
                />
                {material && <span>{material.values.unit}</span>}
              </div>
            </Field>
            {(sides.from || sides.to) &&
              v.materialId &&
              (sides.from ? v.fromStoreId : v.toStoreId) && (
                <Field label="Current balance">
                  <CurrentBalance
                    context={context}
                    storeId={sides.from ? v.fromStoreId : v.toStoreId}
                    materialId={v.materialId}
                  />
                </Field>
              )}
          </div>
        </section>
        <section className="form-section">
          <h3>
            <span className="num">3</span>Details
          </h3>
          <div className="form-grid">
            <Field label="Date" required>
              <input
                className="input"
                type="date"
                aria-label="Date"
                value={v.movementDate}
                onChange={(e) => setV({ ...v, movementDate: e.target.value })}
              />
            </Field>
            <Field
              label="Reference"
              help="GRN, delivery note or request number."
            >
              <input
                className="input"
                aria-label="Reference"
                maxLength={120}
                value={v.reference}
                onChange={(e) => setV({ ...v, reference: e.target.value })}
              />
            </Field>
            {type === 'issue' && (
              <>
                <Field label="Issued to employee">
                  <Picker
                    context={context}
                    kind="employees"
                    label="Employee"
                    value={v.issuedToEmployeeId}
                    onChange={(x) => setV({ ...v, issuedToEmployeeId: x })}
                  />
                </Field>
                <Field label="Used at location">
                  <Picker
                    context={context}
                    kind="locations"
                    label="Location"
                    value={v.issuedToLocationId}
                    onChange={(x) => setV({ ...v, issuedToLocationId: x })}
                  />
                </Field>
              </>
            )}
            <Field
              label="Reason"
              required={type.startsWith('adjustment')}
              error={errors.reason}
              wide
            >
              <input
                className="input"
                aria-label="Reason"
                maxLength={500}
                value={v.reason}
                aria-invalid={!!errors.reason}
                onChange={(e) => setV({ ...v, reason: e.target.value })}
              />
            </Field>
            <Field label="Notes" wide>
              <textarea
                className="input"
                aria-label="Notes"
                rows={3}
                value={v.notes}
                onChange={(e) => setV({ ...v, notes: e.target.value })}
              />
            </Field>
          </div>
        </section>
        {error && (
          <Banner tone="red" role="alert">
            {error}
          </Banner>
        )}
      </form>
    </Drawer>
  );
}
function CurrentBalance({
  context,
  storeId,
  materialId,
}: {
  context: Context;
  storeId: string;
  materialId: string;
}) {
  const [q, setQ] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() =>
      getDoc(
        doc(
          context.services.db,
          'companies',
          context.company.companyId,
          'stockBalances',
          balanceId(storeId, materialId),
        ),
      )
        .then(
          (s) => live && setQ(s.exists() ? (s.data().quantity as number) : 0),
        )
        .catch(() => live && setQ(null)),
    );
    return () => {
      live = false;
    };
  }, [context, storeId, materialId]);
  return (
    <div
      className="input"
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--surface-2)',
      }}
    >
      {q === null ? (
        '…'
      ) : (
        <Quantity context={context} materialId={materialId} minor={q} />
      )}
    </div>
  );
}
export function MovementsPage({ context }: { context: Context }) {
  const [rows, setRows] = useState<Movement[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false),
    [version, setVersion] = useState(0),
    [type, setType] = useState(''),
    [posting, setPosting] = useState(false),
    [reverse, setReverse] = useState<Movement>(),
    [reversing, setReversing] = useState(false);
  const toast = useToast();
  useEffect(() => {
    let live = true;
    setBusy(true);
    listMovements(
      context.services.db,
      context.company.companyId,
      type ? { key: 'movementType', value: type } : undefined,
    )
      .then((r) => {
        if (!live) return;
        setRows(r.rows);
        setCursor(r.cursor);
        setMore(r.hasMore);
        setError('');
      })
      .catch((e) => {
        if (!live) return;
        setPending(pendingFor(e));
        setError(friendly(e));
      })
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [context, version, type]);
  async function doReverse() {
    if (!reverse) return;
    setReversing(true);
    try {
      await postMovement(
        context.services.db,
        context.company.companyId,
        context.uid,
        reversalOf(
          reverse,
          today(),
          'Reversal of ' + (reverse.reference || reverse.id.slice(0, 8)),
        ),
        reversalId(reverse.id),
      );
      toast('Transaction reversed.');
      setVersion((v) => v + 1);
    } catch (e) {
      toast(friendly(e), 'red');
    } finally {
      setReversing(false);
      setReverse(undefined);
    }
  }
  return (
    <section className="card card-pad rise">
      <div className="toolbar">
        <select
          className="select"
          aria-label="Transaction type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All transaction types</option>
          {(Object.keys(movementLabels) as MovementType[]).map((t) => (
            <option key={t} value={t}>
              {movementLabels[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-btn"
          aria-label="Refresh"
          onClick={() => setVersion((v) => v + 1)}
        >
          <RefreshCw />
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginLeft: 'auto' }}
          disabled={pending}
          onClick={() => setPosting(true)}
        >
          <Plus />
          New transaction
        </button>
      </div>
      {pending ? (
        <Pending what="Stock transactions" />
      ) : error ? (
        <Banner tone="red">{error}</Banner>
      ) : null}
      {!pending && rows.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Material</th>
                <th>Store</th>
                <th>Quantity</th>
                <th>Date</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const Icon = typeIcon[m.movementType];
                const reversed = rows.some((x) => x.reversesId === m.id);
                return (
                  <tr key={m.id} style={{ ['--i' as string]: i }}>
                    <td>
                      <div className="cell-main">
                        <span
                          className={`icon-circle tone-${typeTone(m.movementType)}`}
                          style={{ width: 38, height: 38 }}
                        >
                          <Icon size={17} />
                        </span>
                        <div>
                          <div className="t">
                            {movementLabels[m.movementType]}
                          </div>
                          <div className="s">
                            {m.reference || m.reason || (
                              <span className="code-chip">
                                {m.id.slice(0, 8)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="cell-ref">
                      <Label
                        context={context}
                        kind="materials"
                        id={m.materialId}
                      />
                    </td>
                    <td className="cell-ref">
                      {m.fromStoreId && (
                        <Label
                          context={context}
                          kind="stores"
                          id={m.fromStoreId}
                        />
                      )}
                      {m.fromStoreId && m.toStoreId && ' → '}
                      {m.toStoreId && (
                        <Label
                          context={context}
                          kind="stores"
                          id={m.toStoreId}
                        />
                      )}
                    </td>
                    <td>
                      <Quantity
                        context={context}
                        materialId={m.materialId}
                        minor={m.quantity}
                        signed={
                          m.fromStoreId && m.toStoreId
                            ? undefined
                            : m.toStoreId
                              ? 1
                              : -1
                        }
                      />
                    </td>
                    <td>{formatDate(m.movementDate)}</td>
                    <td>
                      {m.movementType !== 'reversal' && !reversed ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setReverse(m)}
                        >
                          <Undo2 />
                          Reverse
                        </button>
                      ) : (
                        <Pill tone="gray">
                          {m.movementType === 'reversal'
                            ? 'Correction'
                            : 'Reversed'}
                        </Pill>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {busy && <Skeleton rows={3} />}
      {!busy && !error && !rows.length && (
        <Empty
          icon={Receipt}
          title="No stock transactions yet"
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setPosting(true)}
            >
              <Plus />
              Record opening stock
            </button>
          }
        >
          Start by recording opening stock for each material in each store.
        </Empty>
      )}
      {more && (
        <div className="list-foot">
          <span>Showing {rows.length}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={async () => {
              const r = await listMovements(
                context.services.db,
                context.company.companyId,
                type ? { key: 'movementType', value: type } : undefined,
                cursor,
              );
              setRows((v) => [...v, ...r.rows]);
              setCursor(r.cursor);
              setMore(r.hasMore);
            }}
          >
            Load more
          </button>
        </div>
      )}
      {posting && (
        <PostMovementDrawer
          context={context}
          initialType={rows.length ? 'receipt' : 'opening'}
          onClose={() => setPosting(false)}
          onDone={() => {
            setPosting(false);
            setVersion((v) => v + 1);
          }}
        />
      )}
      {reverse && (
        <ConfirmDialog
          title="Reverse this transaction?"
          confirmLabel="Post reversal"
          tone="blue"
          busy={reversing}
          onCancel={() => setReverse(undefined)}
          onConfirm={() => void doReverse()}
        >
          A new correcting transaction will be posted with the opposite effect.
          The original stays in the ledger. Each transaction can be reversed
          once.
        </ConfirmDialog>
      )}
    </section>
  );
}
export { definitions };
