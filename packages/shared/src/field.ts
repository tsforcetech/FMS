/**
 * Phase 6 field helpers shared by the mobile app, staff web and tests.
 * Pure functions only.
 */
export type QrTarget = {
  kind: 'assets' | 'locations' | 'facilities';
  id: string;
};
const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;
/**
 * Parses a FacilityOS QR payload. Accepts the existing asset labels
 * (`…/assets?open=<id>` or `#/assets?open=<id>`) and `facilityos:<kind>:<id>`.
 * Returns only an opaque record reference — never credentials; the caller
 * must still check membership, staff identity, site scope and task context.
 */
export function parseQr(raw: string): QrTarget | null {
  const text = (raw || '').trim();
  if (!text || text.length > 600) return null;
  const direct =
    /^facilityos:(asset|location|facility):([a-zA-Z0-9_-]{1,128})$/i.exec(text);
  if (direct) {
    const k = direct[1].toLowerCase();
    return {
      kind:
        k === 'asset'
          ? 'assets'
          : k === 'location'
            ? 'locations'
            : 'facilities',
      id: direct[2],
    };
  }
  const m = /\/(assets|locations|facilities)\?(?:[^#]*&)?open=([^&#\s]+)/.exec(
    text,
  );
  if (m && idPattern.test(decodeURIComponent(m[2])))
    return { kind: m[1] as QrTarget['kind'], id: decodeURIComponent(m[2]) };
  return null;
}
/** One attendance record per employee per local date. */
export function attendanceId(employeeId: string, localDate: string) {
  return `${employeeId}_${localDate}`;
}
/** Minutes late against the shift start (0 when on time or no shift). */
export function lateMinutes(
  shiftStart: string | undefined,
  localTime: string,
  graceMinutes = 0,
) {
  if (!shiftStart || !/^\d\d:\d\d$/.test(shiftStart)) return 0;
  const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  return Math.max(0, toMin(localTime) - toMin(shiftStart) - graceMinutes);
}
export type AccuracyLevel = 'good' | 'fair' | 'poor';
/** GPS readings are approximate; accuracy is shown with every reading. */
export function accuracyLevel(meters: number): AccuracyLevel {
  return meters <= 25 ? 'good' : meters <= 100 ? 'fair' : 'poor';
}
export function evidenceId(
  taskId: string,
  attempt: number,
  questionId: string,
) {
  return `${taskId}_${attempt}_${questionId}`;
}
