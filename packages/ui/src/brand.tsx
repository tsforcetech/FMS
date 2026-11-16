/**
 * The FacilityOS logo — the single source for every app (admin, staff,
 * customer, platform, mobile). The same mark is in packages/ui/brand/
 * logo-mark.svg, from which scripts/brand-assets.mjs generates the favicons,
 * the Android/iOS launcher icons and the splash screens.
 */
import { useId } from 'react';

export const BRAND_BLUE = '#2f6bea';
const LAYERS = [
  'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z',
  'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12',
  'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17',
];

/** The round blue mark with the white layers symbol. */
export function BrandMark({
  size = 42,
  shadow = true,
}: {
  size?: number;
  shadow?: boolean;
}) {
  const id = 'fos' + useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden
      focusable="false"
      style={{
        flexShrink: 0,
        borderRadius: '50%',
        boxShadow: shadow ? '0 8px 18px rgba(47, 107, 234, 0.35)' : undefined,
      }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b7bff" />
          <stop offset="1" stopColor="#2457c9" />
        </linearGradient>
      </defs>
      <circle cx="256" cy="256" r="256" fill={`url(#${id})`} />
      <g
        transform="translate(128 128) scale(10.6667)"
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {LAYERS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

/** "FacilityOS" with the "BY SHARACO" line (or another sub-line such as "Platform"). */
export function Wordmark({
  sub = 'BY SHARACO',
  tone = 'dark',
  size = 17,
}: {
  sub?: string;
  tone?: 'dark' | 'light';
  size?: number;
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontWeight: 750,
        fontSize: size,
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        color: tone === 'light' ? '#fff' : '#0f172a',
      }}
    >
      Facility
      <span style={{ color: tone === 'light' ? '#8fb4ff' : BRAND_BLUE }}>
        OS
      </span>
      {sub && (
        <small
          style={{
            display: 'block',
            fontSize: Math.round(size * 0.62),
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: tone === 'light' ? 'rgba(255,255,255,0.7)' : '#94a3b8',
            marginTop: 3,
          }}
        >
          {sub}
        </small>
      )}
    </span>
  );
}

/** Mark + wordmark side by side. */
export function BrandLockup({
  size = 42,
  sub,
  tone,
}: {
  size?: number;
  sub?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <BrandMark size={size} />
      <Wordmark sub={sub} tone={tone} size={Math.round(size * 0.42)} />
    </span>
  );
}
