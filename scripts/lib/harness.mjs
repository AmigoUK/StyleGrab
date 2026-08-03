/**
 * Shared browser harness for the scripts that drive a *real* StyleGrab build:
 * the end-to-end flow (`e2e-flow.mjs`) and the Chrome Web Store asset generator
 * (`make-shots.mjs`). Both load the built extension into Chromium, capture the
 * same fixture site with the real scanner and aggregators, and then work against
 * the genuine `chrome-extension://` pages.
 *
 * Everything here bundles the shipped TypeScript with esbuild — no re-implemented
 * storage, no hand-written card. What the pages render is what the extension
 * really produces.
 */
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const extPath = resolve(root, '.output/chrome-mv3');

/**
 * The mock product page every script captures. Deliberately opinionated: a dark
 * background, a light card surface, a clear accent, visible borders, a Google
 * Fonts <link> and a second (system) family — so palette roles and font-source
 * detection have something unambiguous to find.
 */
export const FIXTURE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Acme — Ship faster</title>
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

/** The URL the captured card claims — a real-looking origin instead of 127.0.0.1. */
export const FIXTURE_URL = 'https://acme.com/';
export const FIXTURE_TITLE = 'Acme — Ship faster';

export function requireBuild() {
  if (!existsSync(extPath)) {
    console.error(`Build not found at ${extPath}. Run "npm run build" first.`);
    process.exit(1);
  }
}

/** Serves the fixture site (and any extra files) over http, so it is a real origin. */
export async function startFixtureServer(extraFiles = {}) {
  const work = mkdtempSync(join(tmpdir(), 'sg-fixture-'));
  writeFileSync(join(work, 'site.html'), FIXTURE_HTML);
  for (const [name, contents] of Object.entries(extraFiles)) {
    writeFileSync(join(work, name), contents);
  }

  const server = http.createServer((req, res) => {
    const file = join(work, decodeURIComponent(req.url.split('?')[0]).slice(1));
    if (file.startsWith(work) && existsSync(file)) {
      res.writeHead(200, {
        'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream',
      });
      res.end(readFileSync(file));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, r));

  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    write(name, contents) {
      writeFileSync(join(work, name), contents);
    },
    async close() {
      server.close();
      rmSync(work, { recursive: true, force: true });
    },
  };
}

/**
 * Loads the built extension into a persistent Chromium context and resolves the
 * generated extension id from its service worker. MV3 needs a headed browser —
 * run under `xvfb-run -a` where there is no display.
 */
export async function launchExtension({ viewport = { width: 1280, height: 800 } } = {}) {
  requireBuild();
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    viewport,
    args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
  });

  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const extId = new URL(sw.url()).host;

  return {
    context,
    sw,
    extId,
    page: (path) => `chrome-extension://${extId}/${path}`,
    close: () => context.close(),
  };
}

/**
 * Headed Chromium can only capture the tab that is actually being composited,
 * and right after a resize it briefly refuses. Bring the page to the front and
 * retry rather than failing the whole run on a timing artefact.
 */
export async function screenshot(page, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await page.bringToFront();
      return await page.screenshot(options);
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(300);
    }
  }
  throw lastError;
}

async function bundle(contents, loader = 'ts') {
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

/** Bundles the shipped scanner + aggregators and exposes them as `window.__sgScan()`. */
export function scannerBundle() {
  return bundle(
    `import { collectRawScan } from '@/lib/extract/scanner';
     import { aggregatePalette } from '@/lib/extract/colors';
     import { aggregateTypography } from '@/lib/extract/typography';
     window.__sgScan = () => {
       const raw = collectRawScan();
       return { url: raw.url, title: raw.title, palette: aggregatePalette(raw.samples),
                typography: aggregateTypography(raw.samples, raw.fontUrls) };
     };`,
  );
}

/** Bundles the shipped storage layer and exposes it as `window.__sgStore`. */
export function storeBundle() {
  return bundle(
    `import { addCard } from '@/lib/storage';
     import { putThumbnail } from '@/lib/captureStore';
     window.__sgStore = { addCard, putThumbnail };`,
  );
}

/**
 * Captures the fixture site with the real scanner and aggregators and returns a
 * ScanResult plus a screenshot to use as the card thumbnail.
 */
export async function captureFixture(context, origin, { viewport = { width: 1040, height: 720 } } = {}) {
  const site = await context.newPage();
  await site.setViewportSize(viewport);
  await site.goto(`${origin}/site.html`, { waitUntil: 'load' });
  await site.addScriptTag({ content: await scannerBundle() });

  const scan = await site.evaluate('window.__sgScan()');
  const thumbnail = (await screenshot(site)).toString('base64');

  return { site, scan: { ...scan, url: FIXTURE_URL, title: FIXTURE_TITLE }, thumbnail };
}

/**
 * Writes a card into the extension's real storage from an extension page, using
 * the extension's own `addCard` / `putThumbnail` — same code path the service
 * worker takes after a capture.
 */
export async function seedCard(page, scan, thumbnail) {
  // Extension pages run under the MV3 CSP (`script-src 'self'`), which blocks an
  // injected <script>. Evaluating through the debugger is not subject to it.
  await page.evaluate(await storeBundle());
  return page.evaluate(
    async ([scanJson, thumb]) => {
      const card = await window.__sgStore.addCard(JSON.parse(scanJson));
      if (thumb) {
        const blob = await (await fetch(`data:image/png;base64,${thumb}`)).blob();
        await window.__sgStore.putThumbnail(card.id, blob);
      }
      return card;
    },
    [JSON.stringify(scan), thumbnail ?? ''],
  );
}
