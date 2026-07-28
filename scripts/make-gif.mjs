/**
 * Records the capture→export story as a GIF for the README.
 *
 * The card shown is REAL: the actual scanner + aggregators (bundled with
 * esbuild) run against a mock website and produce the palette/typography. The
 * library UI in the GIF is the REAL LibraryApp/CardView code, bundled and run as
 * a standalone page with a thin `chrome.*` shim — the same components users see,
 * driven over a local http server (new headless Chromium can't load an unpacked
 * MV3 extension here, but screenshots it reliably).
 *
 *   npm run build && npx playwright install chromium
 *   node scripts/make-gif.mjs
 */
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import http from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frames = mkdtempSync(join(tmpdir(), 'sg-gif-'));
const VW = 940;
const VH = 640;

async function bundle(contents, loader) {
  const out = await build({
    stdin: { contents, resolveDir: root, loader },
    bundle: true,
    format: 'iife',
    write: false,
    jsx: 'automatic',
    jsxImportSource: 'preact',
    alias: { '@': root },
    logLevel: 'silent',
  });
  return out.outputFiles[0].text;
}

// Bundle 1: real scanner + aggregators, exposed as window.__sgScan.
const scanBundle = await bundle(
  `import { collectRawScan } from '@/lib/extract/scanner';
   import { aggregatePalette } from '@/lib/extract/colors';
   import { aggregateTypography } from '@/lib/extract/typography';
   window.__sgScan = () => { const r = collectRawScan();
     return { url: r.url, title: r.title, palette: aggregatePalette(r.samples),
       typography: aggregateTypography(r.samples, r.fontUrls) }; };`,
  'ts',
);

// Bundle 2: the real LibraryApp, exposed as window.__mount.
const libBundle = await bundle(
  `import { render } from 'preact';
   import { LibraryApp } from '@/entrypoints/library/LibraryApp';
   window.__mount = () => render(<LibraryApp />, document.getElementById('app'));`,
  'tsx',
);

const uiCss = readFileSync(resolve(root, 'assets/ui.css'), 'utf8');

const FIXTURE = `<!doctype html><html><head><meta charset="utf-8"><title>Acme — Ship faster</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family: Inter, system-ui, sans-serif; background:#0b1220; color:#e6edf6; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 40px 28px; }
  header { display:flex; align-items:center; justify-content:space-between; }
  .logo { font-weight:800; font-size:20px; color:#38bdf8; }
  nav a { color:#94a3b8; text-decoration:none; margin-left:18px; font-size:14px; }
  h1 { font-family: Georgia, serif; font-size:44px; line-height:1.1; margin:36px 0 14px; }
  .lead { color:#9fb0c3; font-size:18px; max-width:560px; }
  .cta { margin-top:26px; display:flex; gap:12px; }
  .btn { padding:11px 18px; border-radius:10px; font-weight:600; font-size:15px; border:1px solid transparent; }
  .btn.primary { background:#6366f1; color:#fff; }
  .btn.ghost { background:transparent; color:#e6edf6; border-color:#334155; }
  .cards { margin-top:44px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
  .c { background:#131c2e; border:1px solid #243247; border-radius:14px; padding:18px; }
  .c h3 { margin:0 0 6px; font-size:16px; color:#f8fafc; }
  .c p { margin:0; color:#8ca0b8; font-size:14px; }
  .pill { display:inline-block; margin-top:12px; padding:3px 10px; border-radius:999px; font-size:12px; background:#10b981; color:#04231a; font-weight:700; }
</style></head><body>
  <div class="wrap">
    <header><span class="logo">Acme</span>
      <nav><a href="#">Product</a><a href="#">Pricing</a><a href="#">Docs</a></nav></header>
    <h1>Ship design systems, faster.</h1>
    <p class="lead">Capture the look of any product and turn it into tokens your team can build on.</p>
    <div class="cta"><a class="btn primary" href="#">Get started</a><a class="btn ghost" href="#">Live demo</a></div>
    <div class="cards">
      <div class="c"><h3>Palette</h3><p>Grouped by role, ranked by use.</p><span class="pill">Live</span></div>
      <div class="c"><h3>Typography</h3><p>Families, weights, sources.</p><span class="pill">Live</span></div>
      <div class="c"><h3>Export</h3><p>CSS, Tailwind, SCSS, W3C.</p><span class="pill">Live</span></div>
    </div>
  </div>
</body></html>`;

