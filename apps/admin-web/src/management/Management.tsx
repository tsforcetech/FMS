import { useEffect, useState, useId, type FormEvent } from 'react';
import {
  collection,
  doc,
  getDocs,
  getCountFromServer,
  orderBy,
  limit,
  query,
  updateDoc,
  serverTimestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  definitions,
  fieldsFor,
  statuses,
  defaultValues,
  inputSchema,
  companySchema,
  type Kind,
  type Values,
  type Operation,
  type Company,
} from '@facilityos/shared';
import type { FirebaseServices } from '../firebase';
import { listRecords, recordById, countRecords, saveRecord } from './store';
import './management.css';
type Context = { services: FirebaseServices; company: Company; uid: string };
const display = (v: string) => v.replaceAll('_', ' ');
function failure(e: unknown) {
  return e instanceof Error
    ? e.message.includes('permission')
      ? 'This change is not permitted. Check active references and your company access.'
      : e.message
    : 'Unable to complete this request.';
}
function useDebounce(value: string) {
  const [result, setResult] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), 250);
    return () => clearTimeout(timer);
  }, [value]);
  return result;
}
function Selector({
  context,
  kind,
  value,
  onChange,
  label,
  filter,
  exclude,
}: {
  context: Context;
  kind: Kind;
  value: string;
  onChange: (v: string) => void;
  label: string;
  filter?: { key: string; value: string };
  exclude?: string;
}) {
  const [search, setSearch] = useState(''),
    [rows, setRows] = useState<Operation[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const term = useDebounce(search),
    id = useId();
  const filterKey = filter?.key,
    filterValue = filter?.value;
  useEffect(() => {
    let active = true;
    if (!value) return;
    recordById(context.services.db, context.company.companyId, kind, value)
      .then((r) => {
        if (active)
          setSelected(
            r ? `${r.values.code} · ${r.values.name}` : 'Unavailable record',
          );
      })
      .catch((e) => {
        if (active) setError(failure(e));
      });
    return () => {
      active = false;
    };
  }, [value, kind, context.services.db, context.company.companyId]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    listRecords(
      context.services.db,
      context.company.companyId,
      kind,
      term,
      '',
      undefined,
      filterKey !== undefined
        ? { key: filterKey, value: filterValue || '' }
        : undefined,
    )
      .then((r) => {
        if (active) {
          setRows(r.rows);
          setCursor(r.cursor);
          setMore(r.hasMore);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(failure(e));
      });
    return () => {
      active = false;
    };
  }, [
    open,
    term,
    kind,
    filterKey,
    filterValue,
    context.services.db,
    context.company.companyId,
  ]);
  async function moreRows() {
    setBusy(true);
    try {
      const r = await listRecords(
        context.services.db,
        context.company.companyId,
        kind,
        term,
        '',
        cursor,
        filter,
      );
      setRows((v) => [...v, ...r.rows]);
      setCursor(r.cursor);
      setMore(r.hasMore);
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="reference-picker">
      <button
        type="button"
        className="input"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {value
          ? selected || 'Loading selection…'
          : `Choose ${label.toLowerCase()}`}{' '}
        ▾
      </button>
      {open && (
        <div id={id} className="picker-panel">
          <label>
            Search {label.toLowerCase()}
            <input
              autoFocus
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name starts with…"
            />
          </label>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            Clear selection
          </button>
          {rows
            .filter((r) => r.id !== exclude && r.values.status !== 'archived')
            .map((r) => (
              <button
                type="button"
                className="picker-option"
                key={r.id}
                onClick={() => {
                  onChange(r.id);
                  setSelected(`${r.values.code} · ${r.values.name}`);
                  setOpen(false);
                }}
              >
                {r.values.name}
                <small>{r.values.code}</small>
              </button>
            ))}
          {!rows.length && (
            <p>
              No matching records. Create one in {definitions[kind].title}{' '}
              first.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          {more && (
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => void moreRows()}
            >
              More results
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function Editor({
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
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Values>(
      record?.values || { ...defaultValues(kind), ...initial },
    ),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const formId = useId();
  function change(key: string, value: string) {
    setValues((v) => ({
      ...v,
      [key]: value,
      ...(key === 'siteId'
        ? { ...(kind === 'locations' ? { parentId: '' } : { locationId: '' }) }
        : {}),
    }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = inputSchema(kind).safeParse(values);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
        ),
      );
      return;
    }
    setErrors({});
    setBusy(true);
    setError('');
    try {
      await saveRecord(
        context.services.db,
        context.company.companyId,
        context.uid,
        kind,
        parsed.data,
        record,
      );
      onSaved();
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  const renderField = (f: ReturnType<typeof fieldsFor>[number]) => (
    <div
      className={'field ' + (f.type === 'textarea' ? 'wide' : '')}
      key={f.key}
    >
      <label htmlFor={formId + f.key}>
        {f.label}
        {f.required ? ' *' : ''}
      </label>
      {f.key === 'workingDays' ? (
        <div className="working-days">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={values.workingDays.split(',').includes(day)}
                onChange={(e) =>
                  change(
                    'workingDays',
                    e.target.checked
                      ? [
                          ...values.workingDays.split(',').filter(Boolean),
                          day,
                        ].join(',')
                      : values.workingDays
                          .split(',')
                          .filter((d) => d !== day)
                          .join(','),
                  )
                }
              />
              {day}
            </label>
          ))}
        </div>
      ) : f.reference && record && kind === 'contractAllocations' ? (
        <p>
          <ReferenceLabel
            context={context}
            kind={f.reference}
            id={values[f.key]}
          />
        </p>
      ) : f.reference ? (
        <Selector
          context={context}
          kind={f.reference}
          value={values[f.key]}
          label={f.label}
          exclude={f.key === 'parentId' ? record?.id : undefined}
          filter={
            f.reference === 'locations'
              ? { key: 'siteId', value: values.siteId }
              : undefined
          }
          onChange={(v) => change(f.key, v)}
        />
      ) : f.options ? (
        <select
          id={formId + f.key}
          className="input"
          disabled={
            !!record &&
            kind === 'contractAllocations' &&
            f.key === 'allocationType'
          }
          value={values[f.key]}
          onChange={(e) => change(f.key, e.target.value)}
        >
          {f.options.map((v) => (
            <option key={v} value={v}>
              {display(v)}
            </option>
          ))}
        </select>
      ) : f.type === 'textarea' ? (
        <textarea
          id={formId + f.key}
          className="input"
          rows={3}
          maxLength={2000}
          value={values[f.key]}
          onChange={(e) => change(f.key, e.target.value)}
        />
      ) : (
        <input
          id={formId + f.key}
          className="input"
          type={f.type || 'text'}
          value={values[f.key]}
          maxLength={f.max || 200}
          disabled={
            !!record &&
            (f.key === 'code' ||
              (kind === 'contractAllocations' &&
                ['startDate', 'endDate'].includes(f.key)))
          }
          onChange={(e) =>
            change(
              f.key,
              f.key === 'code' ? e.target.value.toUpperCase() : e.target.value,
            )
          }
        />
      )}{' '}
      {errors[f.key] && <small role="alert">{errors[f.key]}</small>}
    </div>
  );
  return (
    <section className="card management-editor">
      <div className="management-toolbar">
        <div>
          <span className="eyebrow">
            {record ? 'UPDATE RECORD' : 'NEW RECORD'}
          </span>
          <h2>
            {record ? 'Edit' : 'Add'} {definitions[kind].singular}
          </h2>
        </div>
        <button className="btn secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
      <p>
        Fields marked * are required. Codes stay reserved, including after
        archive.
      </p>
      {kind === 'sites' && (
        <p>
          Sites are physical properties. Client and contract coverage is managed
          through Contract allocations.
        </p>
      )}
      {kind === 'sites' && record?.legacyLinks && (
        <p role="status">
          Legacy client links are preserved for migration review. Editing this
          site does not remove or change them.
        </p>
      )}
      {kind === 'contractAllocations' && (
        <>
          <p>
            Service coverage may cover a whole site. Occupancy requires a space
            and dates within one calendar year. Each space/year supports up to
            12 retained bookings. Shared occupancy has no capacity cap, but
            cannot overlap an exclusive booking.
          </p>
          <p>
            Dates are inclusive. Termination releases dates after the effective
            termination date. Identity and planned dates cannot be edited;
            create a replacement allocation.
          </p>
          {values.contractId && (
            <DerivedClient context={context} contractId={values.contractId} />
          )}
        </>
      )}
      <form onSubmit={(e) => void submit(e)} noValidate>
        <fieldset disabled={busy}>
          <legend>Basic information</legend>
          <div className="management-form">
            {fieldsFor(kind)
              .filter(
                (f) =>
                  ['code', 'name', 'status'].includes(f.key) || f.reference,
              )
              .map(renderField)}
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Details</legend>
          <div className="management-form">
            {fieldsFor(kind)
              .filter(
                (f) =>
                  !['code', 'name', 'status'].includes(f.key) && !f.reference,
              )
              .map(renderField)}
          </div>
        </fieldset>
        {kind === 'locations' && values.parentId && (
          <Breadcrumb context={context} id={values.parentId} />
        )}{' '}
        {error && (
          <p role="alert" className="management-error">
            {error}
          </p>
        )}
        <button className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Save ' + definitions[kind].singular}
        </button>
      </form>
    </section>
  );
}
function Breadcrumb({ context, id }: { context: Context; id: string }) {
  const [label, setLabel] = useState('Loading location path…');
  useEffect(() => {
    let active = true;
    (async () => {
      let current = id;
      const seen = new Set<string>(),
        names: string[] = [];
      while (current && names.length < 30) {
        if (seen.has(current)) throw new Error('Invalid location hierarchy');
        seen.add(current);
        const r = await recordById(
          context.services.db,
          context.company.companyId,
          'locations',
          current,
        );
        if (!r) break;
        names.unshift(r.values.name);
        current = r.values.parentId;
      }
      if (active) setLabel(names.join(' / '));
    })().catch((e) => {
      if (active) setLabel(failure(e));
    });
    return () => {
      active = false;
    };
  }, [context.services.db, context.company.companyId, id]);
  return <p className="breadcrumb">Location: {label}</p>;
}
function SummaryCounts({
  context,
  kind,
  record,
}: {
  context: Context;
  kind: Kind;
  record: Operation;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({}),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const requests: [Kind, string][] =
      kind === 'clients'
        ? [['contracts', 'clientId']]
        : kind === 'contracts'
          ? [['contractAllocations', 'contractId']]
          : kind === 'sites'
            ? [
                ['locations', 'siteId'],
                ['facilities', 'siteId'],
                ['contractAllocations', 'siteId'],
              ]
            : kind === 'locations'
              ? [['facilities', 'locationId']]
              : kind === 'facilityTypes'
                ? [['facilities', 'typeId']]
                : [];
    Promise.all(
      requests.map(
        async ([k, key]) =>
          [
            definitions[k].title,
            await countRecords(
              context.services.db,
              context.company.companyId,
              k,
              key,
              record.id,
            ),
          ] as const,
      ),
    )
      .then((r) => {
        if (active) setCounts(Object.fromEntries(r));
      })
      .catch((e) => {
        if (active) setError(failure(e));
      });
    return () => {
      active = false;
    };
  }, [
    context.services.db,
    context.company.companyId,
    kind,
    record.id,
    record.revision,
  ]);
  return (
    <div className="management-counts">
      {Object.entries(counts).map(([k, v]) => (
        <div key={k}>
          <strong>{v}</strong>
          <span>{k} · includes archived</span>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function History({ context, id }: { context: Context; id: string }) {
  const [rows, setRows] = useState<Values[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getDocs(
      query(
        collection(
          context.services.db,
          'companies',
          context.company.companyId,
          'facilities',
          id,
          'history',
        ),
        orderBy('revision', 'desc'),
        limit(20),
      ),
    )
      .then((r) => {
        if (active)
          setRows(
            r.docs.map((s) => {
              const d = s.data();
              return {
                revision: String(d.revision),
                condition: d.condition,
                status: d.status,
                date: d.occurredAt.toDate().toLocaleString(),
              };
            }),
          );
      })
      .catch((e) => {
        if (active) setError(failure(e));
      });
    return () => {
      active = false;
    };
  }, [context.services.db, context.company.companyId, id]);
  return (
    <section>
      <h3>Condition & status history</h3>
      <p className="muted">
        Latest 20 recorded updates. These are user-attributed changes, not an
        independent compliance audit.
      </p>
      {rows.map((r) => (
        <p key={r.revision}>
          #{r.revision} · {r.condition} · {display(r.status)} · {r.date}
        </p>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
function DerivedClient({
  context,
  contractId,
}: {
  context: Context;
  contractId: string;
}) {
  const [client, setClient] = useState('');
  useEffect(() => {
    let active = true;
    recordById(
      context.services.db,
      context.company.companyId,
      'contracts',
      contractId,
    ).then((r) => {
      if (active) setClient(r?.values.clientId || '');
    });
    return () => {
      active = false;
    };
  }, [context.services.db, context.company.companyId, contractId]);
  return (
    <p>
      Client derived from contract:{' '}
      {client ? (
        <ReferenceLabel context={context} kind="clients" id={client} />
      ) : (
        'Loading…'
      )}
    </p>
  );
}
function AllocationHistory({ context, id }: { context: Context; id: string }) {
  const [rows, setRows] = useState<
      { revision: number; status: string; date: string; end: string }[]
    >([]),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getDocs(
      query(
        collection(
          context.services.db,
          'companies',
          context.company.companyId,
          'contractAllocations',
          id,
          'history',
        ),
        orderBy('revision', 'desc'),
        limit(20),
      ),
    )
      .then((s) => {
        if (active)
          setRows(
            s.docs.map((x) => {
              const d = x.data();
              return {
                revision: d.revision,
                status: d.snapshot.status,
                date: d.occurredAt.toDate().toLocaleString(),
                end: d.snapshot.effectiveEndDate || d.snapshot.endDate,
              };
            }),
          );
      })
      .catch((e) => {
        if (active) setError(failure(e));
      });
    return () => {
      active = false;
    };
  }, [context.services.db, context.company.companyId, id]);
  return (
    <section>
      <h3>Allocation history</h3>
      <p>Latest 20 decisions. Earlier events remain preserved.</p>
      {rows.map((r) => (
        <p key={r.revision}>
          Revision {r.revision} · {r.status} · through {r.end} · {r.date}
        </p>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
function ReferenceLabel({
  context,
  kind,
  id,
}: {
  context: Context;
  kind: Kind;
  id: string;
}) {
  const [label, setLabel] = useState('Loading…');
  useEffect(() => {
    let active = true;
    recordById(context.services.db, context.company.companyId, kind, id)
      .then((r) => {
        if (active)
          setLabel(r ? `${r.values.name} (${r.values.code})` : 'Unavailable');
      })
      .catch(() => {
        if (active) setLabel('Unable to load');
      });
    return () => {
      active = false;
    };
  }, [context.services.db, context.company.companyId, kind, id]);
  return <>{label}</>;
}
function Details({
  context,
  kind,
  record,
  onClose,
  onEdit,
  onAddChild,
}: {
  context: Context;
  kind: Kind;
  record: Operation;
  onClose: () => void;
  onEdit: () => void;
  onAddChild: () => void;
}) {
  const [tab, setTab] = useState('Overview');
  const [treeVersion, setTreeVersion] = useState(0);
  const site = kind === 'sites',
    location = kind === 'locations';
  const tabs = site
    ? [
        'Overview',
        'Locations',
        'Facilities',
        'Contract allocations',
        'Related Assets',
        'Task Operations',
        'Maintenance',
      ]
    : ['Overview'];
  return (
    <section className="card management-details">
      <div className="management-toolbar">
        <div>
          <span className="eyebrow">{record.values.code}</span>
          <h2>{record.values.name}</h2>
        </div>
        <div className="management-actions">
          {location && (
            <button className="btn secondary" onClick={onAddChild}>
              Add child location
            </button>
          )}
          <button className="btn secondary" onClick={onEdit}>
            Edit
          </button>
          <button className="btn secondary" onClick={onClose}>
            Back to list
          </button>
        </div>
      </div>
      {site && (
        <nav className="management-tabs" aria-label="Site details">
          {tabs.map((t) => (
            <button
              key={t}
              className={'btn ' + (tab === t ? '' : 'secondary')}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
      )}
      {tab === 'Overview' ? (
        <>
          <SummaryCounts context={context} kind={kind} record={record} />
          <dl className="management-definition">
            {fieldsFor(kind).map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>
                  {record.values[f.key] ? (
                    f.reference ? (
                      <ReferenceLabel
                        context={context}
                        kind={f.reference}
                        id={record.values[f.key]}
                      />
                    ) : (
                      display(record.values[f.key])
                    )
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted">
            Created {record.createdAt.toDate().toLocaleString()} · Last updated{' '}
            {record.updatedAt.toDate().toLocaleString()} · Revision{' '}
            {record.revision}
          </p>
          {location && <Breadcrumb context={context} id={record.id} />}{' '}
          {kind === 'clients' && (
            <RecordList
              context={context}
              kind="contracts"
              filter={{ key: 'clientId', value: record.id }}
              initial={{ clientId: record.id }}
            />
          )}
          {kind === 'contracts' && (
            <RecordList
              context={context}
              kind="contractAllocations"
              filter={{ key: 'contractId', value: record.id }}
              initial={{
                contractId: record.id,
              }}
            />
          )}
          {kind === 'contractAllocations' && (
            <>
              <p>
                Client at allocation:{' '}
                <ReferenceLabel
                  context={context}
                  kind="clients"
                  id={record.clientIdSnapshot!}
                />
              </p>
              <AllocationHistory context={context} id={record.id} />
            </>
          )}
          {kind === 'facilities' && (
            <>
              <Breadcrumb context={context} id={record.values.locationId} />
              <History context={context} id={record.id} />
              <p className="empty">
                Assets, inspections and maintenance history will be available in
                future phases.
              </p>
            </>
          )}
        </>
      ) : tab === 'Contract allocations' ? (
        <RecordList
          context={context}
          kind="contractAllocations"
          filter={{ key: 'siteId', value: record.id }}
          initial={{ siteId: record.id }}
        />
      ) : tab === 'Locations' ? (
        <>
          <LocationTree
            key={treeVersion}
            context={context}
            siteId={record.id}
          />
          <RecordList
            context={context}
            kind="locations"
            onChanged={() => setTreeVersion((v) => v + 1)}
            filter={{ key: 'siteId', value: record.id }}
            initial={{ siteId: record.id }}
          />
        </>
      ) : tab === 'Facilities' ? (
        <RecordList
          context={context}
          kind="facilities"
          filter={{ key: 'siteId', value: record.id }}
          initial={{ siteId: record.id }}
        />
      ) : (
        <p className="empty">
          {tab} will be available in a future phase. No records are collected
          yet.
        </p>
      )}
    </section>
  );
}
function LocationTree({
  context,
  siteId,
}: {
  context: Context;
  siteId: string;
}) {
  return (
    <section>
      <h3>Location hierarchy</h3>
      <p>
        Expand a location to browse its children. Use the list below to add or
        edit locations.
      </p>
      <TreeLevel context={context} siteId={siteId} parentId="" depth={0} />
    </section>
  );
}
function TreeLevel({
  context,
  siteId,
  parentId,
  depth,
}: {
  context: Context;
  siteId: string;
  parentId: string;
  depth: number;
}) {
  const [rows, setRows] = useState<Operation[]>([]),
    [open, setOpen] = useState<string[]>([]),
    [more, setMore] = useState(false),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
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
      .then((r) => {
        if (active) {
          setRows(r.rows);
          setCursor(r.cursor);
          setMore(r.hasMore);
        }
      })
      .catch((e) => {
        if (active) setError(failure(e));
      });
    return () => {
      active = false;
    };
  }, [context.services.db, context.company.companyId, parentId, siteId]);
  async function loadMore() {
    try {
      const r = await listRecords(
        context.services.db,
        context.company.companyId,
        'locations',
        '',
        '',
        cursor,
        { key: 'parentId', value: parentId || '__root__' },
        { key: 'siteId', value: siteId },
      );
      setRows((v) => [...v, ...r.rows]);
      setCursor(r.cursor);
      setMore(r.hasMore);
    } catch (e) {
      setError(failure(e));
    }
  }
  return (
    <ul className="location-tree">
      {rows
        .filter((r) => r.values.siteId === siteId)
        .map((r) => (
          <li key={r.id}>
            <button
              className="btn secondary"
              aria-expanded={open.includes(r.id)}
              onClick={() =>
                setOpen((v) =>
                  v.includes(r.id) ? v.filter((x) => x !== r.id) : [...v, r.id],
                )
              }
            >
              {open.includes(r.id) ? '−' : '+'} {r.values.name} ·{' '}
              {r.values.locationType}{' '}
              {r.values.status === 'archived' ? '(archived)' : ''}
            </button>
            {open.includes(r.id) && depth < 20 && (
              <TreeLevel
                context={context}
                siteId={siteId}
                parentId={r.id}
                depth={depth + 1}
              />
            )}
          </li>
        ))}
      {error && <li role="alert">{error}</li>}
      {more && (
        <li>
          <button className="btn secondary" onClick={() => void loadMore()}>
            More locations
          </button>
        </li>
      )}
      {!rows.length && !error && (
        <li className="muted">No locations at this level.</li>
      )}
    </ul>
  );
}
export function RecordList({
  context,
  kind,
  filter,
  initial,
  onChanged,
}: {
  context: Context;
  kind: Kind;
  onChanged?: () => void;
  filter?: { key: string; value: string };
  initial?: Values;
}) {
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [rows, setRows] = useState<Operation[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [version, setVersion] = useState(0),
    [mode, setMode] = useState<'list' | 'edit' | 'detail'>('list'),
    [selected, setSelected] = useState<Operation>(),
    [draftInitial, setDraftInitial] = useState(initial),
    [toast, setToast] = useState(''),
    [archive, setArchive] = useState<Operation>();
  const term = useDebounce(search);
  const filterKey = filter?.key,
    filterValue = filter?.value;
  useEffect(() => {
    let active = true;
    listRecords(
      context.services.db,
      context.company.companyId,
      kind,
      term,
      status,
      undefined,
      filterKey !== undefined
        ? { key: filterKey, value: filterValue || '' }
        : undefined,
    )
      .then((r) => {
        if (active) {
          setRows(r.rows);
          setCursor(r.cursor);
          setMore(r.hasMore);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(failure(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [
    context.services.db,
    context.company.companyId,
    kind,
    term,
    status,
    filterKey,
    filterValue,
    version,
  ]);
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
        filter,
      );
      setRows((v) => [...v, ...r.rows]);
      setCursor(r.cursor);
      setMore(r.hasMore);
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  function saved() {
    setMode('list');
    setSelected(undefined);
    setVersion((v) => v + 1);
    setBusy(true);
    setToast('Changes saved.');
    onChanged?.();
  }
  async function confirmArchive() {
    if (!archive) return;
    setBusy(true);
    try {
      await saveRecord(
        context.services.db,
        context.company.companyId,
        context.uid,
        kind,
        { ...archive.values, status: 'archived' },
        archive,
      );
      setArchive(undefined);
      saved();
    } catch (e) {
      setError(failure(e));
      setArchive(undefined);
    } finally {
      setBusy(false);
    }
  }
  if (mode === 'edit')
    return (
      <Editor
        context={context}
        kind={kind}
        record={selected}
        initial={draftInitial}
        onClose={() => setMode('list')}
        onSaved={saved}
      />
    );
  if (mode === 'detail' && selected)
    return (
      <Details
        context={context}
        kind={kind}
        record={selected}
        onClose={() => setMode('list')}
        onEdit={() => setMode('edit')}
        onAddChild={() => {
          setDraftInitial({
            siteId: selected.values.siteId,
            parentId: selected.id,
          });
          setSelected(undefined);
          setMode('edit');
        }}
      />
    );
  return (
    <section className="management-list">
      <div className="management-toolbar">
        <div>
          <h2>{definitions[kind].title}</h2>
          <p>
            Manage {definitions[kind].title.toLowerCase()} for{' '}
            {context.company.name}.
          </p>
        </div>
        <button
          className="btn"
          onClick={() => {
            setSelected(undefined);
            setDraftInitial(initial);
            setMode('edit');
          }}
        >
          Add {definitions[kind].singular}
        </button>
      </div>
      {toast && (
        <p role="status" className="management-success">
          {toast}
        </p>
      )}
      <div className="management-filters">
        <label>
          Search by name
          <input
            className="input"
            placeholder="Name starts with (case-sensitive)…"
            value={search}
            onChange={(e) => {
              setBusy(true);
              setSearch(e.target.value);
            }}
          />
        </label>
        <label>
          Status
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setBusy(true);
              setStatus(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            {statuses(kind).map((v) => (
              <option key={v} value={v}>
                {display(v)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn secondary"
          onClick={() => {
            setBusy(true);
            setVersion((v) => v + 1);
          }}
        >
          Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="management-error">
          {error}
        </p>
      )}
      {archive && (
        <div role="alertdialog" aria-label="Confirm archive" className="card">
          <h3>Archive {archive.values.name}?</h3>
          <p>
            Historical records and the business code are retained. Active linked
            records must be reassigned or archived first.
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() => void confirmArchive()}
          >
            Confirm archive
          </button>{' '}
          <button
            className="btn secondary"
            disabled={busy}
            onClick={() => setArchive(undefined)}
          >
            Cancel
          </button>
        </div>
      )}
      <div className="management-table">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Status</th>
              <th>Active links</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.values.code}</td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSelected(r);
                      setMode('detail');
                    }}
                  >
                    {r.values.name}
                  </button>
                </td>
                <td>
                  <span className={'status-badge ' + r.values.status}>
                    {display(r.values.status)}
                  </span>
                </td>
                <td>{r.refCount}</td>
                <td>
                  <div className="management-actions">
                    <button
                      className="btn secondary"
                      aria-label={'Edit ' + r.values.name}
                      onClick={() => {
                        setSelected(r);
                        setMode('edit');
                      }}
                    >
                      Edit
                    </button>
                    {r.values.status !== 'archived' && (
                      <button
                        className="btn secondary"
                        aria-label={'Archive ' + r.values.name}
                        onClick={() => setArchive(r)}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {busy && (
        <p role="status" className="management-skeleton">
          Loading records…
        </p>
      )}
      {!busy && !error && !rows.length && (
        <div className="card empty">
          <h3>No {definitions[kind].title.toLowerCase()} found</h3>
          <p>Add your first record or adjust the filters.</p>
        </div>
      )}
      {more && (
        <button
          className="btn secondary section-gap"
          disabled={busy}
          onClick={() => void next()}
        >
          Load next 20
        </button>
      )}
    </section>
  );
}
function CompanyProfile({ context }: { context: Context }) {
  const c = context.company;
  const [v, setV] = useState({
      name: c.name,
      timeZone: c.timeZone,
      contactEmail: c.contactEmail || '',
      contactPhone: c.contactPhone || '',
      address: c.address || '',
      country: c.country || '',
    }),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      companySchema.parse({ ...c, ...v });
      await updateDoc(doc(context.services.db, 'companies', c.companyId), {
        ...v,
        updatedAt: serverTimestamp(),
        updatedBy: context.uid,
      });
      setMessage('Company profile saved.');
    } catch (e) {
      setMessage(failure(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Company profile</h2>
      <p>
        {c.companyId} · {c.status} · Created{' '}
        {c.createdAt.toDate().toLocaleDateString()}
      </p>
      <p className="muted">
        Company logo uploads are planned for a future phase.
      </p>
      <form onSubmit={(e) => void submit(e)}>
        <div className="management-form">
          {Object.entries({
            name: 'Company name',
            timeZone: 'Time zone',
            contactEmail: 'Contact email',
            contactPhone: 'Contact phone',
            address: 'Address',
            country: 'Country',
          }).map(([k, label]) => (
            <label key={k}>
              {label}
              <input
                className="input"
                type={k === 'contactEmail' ? 'email' : 'text'}
                value={v[k as keyof typeof v]}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <p>
          Company ID, status, billing and membership roles are managed by the
          system administrator.
        </p>
        <button className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Save company profile'}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
export function Management({
  services,
  company,
  uid,
  section,
}: {
  services: FirebaseServices;
  company: Company;
  uid: string;
  section: string;
}) {
  const tabs: (Kind | 'company')[] =
    section === 'facilities'
      ? ['facilities', 'locations', 'facilityTypes']
      : section === 'settings'
        ? ['company']
        : ['clients', 'contracts', 'sites', 'contractAllocations', 'company'];
  const [tab, setTab] = useState<Kind | 'company'>(tabs[0]);
  const [site, setSite] = useState('');
  const context = { services, company, uid };
  return (
    <div className="management">
      <nav className="management-tabs" aria-label="Management modules">
        {tabs.map((k) => (
          <button
            key={k}
            className={'btn ' + (tab === k ? '' : 'secondary')}
            onClick={() => setTab(k)}
          >
            {k === 'company' ? 'Company profile' : definitions[k].title}
          </button>
        ))}
      </nav>
      {tab === 'company' ? (
        <CompanyProfile context={context} />
      ) : (
        <>
          {['locations', 'facilities'].includes(tab) && (
            <div className="card site-filter">
              <label>Filter by site</label>
              <Selector
                context={context}
                kind="sites"
                value={site}
                label="Site"
                onChange={setSite}
              />
            </div>
          )}
          <RecordList
            key={tab + site}
            context={context}
            kind={tab}
            filter={
              site && ['locations', 'facilities'].includes(tab)
                ? { key: 'siteId', value: site }
                : undefined
            }
            initial={site ? { siteId: site } : undefined}
          />
        </>
      )}
    </div>
  );
}

export function ManagementSummary({
  services,
  company,
}: {
  services: FirebaseServices;
  company: Company;
}) {
  const [counts, setCounts] = useState<Record<string, number>>(),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all(
      (Object.keys(definitions) as Kind[]).map(
        async (k) =>
          [
            definitions[k].title,
            (
              await getCountFromServer(
                collection(services.db, 'companies', company.companyId, k),
              )
            ).data().count,
          ] as const,
      ),
    )
      .then((r) => {
        if (active) setCounts(Object.fromEntries(r));
      })
      .catch((e) => {
        if (active) setError(failure(e));
      });
    return () => {
      active = false;
    };
  }, [services.db, company.companyId]);
  return (
    <section className="management">
      <h2>Management overview</h2>
      <p className="muted">
        Current company records, including archived history.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : counts ? (
        <div className="management-counts">
          {Object.entries(counts).map(([label, count]) => (
            <div key={label}>
              <strong>{count}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p role="status">Loading company totals…</p>
      )}
    </section>
  );
}
