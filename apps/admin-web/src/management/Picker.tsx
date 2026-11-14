import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { definitions, type Kind, type Operation } from '@facilityos/shared';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { listRecords } from './store';
import { useDebounced, useLabel, type Context } from './context';
import { friendly } from '../ui/kit';

/** Searchable, paginated record selector (combobox). */
export function Picker({
  context,
  kind,
  value,
  onChange,
  label,
  inputId,
  filter,
  exclude,
  disabled,
  invalid,
  placeholder,
}: {
  context: Context;
  kind: Kind;
  value: string;
  onChange: (v: string) => void;
  label: string;
  inputId?: string;
  filter?: { key: string; value: string };
  exclude?: string;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(''),
    [rows, setRows] = useState<Operation[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [active, setActive] = useState(-1);
  const term = useDebounced(search);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = useLabel(context, kind, value);
  const filterKey = filter?.key,
    filterValue = filter?.value;
  useEffect(() => {
    if (!open) return;
    let live = true;
    setBusy(true);
    listRecords(
      context.services.db,
      context.company.companyId,
      kind,
      term,
      '',
      undefined,
      filterKey ? { key: filterKey, value: filterValue || '' } : undefined,
    )
      .then((r) => {
        if (!live) return;
        setRows(r.rows);
        setCursor(r.cursor);
        setMore(r.hasMore);
        setError('');
        setActive(-1);
      })
      .catch((e) => live && setError(friendly(e)))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [open, term, kind, filterKey, filterValue, context]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  async function loadMore() {
    setBusy(true);
    try {
      const r = await listRecords(
        context.services.db,
        context.company.companyId,
        kind,
        term,
        '',
        cursor,
        filterKey ? { key: filterKey, value: filterValue || '' } : undefined,
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
  const options = rows.filter(
    (r) => r.id !== exclude && r.values.status !== 'archived',
  );
  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setSearch('');
  }
  return (
    <div className="picker" ref={ref}>
      <button
        type="button"
        id={inputId}
        className="input picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {value ? (
          <span>{selected.text}</span>
        ) : (
          <span className="placeholder">
            {placeholder || `Choose ${label.toLowerCase()}`}
          </span>
        )}
        <ChevronDown />
      </button>
      {open && (
        <div className="picker-panel">
          <div className="search">
            <Search />
            <input
              autoFocus
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder={`Search ${definitions[kind].title.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, options.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === 'Enter' && options[active]) {
                  e.preventDefault();
                  choose(options[active].id);
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  setOpen(false);
                }
              }}
            />
          </div>
          <div className="picker-list" role="listbox" id={listId}>
            {value && (
              <button
                type="button"
                className="picker-option clear"
                onClick={() => choose('')}
              >
                <span>Clear selection</span>
                <X size={15} />
              </button>
            )}
            {options.map((r, i) => (
              <button
                type="button"
                role="option"
                key={r.id}
                aria-selected={r.id === value || i === active}
                className="picker-option"
                onClick={() => choose(r.id)}
              >
                <span>
                  {r.values.name}{' '}
                  <span className="code-chip">{r.values.code}</span>
                </span>
                {r.id === value && <Check size={16} color="var(--blue)" />}
              </button>
            ))}
            {busy && <div className="picker-empty">Loading…</div>}
            {!busy && !options.length && !error && (
              <div className="picker-empty">
                {term
                  ? 'No matches. Try a different name.'
                  : `No active ${definitions[kind].title.toLowerCase()} yet.`}
              </div>
            )}
            {error && (
              <div className="picker-empty" role="alert">
                {error}
              </div>
            )}
            {more && !busy && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void loadMore()}
              >
                Show more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
