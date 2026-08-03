/**
 * Full end-to-end flow against the REAL built extension: manifest guarantees,
 * the popup's guard rails, the background's capture refusal, and the whole
 * library journey — card → palette by role → typography with font source →
 * every export format → search → delete.
 *
 *   npm run build
 *   npx playwright install chromium   # once
 *   xvfb-run -a node scripts/e2e-flow.mjs
 *
 * Note on the capture path: Chrome grants `activeTab` only when the user clicks
 * the toolbar icon, and that click is not scriptable. So this script asserts the
 * *refusal* the extension must produce without that grant, and seeds the library
 * through the extension's own `addCard`/`putThumbnail` with a card produced by
 * the real scanner and aggregators running on a real page. The grant-side
 * orchestration itself is unit-tested in `tests/capture.test.ts`, and the
 * scanner is smoke-tested in `scripts/e2e-capture.mjs`.
 *
 * Exits non-zero on failure so CI can gate on it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  captureFixture,
  extPath,
  launchExtension,
  root,
  seedCard,
  startFixtureServer,
} from './lib/harness.mjs';

const checks = [];
function ok(label) {
  checks.push(label);
  console.log(`  ✓ ${label}`);
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

console.log('▶ manifest');
const manifest = JSON.parse(readFileSync(resolve(extPath, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3, 'must ship Manifest V3');
ok('Manifest V3');
assert.equal(manifest.version, pkg.version, 'manifest version must track package.json');
ok(`version ${manifest.version} matches package.json`);
assert.deepEqual(
  [...manifest.permissions].sort(),
  ['activeTab', 'scripting', 'storage'],
  'permission set is a product promise — activeTab + storage + scripting only',
);
ok('permissions are exactly activeTab, scripting, storage');
assert.ok(!manifest.host_permissions, 'no host_permissions may be requested');
assert.ok(!manifest.permissions.includes('tabs'), 'the tabs permission must never appear');
ok('no host_permissions and no tabs permission');
assert.ok(manifest.description.length <= 132, 'store short description limit is 132 chars');
ok(`description is ${manifest.description.length}/132 chars`);
for (const size of ['16', '32', '48', '128']) {
  assert.ok(manifest.icons?.[size], `icon ${size} missing from the manifest`);
}
ok('icons 16/32/48/128 declared');

const server = await startFixtureServer();
const ext = await launchExtension();

try {
  console.log('▶ popup');
  const popup = await ext.context.newPage();
  await popup.setViewportSize({ width: 360, height: 620 });
  await popup.goto(ext.page('popup.html'));
  await popup.getByText('Capture this page').waitFor({ timeout: 8_000 });
  ok('popup renders');

  // The popup itself lives on a chrome-extension:// page, which the guard must
  // reject — the same code path that protects the Web Store and chrome:// pages.
  await popup.getByText("This page can't be scanned").waitFor({ timeout: 5_000 });
  assert.equal(
    await popup.getByRole('button', { name: /Capture this page/ }).isDisabled(),
    true,
    'capture must be disabled on an unscannable page',
  );
  ok('capture is disabled and explained on an unscannable page');
  assert.equal(await popup.getByRole('button', { name: /Open library/ }).isDisabled(), false);
  ok('library shortcut stays available');

  console.log('▶ background');
  const refusal = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'capture' }));
  assert.deepEqual(refusal, { error: 'restricted' }, 'background must refuse an ungranted capture');
  ok('background refuses a capture with no activeTab grant');
  const pong = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'ping' }));
  assert.deepEqual(pong, { ok: true }, 'service worker must answer a ping');
  ok('service worker answers a ping');
  await popup.close();

  console.log('▶ capture the fixture site');
  const { site, scan, thumbnail } = await captureFixture(ext.context, server.origin);
  assert.ok(scan.palette.background.length >= 2, 'expected several background colours');
  assert.ok(
    scan.palette.background.some((s) => s.hex === '#0b1220'),
    `page background not captured, got ${scan.palette.background.map((s) => s.hex).join(', ')}`,
  );
  assert.ok(scan.palette.accent.some((s) => s.hex === '#6366f1'), 'primary button accent not captured');
  assert.ok(scan.palette.border.some((s) => s.hex === '#243247'), 'card border not captured');
  ok('palette is grouped by role with the expected colours');

  const inter = scan.typography.find((t) => t.family === 'Inter');
  assert.ok(inter, 'Inter not detected');
  assert.equal(inter.source, 'google', 'Inter must be identified as Google Fonts');
  assert.ok(scan.typography.some((t) => t.family === 'Georgia'), 'Georgia not detected');
  ok('typography identifies Inter as Google Fonts alongside a system family');
  await site.close();

  console.log('▶ library');
  const library = await ext.context.newPage();
  await library.setViewportSize({ width: 1100, height: 900 });
  await library.goto(ext.page('library.html'));
  await library.getByText('Your library is empty.').waitFor({ timeout: 8_000 });
  ok('library starts empty');

  const card = await seedCard(library, scan, thumbnail);
  await library.reload();
  await library.getByText('1 capture').waitFor({ timeout: 8_000 });
  ok('the captured card appears in the library');

  await library.getByRole('link', { name: 'Acme — Ship faster' }).waitFor({ timeout: 5_000 });
  for (const heading of ['Backgrounds', 'Accents', 'Borders', 'Typography']) {
    await library.getByRole('heading', { name: heading }).first().waitFor({ timeout: 5_000 });
  }
  ok('the card renders its role headings and typography');

  await library.getByText('Google Fonts').first().waitFor({ timeout: 5_000 });
  ok('the font source badge reads Google Fonts');

  await library.locator('img').first().waitFor({ timeout: 5_000 });
  ok('the screenshot thumbnail loads from IndexedDB');

  console.log('▶ export');
  const preview = library.locator('.export-preview');
  const css = await preview.inputValue();
  assert.match(css, /^\/\* StyleGrab — https:\/\/acme\.com\/ \*\//, 'CSS export header missing');
  assert.match(css, /--bg-1: #[0-9a-f]{6};/, 'CSS export has no background variable');
  assert.match(css, /--font-inter: Inter/, 'CSS export has no Inter font variable');
  ok('CSS custom properties export');

  await library.selectOption('select', 'tailwind');
  const tw = await preview.inputValue();
  assert.match(tw, /module\.exports = \{/, 'Tailwind export is not a module');
  const twParsed = JSON.parse(tw.slice(tw.indexOf('{'), tw.lastIndexOf('}') + 1));
  assert.ok(twParsed.theme.extend.colors.background['1'], 'Tailwind export has no background colour');
  assert.ok(twParsed.theme.extend.fontFamily.inter, 'Tailwind export has no Inter family');
  ok('Tailwind config export parses');

  await library.selectOption('select', 'scss');
  assert.match(await preview.inputValue(), /^\$bg-1: #[0-9a-f]{6};$/m, 'SCSS export missing $bg-1');
  ok('SCSS variables export');

  await library.selectOption('select', 'w3c');
  const tokens = JSON.parse(await preview.inputValue());
  assert.equal(tokens.color.background['1'].$type, 'color', 'W3C token type wrong');
  assert.equal(tokens.fontFamily.inter.$type, 'fontFamily', 'W3C font token missing');
  ok('W3C design tokens export parses');

  console.log('▶ notes, tagging and search');
  await library.getByPlaceholder('Your notes about this capture…').fill('hero gradient');
  await library.getByRole('heading', { name: 'Export' }).first().click(); // blur → save
  await library.reload();
  await library.getByText('1 capture').waitFor({ timeout: 8_000 });
  assert.equal(
    await library.getByPlaceholder('Your notes about this capture…').inputValue(),
    'hero gradient',
    'notes did not survive a reload',
  );
  ok('notes persist across a reload');

  await library.getByRole('button', { name: /Tag/ }).click();
  await library.locator('[title="#3b82f6"]').click();
  await library.getByRole('button', { name: '🎨' }).click();
  await library.reload();
  await library.getByText('1 capture').waitFor({ timeout: 8_000 });
  await library.locator('.tag-chip').waitFor({ timeout: 5_000 });
  ok('the chosen tag colour and icon persist');

  const search = library.getByPlaceholder('Search by URL, colour hex, font family, notes…');
  await search.fill('inter');
  await library.getByRole('link', { name: 'Acme — Ship faster' }).waitFor({ timeout: 5_000 });
  await search.fill('zzzz');
  await library.getByText(/No captures match/).waitFor({ timeout: 5_000 });
  await search.fill('hero gradient');
  await library.getByRole('link', { name: 'Acme — Ship faster' }).waitFor({ timeout: 5_000 });
  ok('search matches font family and notes, and explains an empty result');
  await search.fill('');

  console.log('▶ delete');
  await library.getByRole('button', { name: 'Delete' }).click();
  await library.getByText('Your library is empty.').waitFor({ timeout: 5_000 });
  await library.reload();
  await library.getByText('Your library is empty.').waitFor({ timeout: 8_000 });
  ok('deleting the last card empties the library for good');

  const orphan = await library.evaluate(
    (id) =>
      new Promise((res, rej) => {
        const req = indexedDB.open('stylegrab', 1);
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction('thumbnails', 'readonly').objectStore('thumbnails').get(id);
          get.onsuccess = () => {
            db.close();
            res(get.result ?? null);
          };
          get.onerror = () => rej(get.error);
        };
        req.onerror = () => rej(req.error);
      }),
    card.id,
  );
  assert.equal(orphan, null, 'thumbnail left behind in IndexedDB after delete');
  ok('the thumbnail is deleted with the card, leaving nothing orphaned');

  console.log(`\n✓ End-to-end flow passed — ${checks.length} checks.`);
} finally {
  await ext.close();
  await server.close();
}
