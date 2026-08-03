/**
 * Generates the Chrome Web Store assets into docs/store/ from the REAL loaded
 * extension: every screenshot is a crop of an actual `chrome-extension://` page
 * showing a card captured from a fixture site by the shipped scanner and
 * aggregators. Nothing here re-renders components or fakes a card.
 *
 *   npm run build
 *   npx playwright install chromium   # once
 *   xvfb-run -a node scripts/make-shots.mjs
 *
 * Output: shot-1…shot-5 (1280×800), promo-440x280.png, marquee-1400x560.png.
 *
 * One caveat, deliberate and contained: the popup only knows whether a page is
 * scannable if it can read the active tab's URL, and Chrome grants that through
 * `activeTab` on a real toolbar click, which is not scriptable. So the popup
 * shot — and only the popup shot — is taken against a throwaway copy of the same
 * build with a host permission added, purely so the popup shows the ordinary
 * enabled state users see in production. The shipped extension requests no host
 * permissions; `scripts/e2e-flow.mjs` asserts that on every run.
 */
import { chromium } from 'playwright';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  captureFixture,
  extPath,
  launchExtension,
  root,
  screenshot,
  seedCard,
  startFixtureServer,
} from './lib/harness.mjs';

const outDir = resolve(root, 'docs/store');
mkdirSync(outDir, { recursive: true });

const POSTERS = [
  {
    key: 'palette',
    badge: 'Capture',
    title: 'Colour palettes,\ngrouped by role',
    sub: 'Backgrounds, text, accents and borders — pulled from computed styles and ranked by use, not a flat hex dump.',
  },
  {
    key: 'typography',
    badge: 'Read',
    title: 'Typography, with\nthe font source',
    sub: 'Families, weights and sizes per element, and whether each comes from Google Fonts, Adobe Fonts or self-hosted.',
  },
  {
    key: 'export',
    badge: 'Export',
    title: 'Design tokens,\nnot screenshots',
    sub: 'One click exports any capture as CSS variables, Tailwind config, SCSS or W3C design tokens — paste it straight in.',
  },
  {
    key: 'popup',
    badge: 'Private',
    title: 'One click, and\n100% local',
    sub: 'Capture a page or grab a pixel with the native eyedropper. No account, no backend — your captures never leave your browser.',
  },
  {
    key: 'organise',
    badge: 'Organise',
    title: 'A library you can\nactually search',
    sub: 'Tag captures with a colour and an icon, add notes, and find any of them by URL, hex, font family or note.',
  },
];

