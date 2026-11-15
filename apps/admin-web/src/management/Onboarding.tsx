import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  Circle,
  ImageUp,
  PackagePlus,
  Rocket,
  Save,
  CircleHelp,
} from 'lucide-react';
import {
  onboardingSteps,
  setupProgress,
  starterPacks,
  stepDone,
  type SetupFacts,
  type StarterPack,
  helpUrl,
} from '@facilityos/shared';
import type { Context } from './context';
import {
  defaultBranding,
  getBrandingSettings,
  getOnboarding,
  installPack,
  saveBranding,
  saveOnboarding,
  setupFacts,
  type BrandingSettings,
  type Onboarding,
  type PackSelection,
} from './onboardingStore';
import { readOnly } from './planGate';
import { Banner, Pill, Skeleton, friendly, useToast } from '../ui/kit';

/**
 * Guided company setup. Progress comes from real records, so the wizard can
 * be left and resumed at any time (or bypassed entirely) without duplicating
 * anything; each step links to the screen where the work is done.
 */
export function OnboardingWizard({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [facts, setFacts] = useState<SetupFacts>();
  const [ob, setOb] = useState<Onboarding>({ steps: {}, pack: '' });
  const [v, setV] = useState(0);
  const [error, setError] = useState('');
  const step = params.get('step') || '';
  useEffect(() => {
    let live = true;
    Promise.all([
      setupFacts(
        db,
        c,
        context.company as {
          name?: string;
          timeZone?: string;
          contactEmail?: string;
        },
      ),
      getOnboarding(db, c),
    ])
      .then(([f, o]) => {
        if (!live) return;
        setFacts(f);
        setOb(o);
      })
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c, context.company, v]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!facts) return <Skeleton rows={6} />;
  const p = setupProgress(facts, ob.steps);
  async function mark(id: string, done: boolean) {
    const next = { ...ob, steps: { ...ob.steps, [id]: done } };
    try {
      await saveOnboarding(db, c, context.uid, next);
      setOb(next);
      toast(done ? 'Step marked complete' : 'Step reopened');
    } catch (e) {
      toast(friendly(e), 'red');
    }
  }
  const current = onboardingSteps.find((s) => s.id === step);
  return (
    <>
      {readOnly(context) && (
        <Banner tone="amber">
          Your subscription is read-only, so setup changes cannot be saved.
        </Banner>
      )}
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>Setup progress</h2>
          <Pill tone={p.percent === 100 ? 'green' : 'blue'}>
            {p.percent}% complete
          </Pill>
        </div>
        <div
          className="bar-track"
          style={{ width: '100%', height: 10 }}
          role="progressbar"
          aria-valuenow={p.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
        >
          <span
            className="bar-fill tone-green"
            style={{ width: `${p.percent}%` }}
          />
        </div>
        <p className="muted small">
          {p.done} of {p.total} steps done.{' '}
          {p.outstanding.length
            ? `Next: ${p.outstanding[0].title}.`
            : 'Everything is set up — review and activate.'}{' '}
          You can leave and come back at any time; progress is read from your
          real records.
        </p>
      </section>
      <div className="onboarding-grid">
        <nav
          className="card card-pad onboarding-steps"
          aria-label="Setup steps"
        >
          <ol>
            {onboardingSteps.map((s, i) => {
              const done = stepDone(s.id, facts, ob.steps);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`step-link${step === s.id ? ' active' : ''}`}
                    onClick={() => setParams({ step: s.id })}
                    data-help={s.helpId}
                  >
                    {done ? (
                      <CheckCircle2 color="var(--green)" size={18} />
                    ) : (
                      <Circle size={18} />
                    )}
                    <span>
                      {i + 1}. {s.title}
                      {s.optional && (
                        <span className="muted small"> (optional)</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <section className="card card-pad rise" data-help={current?.helpId}>
          {current && (
            <a
              className="btn btn-ghost btn-sm"
              style={{ float: 'right' }}
              href={helpUrl(current.helpId, import.meta.env.VITE_HELP_URL)}
              target="_blank"
              rel="noopener"
            >
              <CircleHelp /> Help for this step
            </a>
          )}
          {!current ? (
            <>
              <h2>Welcome to FacilityOS</h2>
              <p>
                Work through the steps on the left. A client or contract is not
                needed to create a site — physical sites, floors and rooms come
                first; commercial links can be added later.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  setParams({ step: p.outstanding[0]?.id || 'review' })
                }
              >
                <Rocket /> Continue setup
              </button>
            </>
          ) : current.id === 'branding' ? (
            <BrandingStep
              context={context}
              onSaved={() => setV((x) => x + 1)}
            />
          ) : current.id === 'templates' ? (
            <PackStep
              context={context}
              chosen={ob.pack}
              onDone={async (pack) => {
                const next = { ...ob, pack };
                await saveOnboarding(db, c, context.uid, next).catch(
                  () => undefined,
                );
                setV((x) => x + 1);
              }}
            />
          ) : current.id === 'review' ? (
            <>
              <h2>Review & activate</h2>
              <ul className="health-list">
                {onboardingSteps
                  .filter((s) => s.id !== 'review')
                  .map((s) => (
                    <li key={s.id}>
                      <Pill
                        tone={
                          stepDone(s.id, facts, ob.steps)
                            ? 'green'
                            : s.optional
                              ? 'gray'
                              : 'amber'
                        }
                        dot
                      >
                        {stepDone(s.id, facts, ob.steps)
                          ? 'Done'
                          : s.optional
                            ? 'Optional'
                            : 'To do'}
                      </Pill>
                      <strong>{s.title}</strong>
                      <span className="muted small">{s.description}</span>
                    </li>
                  ))}
              </ul>
              <div className="toolbar">
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={p.percent < 100 || !!ob.steps.review}
                  onClick={() => void mark('review', true)}
                >
                  <Check />{' '}
                  {ob.steps.review
                    ? 'Setup marked complete'
                    : 'Mark setup complete'}
                </button>
              </div>
              {p.percent < 100 && (
                <p className="muted small">
                  Finish the outstanding steps first.
                </p>
              )}
            </>
          ) : (
            <>
              <h2>{current.title}</h2>
              <p>{current.description}</p>
              <p>
                Status:{' '}
                <Pill
                  tone={
                    stepDone(current.id, facts, ob.steps) ? 'green' : 'amber'
                  }
                  dot
                >
                  {stepDone(current.id, facts, ob.steps)
                    ? 'Done'
                    : 'Not done yet'}
                </Pill>
              </p>
              {current.id === 'employees' && (
                <p className="muted small">
                  Tip: use Administration → Import data to load employees from
                  Excel.
                </p>
              )}
              {current.id === 'schedules' && (
                <Banner tone="blue">
                  Recurring schedules create live tasks for your staff. Starter
                  packs never create them automatically — add each one
                  deliberately.
                </Banner>
              )}
              <div className="toolbar">
                <Link className="btn btn-primary" to={current.route}>
                  Open {current.title.toLowerCase()}
                </Link>
                {(current.optional || current.id === 'company') && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => void mark(current.id, !ob.steps[current.id])}
                  >
                    {ob.steps[current.id] ? 'Reopen step' : 'Mark as done'}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

/** Reads an image, scales it to at most 240×80 and returns a small data URL. */
async function shrinkLogo(f: File): Promise<string> {
  if (!/^image\/(png|jpeg)$/.test(f.type))
    throw new Error('Choose a PNG or JPEG image.');
  if (f.size > 5 * 1024 * 1024)
    throw new Error('The image is larger than 5 MB.');
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('The image could not be read.'));
      i.src = url;
    });
    const scale = Math.min(1, 240 / img.width, 80 / img.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    return png.length <= 60000 ? png : canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function BrandingStep({
  context,
  onSaved,
}: {
  context: Context;
  onSaved?: () => void;
}) {
  const db = context.services.db,
    c = context.company.companyId;
  const toast = useToast();
  const [b, setB] = useState<BrandingSettings>(defaultBranding);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    getBrandingSettings(db, c)
      .then((x) => {
        setB(x);
        setLoaded(true);
      })
      .catch((e) => setError(friendly(e)));
  }, [db, c]);
  if (!loaded && !error) return <Skeleton rows={4} />;
  const field = (k: keyof BrandingSettings, label: string, help?: string) => (
    <div className="field">
      <label htmlFor={`br-${k}`}>{label}</label>
      <input
        id={`br-${k}`}
        className="input"
        value={b[k]}
        onChange={(e) => setB({ ...b, [k]: e.target.value })}
      />
      {help && <span className="help">{help}</span>}
    </div>
  );
  return (
    <>
      <h2>Logo & preferences</h2>
      <p className="muted small">
        Used on PDF reports and exports. The company record stays the single
        source for name and time zone.
      </p>
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <div className="form-grid">
        <div className="field wide">
          <span className="field-label">Logo</span>
          <div className="toolbar">
            {b.logoDataUrl ? (
              <img
                src={b.logoDataUrl}
                alt="Company logo"
                style={{ maxHeight: 48, maxWidth: 200 }}
              />
            ) : (
              <span className="muted small">No logo yet</span>
            )}
            <label className="btn btn-outline">
              <ImageUp /> Upload PNG/JPEG
              <input
                type="file"
                accept="image/png,image/jpeg"
                hidden
                aria-label="Logo file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    setB({ ...b, logoDataUrl: await shrinkLogo(f) });
                  } catch (x) {
                    setError((x as Error).message);
                  }
                }}
              />
            </label>
            {b.logoDataUrl && (
              <button
                type="button"
                className="link-btn"
                onClick={() => setB({ ...b, logoDataUrl: '' })}
              >
                Remove
              </button>
            )}
          </div>
        </div>
        {field(
          'displayName',
          'Display name on reports',
          'Leave empty to use the company name',
        )}
        <div className="field">
          <label htmlFor="br-color">Report colour</label>
          <input
            id="br-color"
            type="color"
            className="input"
            value={b.primaryColor}
            onChange={(e) =>
              setB({ ...b, primaryColor: e.target.value.toUpperCase() })
            }
          />
        </div>
        {field('currency', 'Currency', 'Three letters, e.g. AED')}
        {field('locale', 'Locale', 'e.g. en-GB')}
        {field('dateFormat', 'Date format', 'e.g. dd MMM yyyy')}
        <div className="field wide">
          <label htmlFor="br-header">Report header line</label>
          <input
            id="br-header"
            className="input"
            value={b.reportHeader}
            maxLength={500}
            onChange={(e) => setB({ ...b, reportHeader: e.target.value })}
          />
        </div>
        <div className="field wide">
          <label htmlFor="br-footer">Report footer line</label>
          <input
            id="br-footer"
            className="input"
            value={b.reportFooter}
            maxLength={500}
            onChange={(e) => setB({ ...b, reportFooter: e.target.value })}
          />
        </div>
      </div>
      <div className="toolbar">
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await saveBranding(db, c, context.uid, b);
              toast('Branding saved');
              onSaved?.();
            } catch (e) {
              setError(friendly(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Save /> Save branding
        </button>
      </div>
    </>
  );
}
function PackStep({
  context,
  chosen,
  onDone,
}: {
  context: Context;
  chosen: string;
  onDone: (pack: string) => Promise<void>;
}) {
  const toast = useToast();
  const [pack, setPack] = useState<StarterPack>(
    starterPacks.find((p) => p.id === chosen) || starterPacks[0],
  );
  const all = (p: StarterPack): PackSelection => ({
    departments: p.departments.map((x) => x.code),
    designations: p.designations.map((x) => x.code),
    categories: p.categories.map((x) => x.code),
    templates: p.templates.map((x) => x.code),
  });
  const [sel, setSel] = useState<PackSelection>(all(pack));
  const [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const toggle = (k: keyof PackSelection, code: string) =>
    setSel({
      ...sel,
      [k]: sel[k].includes(code)
        ? sel[k].filter((x) => x !== code)
        : [...sel[k], code],
    });
  const group = (
    k: keyof PackSelection,
    title: string,
    items: { code: string; name: string; extra?: string }[],
  ) => (
    <fieldset className="field wide">
      <legend className="field-label">{title}</legend>
      {items.map((i) => (
        <label key={i.code} className="check">
          <input
            type="checkbox"
            checked={sel[k].includes(i.code)}
            onChange={() => toggle(k, i.code)}
          />{' '}
          {i.name}{' '}
          <span className="muted small">
            {i.code}
            {i.extra ? ` · ${i.extra}` : ''}
          </span>
        </label>
      ))}
    </fieldset>
  );
  return (
    <>
      <h2>Task templates — starter packs</h2>
      <Banner tone="blue" title="Review before use">
        A pack adds departments, designations, task categories and DRAFT
        checklists. Nothing is published and no schedules are created: review
        each checklist, publish it, then decide its schedule. Items whose code
        already exists are skipped, so installing twice is safe.
      </Banner>
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <div className="field">
        <label htmlFor="pack">Industry</label>
        <select
          id="pack"
          className="select"
          value={pack.id}
          onChange={(e) => {
            const p = starterPacks.find((x) => x.id === e.target.value)!;
            setPack(p);
            setSel(all(p));
          }}
        >
          {starterPacks.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="help">{pack.description}</span>
      </div>
      <div className="form-grid">
        {group('departments', 'Departments', pack.departments)}
        {group('designations', 'Designations', pack.designations)}
        {group('categories', 'Task categories', pack.categories)}
        {group(
          'templates',
          'Checklist templates (created as drafts)',
          pack.templates.map((t) => ({
            code: t.code,
            name: t.name,
            extra: t.recurrence,
          })),
        )}
      </div>
      <p className="muted small">
        Suggested SLA targets (set them in SLA policies):{' '}
        {pack.slaSuggestions.join(' · ')}
      </p>
      <div className="toolbar">
        <span className="small" role="status">
          {busy}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!!busy || readOnly(context)}
          onClick={async () => {
            setError('');
            try {
              const r = await installPack(
                context.services.db,
                context.company.companyId,
                context.uid,
                pack,
                sel,
                (m) => setBusy(`Installing ${m}…`),
              );
              toast(
                `Installed ${r.created} item(s); ${r.skipped} already existed.`,
              );
              await onDone(pack.id);
            } catch (e) {
              setError(friendly(e));
            } finally {
              setBusy('');
            }
          }}
        >
          <PackagePlus /> Install selected
        </button>
      </div>
    </>
  );
}
