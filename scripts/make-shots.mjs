/**
 * Generates Chrome Web Store screenshots (1280×800) into docs/store/.
 * Each poster frames the REAL extension UI (library, export panel, popup) —
 * rendered from the actual components (esbuild-bundled, chrome.* shimmed) with a
 * genuine card scanned from a mock site — on a branded background with a caption.
 *
 *   npm run build && npx playwright install chromium
 *   node scripts/make-shots.mjs
 */
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'sg-shots-'));
const outDir = resolve(root, 'docs/store');
mkdirSync(outDir, { recursive: true });

async function bundle(contents, loader) {
  const out = await build({
    stdin: { contents, resolveDir: root, loader },
    bundle: true, format: 'iife', write: false,
    jsx: 'automatic', jsxImportSource: 'preact', alias: { '@': root }, logLevel: 'silent',
  });
  return out.outputFiles[0].text;
}

const scanBundle = await bundle(
  `import { collectRawScan } from '@/lib/extract/scanner';
   import { aggregatePalette } from '@/lib/extract/colors';
   import { aggregateTypography } from '@/lib/extract/typography';
   window.__sgScan = () => { const r = collectRawScan();
     return { url: r.url, title: r.title, palette: aggregatePalette(r.samples),
       typography: aggregateTypography(r.samples, r.fontUrls) }; };`, 'ts');
const libBundle = await bundle(
  `import { render } from 'preact';
   import { LibraryApp } from '@/entrypoints/library/LibraryApp';
   window.__mount = () => render(<LibraryApp />, document.getElementById('app'));`, 'tsx');
const popupBundle = await bundle(
  `import { render } from 'preact';
   import { PopupApp } from '@/entrypoints/popup/PopupApp';
   window.__mount = () => render(<PopupApp />, document.getElementById('app'));`, 'tsx');

const uiCss = readFileSync(resolve(root, 'assets/ui.css'), 'utf8');

const FIXTURE = readFileSyncSafe(resolve(root, 'docs/.fixture.html')) || `<!doctype html><html><head><meta charset="utf-8"><title>Acme — Ship faster</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800">
<style>*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#0b1220;color:#e6edf6}
.wrap{max-width:820px;margin:0 auto;padding:40px 28px}header{display:flex;align-items:center;justify-content:space-between}
.logo{font-weight:800;font-size:20px;color:#38bdf8}nav a{color:#94a3b8;text-decoration:none;margin-left:18px;font-size:14px}
h1{font-family:Georgia,serif;font-size:44px;line-height:1.1;margin:36px 0 14px}.lead{color:#9fb0c3;font-size:18px;max-width:560px}
.cta{margin-top:26px;display:flex;gap:12px}.btn{padding:11px 18px;border-radius:10px;font-weight:600;font-size:15px;border:1px solid transparent}
.btn.primary{background:#6366f1;color:#fff}.btn.ghost{background:transparent;color:#e6edf6;border-color:#334155}
.cards{margin-top:44px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}.c{background:#131c2e;border:1px solid #243247;border-radius:14px;padding:18px}
.c h3{margin:0 0 6px;font-size:16px;color:#f8fafc}.c p{margin:0;color:#8ca0b8;font-size:14px}
.pill{display:inline-block;margin-top:12px;padding:3px 10px;border-radius:999px;font-size:12px;background:#10b981;color:#04231a;font-weight:700}</style></head><body>
<div class="wrap"><header><span class="logo">Acme</span><nav><a href="#">Product</a><a href="#">Pricing</a><a href="#">Docs</a></nav></header>
<h1>Ship design systems, faster.</h1><p class="lead">Capture the look of any product and turn it into tokens your team can build on.</p>
<div class="cta"><a class="btn primary" href="#">Get started</a><a class="btn ghost" href="#">Live demo</a></div>
<div class="cards"><div class="c"><h3>Palette</h3><p>Grouped by role, ranked by use.</p><span class="pill">Live</span></div>
<div class="c"><h3>Typography</h3><p>Families, weights, sources.</p><span class="pill">Live</span></div>
<div class="c"><h3>Export</h3><p>CSS, Tailwind, SCSS, W3C.</p><span class="pill">Live</span></div></div></div></body></html>`;

