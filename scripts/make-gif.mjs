/**
 * Records the capture→export story as a GIF for the README, driving the REAL
 * loaded extension: the fixture site is captured by the shipped scanner and
 * aggregators, and every library frame is the genuine `chrome-extension://`
 * page — not a re-render of its components.
 *
 *   npm run build
 *   npx playwright install chromium   # once
 *   xvfb-run -a node scripts/make-gif.mjs
 *
 * Needs ImageMagick's `convert` on PATH to assemble the frames.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  captureFixture,
  launchExtension,
  root,
  screenshot,
  seedCard,
  startFixtureServer,
} from './lib/harness.mjs';

const frames = mkdtempSync(join(tmpdir(), 'sg-gif-'));
const VW = 940;
const VH = 640;

let i = 0;
const shot = async (page, n = 1) => {
  for (let k = 0; k < n; k++) {
    await screenshot(page, { path: join(frames, `f${String(i++).padStart(3, '0')}.png`) });
  }
};

const server = await startFixtureServer();
const ext = await launchExtension({ viewport: { width: VW, height: VH } });

try {
  // 1. The site being captured.
  const { site, scan, thumbnail } = await captureFixture(ext.context, server.origin, {
    viewport: { width: VW, height: VH },
  });
  await shot(site, 3);
  await site.close();

  // 2. The real library page, holding the card that capture produced.
  const lib = await ext.context.newPage();
  await lib.setViewportSize({ width: VW, height: VH });
  await lib.bringToFront();
  await lib.goto(ext.page('library.html'));
  await lib.getByText('Your library is empty.').waitFor({ timeout: 8_000 });
  await seedCard(lib, scan, thumbnail);
  await lib.reload();
  await lib.getByText('StyleGrab Library').waitFor({ timeout: 8_000 });
  await lib.locator('img').first().waitFor({ timeout: 8_000 });
  await lib.addStyleTag({ content: '::-webkit-scrollbar{width:0;height:0}' });
  await lib.waitForTimeout(400);
  await shot(lib, 4); // thumbnail + palette by role

  // 3. The export panel, cycling formats, ending on a copy.
  await lib.getByRole('heading', { name: 'Export' }).scrollIntoViewIfNeeded();
  await lib.waitForTimeout(300);
  await shot(lib, 2);
  for (const [format, dwell] of [
    ['scss', 2],
    ['tailwind', 3],
    ['w3c', 3],
    ['css', 2],
  ]) {
    await lib.selectOption('select', format);
    await lib.locator('.export-preview').scrollIntoViewIfNeeded();
    await lib.waitForTimeout(250);
    await shot(lib, dwell);
  }
  const copy = lib.getByRole('button', { name: 'Copy' });
  await copy.scrollIntoViewIfNeeded();
  await copy.click();
  await lib.waitForTimeout(150);
  await shot(lib, 4); // "✓ Copied"

  const out = resolve(root, 'docs/capture-export.gif');
  const files = readdirSync(frames)
    .filter((f) => /^f\d+\.png$/.test(f))
    .sort()
    .map((f) => join(frames, f));
  execFileSync(
    'convert',
    ['-delay', '55', '-loop', '0', ...files, '-resize', '760', '-layers', 'optimize', '-colors', '128', out],
    { stdio: 'inherit' },
  );
  console.log(`✓ Wrote ${out} from ${files.length} frames.`);
} finally {
  await ext.close();
  await server.close();
  rmSync(frames, { recursive: true, force: true });
}
