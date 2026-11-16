// Generates every logo asset from the single source packages/ui/brand/logo-mark.svg
// (the same mark the apps render through <BrandMark/>):
//   - favicon.svg + apple-touch-icon.png for each web app and the Help Center
//   - Android launcher icons (legacy, round, adaptive foreground) and splash screens
//     (pre-Android 12 full-screen images, Android 12+ splash icon)
//   - iOS app icon and splash images
// Run: node scripts/brand-assets.mjs   (needs Chromium; set PLAYWRIGHT_CHROMIUM_EXECUTABLE if needed)
import { chromium } from 'playwright';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const mark = readFileSync(
  path.join(root, 'packages/ui/brand/logo-mark.svg'),
  'utf8',
);
const symbol = mark.match(/<g transform[\s\S]*?<\/g>/)[0];
const font = path.join(
  root,
  'node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2',
);
const BLUE = '#2f6bea';
const markUri =
  'data:image/svg+xml;base64,' + Buffer.from(mark).toString('base64');
// Full-bleed square (iOS icon, apple-touch-icon): gradient square + symbol, no transparency.
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b7bff"/><stop offset="1" stop-color="#2457c9"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/>${symbol}</svg>`;
const squareUri =
  'data:image/svg+xml;base64,' + Buffer.from(square).toString('base64');
// Adaptive-icon foreground: white symbol only, inside the 72/108 safe zone.
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g transform="translate(36 36) scale(1.5)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${symbol.replace(/<g[^>]*>|<\/g>/g, '')}</g></svg>`;
const fgUri = 'data:image/svg+xml;base64,' + Buffer.from(fg).toString('base64');

const css = `@font-face{font-family:J;src:url(file://${font}) format('woff2');font-weight:200 800}
*{margin:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent}
.wm{font-family:J,sans-serif;font-weight:750;letter-spacing:-.02em;color:#0f172a;line-height:1.1}
.wm span{color:${BLUE}}.wm small{display:block;font-weight:600;letter-spacing:.12em;color:#94a3b8}`;
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
async function png(file, w, h, body, opts = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<!doctype html><html><head><style>${css}</style></head><body style="${opts.bg ? `background:${opts.bg}` : ''}">${body}</body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({
    path: file,
    omitBackground: !opts.bg,
    clip: { x: 0, y: 0, width: w, height: h },
  });
}
const img = (uri, size, x = 0, y = 0) =>
  `<img src="${uri}" width="${size}" height="${size}" style="position:absolute;left:${x}px;top:${y}px">`;
// Splash: white, round mark above the wordmark, centred.
const splash = (w, h) => {
  const s = Math.round(Math.min(w, h) * 0.3);
  const fs = Math.round(s * 0.36);
  return `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(s * 0.22)}px"><img src="${markUri}" width="${s}" height="${s}"><div class="wm" style="font-size:${fs}px;text-align:center">Facility<span>OS</span><small style="font-size:${Math.round(fs * 0.38)}px;margin-top:${Math.round(fs * 0.2)}px">BY SHARACO</small></div></div>`;
};

// ---------------------------------------------------------------- web
for (const app of [
  'admin-web',
  'staff-web',
  'customer-web',
  'platform-web',
  'mobile',
]) {
  const dir = path.join(root, 'apps', app, 'public');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'favicon.svg'), mark);
  await png(
    path.join(dir, 'apple-touch-icon.png'),
    180,
    180,
    img(squareUri, 180),
    { bg: BLUE },
  );
}
copyFileSync(
  path.join(root, 'packages/ui/brand/logo-mark.svg'),
  path.join(root, 'apps/help-web/static/favicon.svg'),
);

// ---------------------------------------------------------------- Android
const res = path.join(root, 'apps/mobile/android/app/src/main/res');
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const n = Math.round(48 * k);
  await png(
    path.join(res, `mipmap-${d}/ic_launcher.png`),
    n,
    n,
    img(markUri, n),
  );
  await png(
    path.join(res, `mipmap-${d}/ic_launcher_round.png`),
    n,
    n,
    img(markUri, n),
  );
  const f = Math.round(108 * k);
  await png(
    path.join(res, `mipmap-${d}/ic_launcher_foreground.png`),
    f,
    f,
    img(fgUri, f),
  );
  // Android 12+ splash icon: 288 dp canvas, mark in the 192 dp visible circle.
  const c = Math.round(288 * k);
  const m = Math.round(176 * k);
  await png(
    path.join(res, `drawable-${d}/splash_icon.png`),
    c,
    c,
    img(markUri, m, (c - m) / 2, (c - m) / 2),
  );
}
writeFileSync(
  path.join(res, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2F6BEA</color>\n</resources>\n`,
);
const splashSizes = {
  'drawable/splash.png': [480, 320],
  'drawable-land-mdpi/splash.png': [480, 320],
  'drawable-land-hdpi/splash.png': [800, 480],
  'drawable-land-xhdpi/splash.png': [1280, 720],
  'drawable-land-xxhdpi/splash.png': [1600, 960],
  'drawable-land-xxxhdpi/splash.png': [1920, 1280],
  'drawable-port-mdpi/splash.png': [320, 480],
  'drawable-port-hdpi/splash.png': [480, 800],
  'drawable-port-xhdpi/splash.png': [720, 1280],
  'drawable-port-xxhdpi/splash.png': [960, 1600],
  'drawable-port-xxxhdpi/splash.png': [1280, 1920],
};
for (const [f, [w, h]] of Object.entries(splashSizes))
  await png(path.join(res, f), w, h, splash(w, h), { bg: '#ffffff' });

// ---------------------------------------------------------------- iOS
const ios = path.join(root, 'apps/mobile/ios/App/App/Assets.xcassets');
await png(
  path.join(ios, 'AppIcon.appiconset/AppIcon-512@2x.png'),
  1024,
  1024,
  img(squareUri, 1024),
  { bg: BLUE },
);
for (const f of [
  'splash-2732x2732.png',
  'splash-2732x2732-1.png',
  'splash-2732x2732-2.png',
])
  await png(
    path.join(ios, 'Splash.imageset', f),
    2732,
    2732,
    splash(2732, 2732 * 0.62).replace('inset:0', 'inset:0'),
    { bg: '#ffffff' },
  );

await browser.close();
console.log('Brand assets generated from packages/ui/brand/logo-mark.svg');
