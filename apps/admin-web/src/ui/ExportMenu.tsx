import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import type { Firestore } from 'firebase/firestore';
import {
  ExportTooLarge,
  exportCaps,
  runExport,
  type Dataset,
  type ExportFormat,
} from '../management/exportStore';
import { Banner, Drawer, Segmented, friendly, useToast } from './kit';

/**
 * The one Export control used by every list and report: format, scope,
 * columns, optional details, an estimated count and live progress.
 */
export function ExportMenu({
  db,
  companyId,
  companyName,
  timeZone,
  uid,
  canSeeSensitive = false,
  dataset,
  disabledReason,
}: {
  db: Firestore;
  companyId: string;
  companyName: string;
  timeZone: string;
  uid: string;
  canSeeSensitive?: boolean;
  dataset: () => Dataset;
  /** Shown instead of exporting (e.g. plan does not include exports). */
  disabledReason?: string;
}) {
  const [open, setOpen] = useState<Dataset | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => setOpen(dataset())}
      >
        <Download /> Export
      </button>
      {open && (
        <ExportDialog
          ds={open}
          onClose={() => setOpen(null)}
          {...{
            db,
            companyId,
            companyName,
            timeZone,
            uid,
            canSeeSensitive,
            disabledReason,
          }}
        />
      )}
    </>
  );
}
function ExportDialog({
  ds,
  onClose,
  db,
  companyId,
  companyName,
  timeZone,
  uid,
  canSeeSensitive,
  disabledReason,
}: {
  ds: Dataset;
  onClose: () => void;
  db: Firestore;
  companyId: string;
  companyName: string;
  timeZone: string;
  uid: string;
  canSeeSensitive: boolean;
  disabledReason?: string;
}) {
  const toast = useToast();
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [scope, setScope] = useState<'page' | 'all'>(
    ds.fetchAll ? 'all' : 'page',
  );
  const shown = ds.columns.filter(
    (c) =>
      (!c.sensitive || canSeeSensitive) &&
      (!c.internal || ds.audience !== 'customer'),
  );
  const [selected, setSelected] = useState<string[]>(
    shown.filter((c) => !c.optional).map((c) => c.key),
  );
  const [estimate, setEstimate] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    let live = true;
    ds.count?.()
      .then((n) => live && setEstimate(n))
      .catch(() => undefined);
    return () => {
      live = false;
      abort.current?.abort();
    };
  }, [ds]);
  const pageCount =
    typeof ds.pageRows === 'function'
      ? (ds.pageCount ?? 0)
      : ds.pageRows.length;
  const total = scope === 'page' ? pageCount : estimate;
  async function go() {
    setError('');
    setProgress(0);
    abort.current = new AbortController();
    try {
      const r = await runExport({
        db,
        companyId,
        companyName,
        timeZone,
        uid,
        dataset: ds,
        format,
        scope,
        selected,
        includeOptional: selected.some(
          (k) => ds.columns.find((c) => c.key === k)?.optional,
        ),
        canSeeSensitive,
        progress: (n) => setProgress(n),
        signal: abort.current.signal,
      });
      toast(`Exported ${r.rows.toLocaleString()} rows.`);
      onClose();
    } catch (e) {
      if ((e as Error).name === 'AbortError') setError('Export cancelled.');
      else setError(e instanceof ExportTooLarge ? e.message : friendly(e));
      setProgress(null);
    }
  }
  const busy = progress !== null;
  return (
    <Drawer
      title={`Export · ${ds.title}`}
      subtitle="Exports include only records you are allowed to see. Each export is recorded in the audit log."
      icon={<Download />}
      onClose={() => {
        abort.current?.abort();
        onClose();
      }}
      footer={
        <>
          {busy ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => abort.current?.abort()}
            >
              Cancel export
            </button>
          ) : (
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Close
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !selected.length || !!disabledReason}
            onClick={() => void go()}
          >
            {format === 'pdf' ? <FileText /> : <FileSpreadsheet />}{' '}
            {busy ? 'Exporting…' : `Export ${format.toUpperCase()}`}
          </button>
        </>
      }
    >
      {disabledReason && <Banner tone="amber">{disabledReason}</Banner>}
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <div className="form-grid">
        <div className="field wide">
          <span className="field-label">Format</span>
          <Segmented
            label="Format"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'xlsx', label: 'Excel (.xlsx)' },
              { value: 'pdf', label: 'PDF' },
              { value: 'csv', label: 'CSV' },
            ]}
          />
        </div>
        <div className="field wide">
          <span className="field-label">Scope</span>
          <Segmented
            label="Scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'page', label: `On screen (${pageCount})` },
              ...(ds.fetchAll
                ? [{ value: 'all' as const, label: 'All matching records' }]
                : []),
            ]}
          />
          <span className="help">
            {scope === 'all'
              ? `Reads every record that matches the current filters in pages${estimate !== null ? ` — about ${estimate.toLocaleString()} rows` : ''}. Limit ${exportCaps[format].toLocaleString()} rows for ${format.toUpperCase()}.`
              : 'Exactly the rows currently loaded on screen.'}
          </span>
        </div>
        {!!ds.filters.length && (
          <div className="field wide">
            <span className="field-label">Filters applied</span>
            <span className="small">
              {ds.filters.map((f) => `${f.label}: ${f.value}`).join(' · ')}
            </span>
          </div>
        )}
        {ds.period && (
          <div className="field wide">
            <span className="field-label">Period</span>
            <span className="small">{ds.period}</span>
          </div>
        )}
        <fieldset className="field wide">
          <legend className="field-label">Columns</legend>
          <div className="export-cols">
            {shown.map((c) => (
              <label key={c.key} className="check">
                <input
                  type="checkbox"
                  checked={selected.includes(c.key)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, c.key]
                        : selected.filter((k) => k !== c.key),
                    )
                  }
                />{' '}
                {c.label}
                {c.optional && <span className="muted small"> (detail)</span>}
              </label>
            ))}
          </div>
          {!canSeeSensitive && ds.columns.some((c) => c.sensitive) && (
            <span className="help">
              Personal contact columns are excluded for your role.
            </span>
          )}
        </fieldset>
      </div>
      {busy && (
        <div role="status" aria-live="polite" className="export-progress">
          <div className="bar-track" style={{ width: '100%' }}>
            <span
              className="bar-fill"
              style={{
                width: `${total ? Math.min(100, Math.round(((progress || 0) / total) * 100)) : 30}%`,
              }}
            />
          </div>
          <span className="small">
            Read {(progress || 0).toLocaleString()}{' '}
            {total ? `of ~${total.toLocaleString()} ` : ''}rows…
          </span>
        </div>
      )}
    </Drawer>
  );
}
