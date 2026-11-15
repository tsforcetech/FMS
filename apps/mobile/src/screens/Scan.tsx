import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import jsQR from 'jsqr';
import { QrCode, X, Boxes, MapPin, ShieldAlert } from 'lucide-react';
import { parseQr, type QrTarget } from '@facilityos/shared';
import { useStaff } from '@staff/App';
import { useT } from '@staff/i18n';
import { ErrorBox, Label, TaskCard } from '@staff/screens/common';
import { useMobile } from '../core';
import { isNative, scanNative } from '../platform';

/** Camera scanner for browsers/WebViews without ML Kit (also used in tests). */
export function WebScanner({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let stream: MediaStream | null = null,
      raf = 0,
      done = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const tick = () => {
      const v = video.current;
      if (!done && v && v.readyState >= 2 && v.videoWidth) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const code = jsQR(
          ctx.getImageData(0, 0, canvas.width, canvas.height).data,
          canvas.width,
          canvas.height,
        );
        if (code?.data) {
          done = true;
          onResult(code.data);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        raf = requestAnimationFrame(tick);
      })
      .catch(() =>
        setError(
          'Camera permission is off or no camera is available. Type the code instead.',
        ),
      );
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((x) => x.stop());
    };
  }, [onResult]);
  const [manual, setManual] = useState('');
  return (
    <div className="m-scanner" role="dialog" aria-label={t('scanQr')}>
      <div className="m-scanner-top">
        <strong>{t('scanQr')}</strong>
        <button
          type="button"
          className="icon-btn"
          aria-label={t('cancel')}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <div className="m-viewfinder">
        <video ref={video} muted playsInline aria-label="Camera preview" />
        <span className="m-frame" aria-hidden />
      </div>
      {error && <ErrorBox error={error} />}
      <form
        className="m-manual"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onResult(manual.trim());
        }}
      >
        <label htmlFor="m-code">{t('enterCode')}</label>
        <input
          id="m-code"
          className="input"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          autoComplete="off"
        />
        <button className="btn btn-outline btn-lg">{t('open')}</button>
      </form>
    </div>
  );
}

type Found = {
  target: QrTarget;
  name: string;
  code: string;
  siteId: string;
  status: string;
};
/** Scan a label → verify it against the user's authorization → show the record and my tasks for it. */
export function Scan() {
  const staff = useStaff();
  const m = useMobile();
  const { t } = useT();
  const [open, setOpen] = useState(false),
    [found, setFound] = useState<Found | null>(null),
    [error, setError] = useState('');
  async function handle(text: string) {
    setOpen(false);
    setFound(null);
    setError('');
    const target = parseQr(text);
    if (!target) return setError(t('invalidCode'));
    try {
      // The security rules decide: membership, staff link, employee status and site scope.
      const s = await getDoc(
        doc(
          staff.context.services.db,
          'companies',
          staff.companyId,
          target.kind,
          target.id,
        ),
      );
      if (
        !s.exists() ||
        s.data().status === 'archived' ||
        s.data().status === 'disposed'
      )
        return setError(t('unknownCode'));
      setFound({
        target,
        name: s.data().name,
        code: s.data().code,
        siteId: s.data().siteId || '',
        status: s.data().status,
      });
    } catch (e) {
      const code = (e as { code?: string }).code || '';
      if (code === 'permission-denied') return setError(t('notAuthorizedCode'));
      // Offline: match against tasks already on the device only.
      const local = m.tasks.find(
        (x) =>
          x[
            target.kind === 'assets'
              ? 'assetId'
              : target.kind === 'locations'
                ? 'locationId'
                : 'facilityId'
          ] === target.id,
      );
      if (local)
        return setFound({
          target,
          name: target.id,
          code: '',
          siteId: local.siteId,
          status: '',
        });
      setError(m.state.online ? t('unknownCode') : t('offlineMode'));
    }
  }
  const related = found
    ? m.tasks.filter(
        (x) =>
          ['assigned', 'in_progress', 'paused', 'rework_required'].includes(
            x.status,
          ) &&
          (found.target.kind === 'assets'
            ? x.assetId
            : found.target.kind === 'locations'
              ? x.locationId
              : x.facilityId) === found.target.id,
      )
    : [];
  return (
    <div className="s-page">
      <h1 className="s-title">
        <QrCode /> {t('scan')}
      </h1>
      <p className="muted">{t('scanHelp')}</p>
      <button
        className="btn btn-primary btn-lg btn-block m-scan-btn"
        onClick={async () => {
          if (!isNative) return setOpen(true);
          const r = await scanNative();
          if (r.ok) void handle(r.text);
          else if (r.reason !== 'cancelled')
            setError(
              r.reason === 'denied'
                ? 'Camera permission is off.'
                : 'Scanning is not available on this device.',
            );
        }}
      >
        <QrCode size={26} /> {t('scanQr')}
      </button>
      {error && (
        <div className="s-error-box" role="alert">
          <ShieldAlert size={18} /> {error}
        </div>
      )}
      {found && (
        <section className="s-panel" aria-live="polite">
          <h2>
            {found.target.kind === 'assets' ? (
              <Boxes size={18} />
            ) : (
              <MapPin size={18} />
            )}{' '}
            {found.name}
          </h2>
          {found.code && <span className="code-chip">{found.code}</span>}
          {found.siteId && (
            <p className="s-meta">
              <Label context={staff.context} kind="sites" id={found.siteId} />
            </p>
          )}
          <h3>{t('myOpenTasksHere')}</h3>
          {related.length ? (
            <div className="s-list">
              {related.map((x) => (
                <TaskCard
                  key={x.id}
                  task={x}
                  context={staff.context}
                  tz={staff.timeZone}
                />
              ))}
            </div>
          ) : (
            <p className="small muted">{t('noTasks')}</p>
          )}
          <Link className="btn btn-outline btn-lg" to="/report">
            {t('reportProblem')}
          </Link>
        </section>
      )}
      {open && (
        <WebScanner
          onClose={() => setOpen(false)}
          onResult={(x) => void handle(x)}
        />
      )}
    </div>
  );
}