writeFileSync(join(frames, 'site.html'), FIXTURE);

// Local static server (IndexedDB needs a real origin, not file://).
const server = http.createServer((req, res) => {
  const p = join(frames, decodeURIComponent(req.url.split('?')[0]).slice(1));
  if (p.startsWith(frames) && existsSync(p)) {
    res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(readFileSync(p));
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const context = await chromium.launchPersistentContext('', {
  headless: true,
  args: ['--headless=new'],
  viewport: { width: VW, height: VH },
});

let i = 0;
const shot = async (page, n = 1) => {
  for (let k = 0; k < n; k++) {
    await page.screenshot({ path: join(frames, `f${String(i++).padStart(3, '0')}.png`) });
  }
};

try {
  // 1. The mock website — scan it for real, grab a thumbnail, record it.
  const site = await context.newPage();
  await site.goto(`${base}/site.html`, { waitUntil: 'load' });
  await site.addScriptTag({ content: scanBundle });
  const scan = await site.evaluate('window.__sgScan()');
  const thumb = (await site.screenshot()).toString('base64');
  await shot(site, 3);

  const card = { ...scan, id: 'demo', createdAt: '2026-07-28T10:00:00.000Z', notes: '' };

  // 2. Standalone demo page rendering the REAL library UI with a chrome shim.
  const demo = `<!doctype html><html><head><meta charset="utf-8"><title>StyleGrab</title>
<style>${uiCss}</style></head><body><div id="app"></div>
<script>
  const CARD = ${JSON.stringify(card)};
  const store = { cards: [CARD] };
  window.chrome = {
    storage: { local: {
      get: (k) => Promise.resolve(typeof k === 'string' ? { [k]: store[k] } : store),
      set: (o) => { Object.assign(store, o); return Promise.resolve(); },
    } },
    runtime: { getManifest: () => ({ version: '0.3.1' }) },
  };
  async function seedThumb() {
    const blob = await (await fetch('data:image/png;base64,${thumb}')).blob();
    await new Promise((res, rej) => {
      const r = indexedDB.open('stylegrab', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('thumbnails')) r.result.createObjectStore('thumbnails', { keyPath: 'id' }); };
      r.onsuccess = () => { const db = r.result, tx = db.transaction('thumbnails', 'readwrite'); tx.objectStore('thumbnails').put({ id: 'demo', blob }); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); };
      r.onerror = () => rej(r.error);
    });
  }
  window.__seed = seedThumb;
</script>
<script>${libBundle}</script>
<script>window.__seed().then(() => window.__mount());</script>
</body></html>`;
  writeFileSync(join(frames, 'demo.html'), demo);

  const lib = await context.newPage();
  await lib.goto(`${base}/demo.html`, { waitUntil: 'load' });
  await lib.getByText('StyleGrab Library').waitFor({ timeout: 8000 });
  await lib.getByText('Acme').first().waitFor({ timeout: 8000 });
  await lib.waitForTimeout(400);
  await shot(lib, 4); // top: thumbnail + palette by role

  // 3. Scroll to the export panel, switch formats, then copy — all on screen.
  await lib.getByRole('heading', { name: 'Export' }).scrollIntoViewIfNeeded();
  await lib.waitForTimeout(300);
  await shot(lib, 2);
  for (const [fmt, dwell] of [['scss', 2], ['tailwind', 3], ['w3c', 3], ['css', 2]]) {
    await lib.selectOption('select', fmt);
    await lib.locator('.export-preview').scrollIntoViewIfNeeded();
    await lib.waitForTimeout(250);
    await shot(lib, dwell);
  }
  const copyBtn = lib.getByRole('button', { name: 'Copy' });
  await copyBtn.scrollIntoViewIfNeeded();
  await copyBtn.click();
  await lib.waitForTimeout(150);
  await shot(lib, 4); // "✓ Copied"

  const out = resolve(root, 'docs/capture-export.gif');
  const files = readdirSync(frames).filter((f) => /^f\d+\.png$/.test(f)).sort().map((f) => join(frames, f));
  execFileSync('convert', ['-delay', '55', '-loop', '0', ...files, '-resize', '760', '-layers', 'optimize', '-colors', '128', out], { stdio: 'inherit' });
  console.log(`✓ Wrote ${out} from ${files.length} frames.`);
} finally {
  await context.close();
  server.close();
  rmSync(frames, { recursive: true, force: true });
}