function poster(imgB64, p) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0}
    body{width:1280px;height:800px;overflow:hidden;font-family:Inter,system-ui,sans-serif}
    .poster{width:1280px;height:800px;display:flex;background:radial-gradient(1200px 800px at 100% 0,#16233d,#0b1220 60%);color:#e6edf6}
    .left{width:40%;padding:0 56px;display:flex;flex-direction:column;justify-content:center}
    .badge{color:#38bdf8;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:13px}
    h2{font-size:46px;line-height:1.08;margin:16px 0 16px;white-space:pre-line;letter-spacing:-.01em}
    .sub{color:#9fb0c3;font-size:18px;line-height:1.5;max-width:420px}
    .brand{margin-top:34px;display:flex;align-items:center;gap:10px;color:#cbd5e1;font-weight:700}
    .dot{width:10px;height:10px;border-radius:50%}
    .right{flex:1;display:flex;align-items:center;justify-content:center;padding:48px 56px 48px 0}
    .shot{max-width:100%;max-height:704px;border-radius:16px;border:1px solid #243247;box-shadow:0 40px 80px rgba(0,0,0,.55)}
  </style></head><body><div class="poster">
    <div class="left">
      <div class="badge">${p.badge}</div>
      <h2>${p.title}</h2>
      <div class="sub">${p.sub}</div>
      <div class="brand">
        <span class="dot" style="background:#3b82f6"></span><span class="dot" style="background:#f59e0b"></span><span class="dot" style="background:#22c55e"></span>
        &nbsp;StyleGrab
      </div>
    </div>
    <div class="right"><img class="shot" src="data:image/png;base64,${imgB64}"></div>
  </div></body></html>`;
}

function tile({ width, height, swatches, big }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0}
    body{width:${width}px;height:${height}px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#e6edf6;
      background:radial-gradient(${width * 1.4}px ${height * 1.5}px at 100% 0,#16233d,#0b1220 65%)}
    .p{height:100%;padding:${big ? 56 : 26}px ${big ? 72 : 28}px;display:flex;flex-direction:column;
      justify-content:${big ? 'center' : 'space-between'};gap:${big ? 30 : 0}px}
    .top{display:flex;align-items:center;gap:10px}
    .mark{display:flex;gap:5px}.mark span{width:${big ? 18 : 13}px;height:${big ? 18 : 13}px;border-radius:50%}
    .name{font-weight:800;font-size:${big ? 32 : 22}px;letter-spacing:-.01em}
    .tag{font-family:Georgia,serif;font-size:${big ? 52 : 27}px;line-height:1.12;max-width:${big ? 900 : 380}px}
    .sub{color:#9fb0c3;font-size:${big ? 20 : 13}px;margin-top:${big ? 14 : 7}px}
    .sw{display:flex;gap:${big ? 10 : 7}px}
    .sw span{width:${big ? 58 : 36}px;height:${big ? 32 : 20}px;border-radius:6px;border:1px solid rgba(255,255,255,.14)}
  </style></head><body><div class="p">
    <div class="top"><span class="mark"><span style="background:#3b82f6"></span><span style="background:#f59e0b"></span><span style="background:#22c55e"></span></span><span class="name">StyleGrab</span></div>
    <div><div class="tag">Design tokens from any website.</div><div class="sub">Palettes &amp; type → CSS, Tailwind, SCSS, W3C. Free, no account.</div></div>
    <div class="sw">${swatches.map((h) => `<span style="background:${h}"></span>`).join('')}</div>
  </div></body></html>`;
}

/** Screenshots the real popup showing its ordinary, enabled state (see header). */
async function popupShot(origin) {
  const work = mkdtempSync(join(tmpdir(), 'sg-popup-build-'));
  const build = join(work, 'chrome-mv3');
  cpSync(extPath, build, { recursive: true });
  const manifestPath = join(build, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = ['<all_urls>'];
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1100, height: 800 },
    args: [`--disable-extensions-except=${build}`, `--load-extension=${build}`],
  });
  try {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15_000 });
    const extId = new URL(sw.url()).host;

    const site = await context.newPage();
    await site.goto(`${origin}/site.html`, { waitUntil: 'load' });

    const popup = await context.newPage();
    await popup.setViewportSize({ width: 360, height: 620 });
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    // The popup asks for the *active* tab, so let the fixture be that tab while
    // it mounts — exactly the situation a real toolbar click creates.
    await site.bringToFront();
    await popup.reload();
    await popup.getByText('Capture this page').waitFor({ timeout: 8_000 });
    await popup.waitForTimeout(300);

    const height = await popup.evaluate(() =>
      Math.ceil(document.getElementById('app').getBoundingClientRect().height),
    );
    await popup.setViewportSize({ width: 360, height });
    await popup.waitForTimeout(150);
    return (await screenshot(popup)).toString('base64');
  } finally {
    await context.close();
    rmSync(work, { recursive: true, force: true });
  }
}

const server = await startFixtureServer();
const ext = await launchExtension({ viewport: { width: 1100, height: 900 } });
const shots = {};

try {
  console.log('▶ capturing the fixture site with the shipped scanner');
  const { site, scan, thumbnail } = await captureFixture(ext.context, server.origin);
  await site.close();

  const library = await ext.context.newPage();
  await library.setViewportSize({ width: 900, height: 820 });
  await library.goto(ext.page('library.html'));
  await library.getByText('Your library is empty.').waitFor({ timeout: 8_000 });
  const card = await seedCard(library, scan, thumbnail);
  await library.reload();
  await library.getByText('StyleGrab Library').waitFor({ timeout: 8_000 });
  await library.locator('img').first().waitFor({ timeout: 8_000 });
  // Scrollbars are a rendering artefact of the screenshot viewport, not part of
  // the UI — hide them so the posters show only the extension.
  await library.addStyleTag({ content: '::-webkit-scrollbar{width:0;height:0}' });
  await library.waitForTimeout(400);

  console.log('▶ library');
  shots.palette = (await screenshot(library)).toString('base64');

  await library
    .getByRole('heading', { name: 'Typography' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await library.evaluate(() => window.scrollBy(0, -24));
  await library.waitForTimeout(300);
  shots.typography = (await screenshot(library)).toString('base64');

  await library.selectOption('select', 'tailwind');
  await library
    .getByRole('heading', { name: 'Export' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await library.evaluate(() => window.scrollBy(0, -24));
  await library.waitForTimeout(300);
  shots.export = (await screenshot(library)).toString('base64');

  console.log('▶ organise');
  await library.getByRole('button', { name: /Tag/ }).click();
  await library.locator('[title="#3b82f6"]').click();
  await library.getByRole('button', { name: '🎨' }).click();
  await library.getByPlaceholder('Your notes about this capture…').fill('Hero gradient + button accent — reuse on the pricing page.');
  await library.getByRole('heading', { name: 'Notes' }).click();
  await library.getByPlaceholder('Search by URL, colour hex, font family, notes…').fill('inter');
  await library.evaluate(() => window.scrollTo(0, 0));
  await library.waitForTimeout(400);
  shots.organise = (await screenshot(library)).toString('base64');

  console.log('▶ popup');
  shots.popup = await popupShot(server.origin);

  console.log('▶ composing posters');
  const poster0 = await ext.context.newPage();
  await poster0.setViewportSize({ width: 1280, height: 800 });
  let n = 1;
  for (const p of POSTERS) {
    await poster0.setContent(poster(shots[p.key], p), { waitUntil: 'load' });
    await poster0.waitForTimeout(200);
    const file = join(outDir, `shot-${n}-${p.key}.png`);
    await screenshot(poster0, { path: file, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    console.log(`  ✓ ${file}`);
    n++;
  }

  const swatches = [
    ...new Set(
      [...card.palette.accent, ...card.palette.background, ...card.palette.text].map((s) => s.hex),
    ),
  ].slice(0, 6);

  for (const [name, size] of [
    ['promo-440x280.png', { width: 440, height: 280, big: false }],
    ['marquee-1400x560.png', { width: 1400, height: 560, big: true }],
  ]) {
    const page = await ext.context.newPage();
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.setContent(tile({ ...size, swatches }), { waitUntil: 'load' });
    await page.waitForTimeout(150);
    const file = join(outDir, name);
    await screenshot(page, { path: file, clip: { x: 0, y: 0, width: size.width, height: size.height } });
    console.log(`  ✓ ${file}`);
    await page.close();
  }

  console.log('\n✓ Store assets generated from the real extension.');
} finally {
  await ext.close();
  await server.close();
}
