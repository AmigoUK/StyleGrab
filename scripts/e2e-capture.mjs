/**
 * End-to-end smoke of the extraction seam: runs the REAL scanner
 * (`lib/extract/scanner.ts`) against a real rendered page in real Chromium and
 * asserts it reads computed styles and font URLs correctly. This is the one part
 * the unit tests can't cover (they use synthetic RawSamples); the aggregators
 * that consume the scanner output are unit-tested separately.
 *
 *   npx playwright install chromium   # once
 *   node scripts/e2e-capture.mjs      # headless, no display needed
 */
import { chromium } from 'playwright';
import { transformSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Load our scanner, drop the `export` so it can be evaluated as a plain body,
// and strip TS types with esbuild.
const scannerTs = readFileSync(resolve(root, 'lib/extract/scanner.ts'), 'utf8').replace(
  'export function collectRawScan',
  'function collectRawScan',
);
const scannerJs = transformSync(scannerTs, { loader: 'ts' }).code;

const FIXTURE = `<!doctype html><html><head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700">
  </head><body style="background: rgb(2, 6, 23);">
  <div style="background: rgb(15,23,42); color: rgb(226,232,240); font-family: Inter, system-ui, sans-serif; font-weight: 700; font-size: 32px; border-top: 2px solid rgb(51,65,85);">
    <a href="#" style="color: rgb(37,99,235);">a link</a>
    <p style="font-family: Georgia, serif; font-weight: 400; font-size: 16px; background: rgb(255,255,255);">paragraph</p>
  </div>
</body></html>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(FIXTURE, { waitUntil: 'load' });

  const raw = await page.evaluate(`(() => { ${scannerJs}\n return collectRawScan(); })()`);

  assert.ok(raw.samples.length >= 3, `expected samples, got ${raw.samples.length}`);

  const bgs = raw.samples.map((s) => s.backgroundColor);
  assert.ok(bgs.includes('rgb(15, 23, 42)'), 'dark background not sampled');
  assert.ok(bgs.includes('rgb(255, 255, 255)'), 'white background not sampled');
  // The page's own background lives on <body>, which is the palette's most
  // important colour — regression guard for sampling only `body *`.
  assert.ok(bgs.includes('rgb(2, 6, 23)'), 'page (body) background not sampled');

  const linkColors = raw.samples.filter((s) => s.tag === 'a').map((s) => s.color);
  assert.ok(linkColors.includes('rgb(37, 99, 235)'), 'accent link colour not sampled');

  const families = raw.samples.map((s) => s.fontFamily).join(' | ');
  assert.ok(/Inter/.test(families), 'Inter family not sampled');
  assert.ok(/Georgia/.test(families), 'Georgia family not sampled');

  const borders = raw.samples.map((s) => s.borderColor);
  assert.ok(borders.includes('rgb(51, 65, 85)'), 'border colour not sampled');

  assert.ok(
    raw.fontUrls.some((u) => u.includes('fonts.googleapis.com')),
    'Google Fonts URL not collected',
  );

  console.log(`✓ Scanner extracted ${raw.samples.length} samples and ${raw.fontUrls.length} font URL(s).`);
  console.log('  backgrounds:', [...new Set(bgs)].join(', '));
  console.log('  fontUrls:', raw.fontUrls.join(', '));
  console.log('✓ Live extraction smoke passed.');
} finally {
  await browser.close();
}