function readFileSyncSafe(p) { try { return existsSync(p) ? readFileSync(p, 'utf8') : null; } catch { return null; } }

writeFileSync(join(work, 'site.html'), FIXTURE);

const server = http.createServer((req, res) => {
  const p = join(work, decodeURIComponent(req.url.split('?')[0]).slice(1));
  if (p.startsWith(work) && existsSync(p)) {
    res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(readFileSync(p));
  } else { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

function standalone(bundleJs, { card, thumb, popup } = {}) {
  const shim = popup
    ? `window.chrome={runtime:{getManifest:()=>({version:'0.3.2'}),sendMessage:()=>Promise.resolve({})},
         tabs:{query:()=>Promise.resolve([{id:1,windowId:1,url:'https://acme.example/',title:'Acme'}]),create:()=>Promise.resolve()}};
       window.EyeDropper=function(){};`
    : `const CARD=${JSON.stringify(card)};const store={cards:[CARD]};
       window.chrome={storage:{local:{get:(k)=>Promise.resolve(typeof k==='string'?{[k]:store[k]}:store),set:(o)=>{Object.assign(store,o);return Promise.resolve();}}},runtime:{getManifest:()=>({version:'0.3.2'})}};`;
  const seed = popup
    ? 'window.__seed=async()=>{};'
    : `window.__seed=async()=>{const blob=await(await fetch('data:image/png;base64,${thumb}')).blob();
        await new Promise((res,rej)=>{const r=indexedDB.open('stylegrab',1);
          r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('thumbnails'))r.result.createObjectStore('thumbnails',{keyPath:'id'})};
          r.onsuccess=()=>{const db=r.result,tx=db.transaction('thumbnails','readwrite');tx.objectStore('thumbnails').put({id:'demo',blob});tx.oncomplete=()=>{db.close();res()};tx.onerror=()=>rej(tx.error)};
          r.onerror=()=>rej(r.error);});};`;
  const bg = popup ? 'background:var(--bg);width:360px;' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>StyleGrab</title><style>${uiCss}
    body{${bg}}</style></head><body><div id="app"></div>
    <script>${shim}${seed}</script><script>${bundleJs}</script>
    <script>window.__seed().then(()=>window.__mount());</script></body></html>`;
}

const POSTERS = [
  { key: 'palette', badge: 'Capture', title: 'Colour palettes,\ngrouped by role', sub: 'Backgrounds, text, accents and borders — pulled from computed styles and ranked by use, not a flat hex dump.' },
  { key: 'typography', badge: 'Read', title: 'Typography, with\nthe font source', sub: 'Families, weights and sizes per element, and whether each comes from Google Fonts, Adobe Fonts or self-hosted.' },
  { key: 'export', badge: 'Export', title: 'Design tokens,\nnot screenshots', sub: 'One click exports any capture as CSS variables, Tailwind config, SCSS or W3C design tokens — paste it straight in.' },
  { key: 'popup', badge: 'Private', title: 'One click, and\n100% local', sub: 'Capture a page or grab a pixel with the native eyedropper. No account, no backend — your captures never leave your browser.' },
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

const context = await chromium.launchPersistentContext('', {
  headless: true, args: ['--headless=new'], viewport: { width: 1280, height: 800 },
});

try {
  // Scan the mock site for a real card + thumbnail.
  const site = await context.newPage();
  await site.setViewportSize({ width: 1040, height: 720 });
  await site.goto(`${baseUrl}/site.html`, { waitUntil: 'load' });
  await site.addScriptTag({ content: scanBundle });
  const scan = await site.evaluate('window.__sgScan()');
  const thumb = (await site.screenshot()).toString('base64');
  const card = { ...scan, url: 'https://acme.com/', title: 'Acme — Ship faster', id: 'demo', createdAt: '2026-07-28T10:00:00.000Z', notes: '' };

  // Render the library once, capture two crops (palette top, export panel).
  writeFileSync(join(work, 'lib.html'), standalone(libBundle, { card, thumb }));
  const lib = await context.newPage();
  await lib.setViewportSize({ width: 900, height: 820 });
  await lib.goto(`${baseUrl}/lib.html`, { waitUntil: 'load' });
  await lib.getByText('StyleGrab Library').waitFor({ timeout: 8000 });
  await lib.waitForTimeout(500);
  const shots = {};
  shots.palette = (await lib.screenshot()).toString('base64');

  await lib.getByRole('heading', { name: 'Typography' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await lib.evaluate(() => window.scrollBy(0, -24));
  await lib.waitForTimeout(300);
  shots.typography = (await lib.screenshot()).toString('base64');

  await lib.selectOption('select', 'tailwind');
  await lib.getByRole('heading', { name: 'Export' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await lib.evaluate(() => window.scrollBy(0, -24));
  await lib.waitForTimeout(300);
  shots.export = (await lib.screenshot()).toString('base64');

  // Popup.
  writeFileSync(join(work, 'popup.html'), standalone(popupBundle, { popup: true }));
  const pop = await context.newPage();
  await pop.setViewportSize({ width: 360, height: 600 });
  await pop.goto(`${baseUrl}/popup.html`, { waitUntil: 'load' });
  await pop.getByText('Capture this page').waitFor({ timeout: 8000 });
  await pop.waitForTimeout(300);
  // Crop the viewport to the popup's real content height so there's no dead space.
  const popH = await pop.evaluate(() => Math.ceil(document.getElementById('app').getBoundingClientRect().height));
  await pop.setViewportSize({ width: 360, height: popH });
  await pop.waitForTimeout(150);
  shots.popup = (await pop.screenshot()).toString('base64');

  // Compose the 1280×800 posters.
  const poster0 = await context.newPage();
  await poster0.setViewportSize({ width: 1280, height: 800 });
  let n = 1;
  for (const p of POSTERS) {
    await poster0.setContent(poster(shots[p.key], p), { waitUntil: 'load' });
    await poster0.waitForTimeout(200);
    const file = join(outDir, `shot-${n}-${p.key}.png`);
    await poster0.screenshot({ path: file, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    console.log(`✓ ${file}`);
    n++;
  }

  // Small promo tile (440×280) — brand mark, tagline and real swatches.
  const swatches = [...new Set([...card.palette.accent, ...card.palette.background, ...card.palette.text].map((s) => s.hex))].slice(0, 6);
  const promo = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0}
    body{width:440px;height:280px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#e6edf6;
      background:radial-gradient(620px 420px at 100% 0,#16233d,#0b1220 65%)}
    .p{height:100%;padding:26px 28px;display:flex;flex-direction:column;justify-content:space-between}
    .top{display:flex;align-items:center;gap:10px}
    .mark{display:flex;gap:5px}.mark span{width:13px;height:13px;border-radius:50%}
    .name{font-weight:800;font-size:22px;letter-spacing:-.01em}
    .tag{font-family:Georgia,serif;font-size:27px;line-height:1.12;max-width:380px}
    .sub{color:#9fb0c3;font-size:13px;margin-top:7px}
    .sw{display:flex;gap:7px}
    .sw span{width:36px;height:20px;border-radius:6px;border:1px solid rgba(255,255,255,.14)}
  </style></head><body><div class="p">
    <div class="top"><span class="mark"><span style="background:#3b82f6"></span><span style="background:#f59e0b"></span><span style="background:#22c55e"></span></span><span class="name">StyleGrab</span></div>
    <div><div class="tag">Design tokens from any website.</div><div class="sub">Palettes &amp; type → CSS, Tailwind, SCSS, W3C. Free, no account.</div></div>
    <div class="sw">${swatches.map((h) => `<span style="background:${h}"></span>`).join('')}</div>
  </div></body></html>`;
  const promoPage = await context.newPage();
  await promoPage.setViewportSize({ width: 440, height: 280 });
  await promoPage.setContent(promo, { waitUntil: 'load' });
  await promoPage.waitForTimeout(150);
  const promoFile = join(outDir, 'promo-440x280.png');
  await promoPage.screenshot({ path: promoFile, clip: { x: 0, y: 0, width: 440, height: 280 } });
  console.log(`✓ ${promoFile}`);
} finally {
  await context.close();
  server.close();
  rmSync(work, { recursive: true, force: true });
}
