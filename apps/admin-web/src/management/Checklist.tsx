import {
  AlertTriangle,
  Camera,
  MapPin,
  QrCode,
  CheckCircle2,
} from 'lucide-react';
import {
  conditionValues,
  deferredAnswerTypes,
  evaluateAnswer,
  visibleQuestions,
  type Question,
  type VersionContent,
} from '@facilityos/shared';
import { Pill } from '../ui/kit';
import type { ReactNode } from 'react';

function Choice({
  options,
  value,
  onChange,
  disabled,
  label,
  tones,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label: string;
  tones?: Record<string, string>;
}) {
  return (
    <div className="answer-choices" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          className={
            'answer-choice ' +
            (value === o.value ? 'on ' + (tones?.[o.value] || '') : '')
          }
          onClick={() => onChange(value === o.value ? '' : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
function Answer({
  q,
  value,
  onChange,
  disabled,
  renderEvidence,
}: {
  q: Question;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  renderEvidence?: (q: Question) => ReactNode;
}) {
  const id = 'answer-' + q.id;
  if (deferredAnswerTypes.includes(q.type) && renderEvidence)
    return <>{renderEvidence(q)}</>;
  if (deferredAnswerTypes.includes(q.type)) {
    const Icon =
      q.type === 'photo' ? Camera : q.type === 'qr' ? QrCode : MapPin;
    return (
      <div className="deferred-answer">
        <Icon size={18} />
        {q.type === 'photo'
          ? 'Photos are taken in the FacilityOS mobile app. Cloud upload is pending activation, so evidence is recorded as pending.'
          : 'Captured in the FacilityOS mobile app. Recorded here as evidence pending.'}
      </div>
    );
  }
  switch (q.type) {
    case 'yes_no':
      return (
        <Choice
          label={q.label}
          disabled={disabled}
          value={value}
          onChange={onChange}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
          tones={{ yes: 'good', no: 'bad' }}
        />
      );
    case 'pass_fail':
      return (
        <Choice
          label={q.label}
          disabled={disabled}
          value={value}
          onChange={onChange}
          options={[
            { value: 'pass', label: 'Pass' },
            { value: 'fail', label: 'Fail' },
          ]}
          tones={{ pass: 'good', fail: 'bad' }}
        />
      );
    case 'single_choice':
      return (
        <Choice
          label={q.label}
          disabled={disabled}
          value={value}
          onChange={onChange}
          options={q.choices.map((c) => ({ value: c, label: c }))}
        />
      );
    case 'asset_condition':
      return (
        <Choice
          label={q.label}
          disabled={disabled}
          value={value}
          onChange={onChange}
          options={conditionValues.map((c) => ({ value: c, label: c }))}
          tones={{
            Excellent: 'good',
            Good: 'good',
            Fair: 'warn',
            Poor: 'bad',
            Critical: 'bad',
          }}
        />
      );
    case 'multiple_choice': {
      const set = value ? value.split('|') : [];
      return (
        <div className="answer-choices" role="group" aria-label={q.label}>
          {q.choices.map((c) => (
            <button
              type="button"
              key={c}
              disabled={disabled}
              aria-pressed={set.includes(c)}
              className={'answer-choice ' + (set.includes(c) ? 'on' : '')}
              onClick={() =>
                onChange(
                  q.choices
                    .filter((x) =>
                      x === c ? !set.includes(c) : set.includes(x),
                    )
                    .join('|'),
                )
              }
            >
              {c}
            </button>
          ))}
        </div>
      );
    }
    case 'long_text':
      return (
        <textarea
          id={id}
          aria-label={q.label}
          className="input"
          rows={3}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
    case 'time':
      return (
        <input
          id={id}
          aria-label={q.label}
          className="input answer-short"
          type={q.type}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'text':
      return (
        <input
          id={id}
          aria-label={q.label}
          className="input"
          disabled={disabled}
          value={value}
          maxLength={500}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <div className="input-suffix answer-short">
          <input
            id={id}
            aria-label={q.label}
            className="input"
            inputMode="decimal"
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {q.unit && <span>{q.unit}</span>}
        </div>
      );
  }
}
function rangeHint(q: Question) {
  const unit = q.unit ? ' ' + q.unit : '';
  if (q.expectedMin !== null && q.expectedMax !== null)
    return `Expected ${q.expectedMin}–${q.expectedMax}${unit}`;
  if (q.expectedMin !== null)
    return `Expected at least ${q.expectedMin}${unit}`;
  if (q.expectedMax !== null) return `Expected at most ${q.expectedMax}${unit}`;
  return '';
}
/** Checklist used by the builder preview and by task execution. */
export function ChecklistForm({
  content,
  answers,
  onChange,
  disabled,
  showErrors,
  renderEvidence,
}: {
  content: Pick<VersionContent, 'questions' | 'sections'>;
  answers: Record<string, string>;
  onChange?: (answers: Record<string, string>) => void;
  disabled?: boolean;
  showErrors?: boolean;
  /** Mobile app: renders native capture controls for photo/QR/GPS questions. */
  renderEvidence?: (q: Question) => ReactNode;
}) {
  const visible = visibleQuestions(content, answers);
  const countable = visible.filter(
    (q) => !deferredAnswerTypes.includes(q.type),
  );
  const answered = countable.filter((q) => (answers[q.id] ?? '').trim()).length;
  const pct = countable.length
    ? Math.round((answered / countable.length) * 100)
    : 0;
  return (
    <div className="checklist">
      <div
        className="progress"
        aria-label={`${answered} of ${countable.length} answered`}
      >
        <div className="progress-bar">
          <span style={{ width: pct + '%' }} />
        </div>
        <span className="small muted">
          {answered} of {countable.length} answered
        </span>
      </div>
      {content.sections.map((s) => {
        const qs = visible.filter((q) => q.sectionId === s.id);
        if (!qs.length) return null;
        return (
          <section key={s.id} className="checklist-section">
            <h3>{s.title}</h3>
            {qs.map((q, i) => {
              const v = answers[q.id] ?? '';
              const r = v.trim() || showErrors ? evaluateAnswer(q, v) : {};
              return (
                <div
                  key={q.id}
                  className={
                    'question ' + (r.error && showErrors ? 'invalid' : '')
                  }
                  style={{ ['--i' as string]: i }}
                >
                  <div className="question-head">
                    <label
                      htmlFor={'answer-' + q.id}
                      className="question-label"
                    >
                      {q.label}
                      {q.required && !deferredAnswerTypes.includes(q.type) && (
                        <span className="req" aria-hidden="true">
                          *
                        </span>
                      )}
                    </label>
                    {q.showIf && <Pill tone="violet">Follow-up</Pill>}
                    {q.evidence !== 'none' && (
                      <Pill tone="gray">
                        {q.evidence.toUpperCase()} evidence
                      </Pill>
                    )}
                  </div>
                  {q.help && <p className="small muted">{q.help}</p>}
                  {rangeHint(q) && (
                    <p className="small muted">{rangeHint(q)}</p>
                  )}
                  <Answer
                    q={q}
                    value={v}
                    disabled={disabled || !onChange}
                    onChange={(x) => onChange?.({ ...answers, [q.id]: x })}
                    renderEvidence={renderEvidence}
                  />
                  {r.error &&
                    (showErrors || v.trim()) &&
                    !(
                      renderEvidence && deferredAnswerTypes.includes(q.type)
                    ) && (
                      <span className="err" role="alert">
                        {r.error}
                      </span>
                    )}
                  {r.exception && (
                    <span className={'exception ' + r.exception.severity}>
                      <AlertTriangle size={14} />{' '}
                      {r.exception.severity === 'critical'
                        ? 'Critical exception'
                        : 'Exception'}
                      : {r.exception.reason}
                    </span>
                  )}
                  {!r.error && !r.exception && v.trim() && (
                    <span className="answer-ok">
                      <CheckCircle2 size={14} /> Recorded
                    </span>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
      {!visible.length && <p className="muted">No questions yet.</p>}
    </div>
  );
}
