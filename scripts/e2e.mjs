/**
 * Minimal end-to-end smoke test: loads the built extension into a real Chromium
 * and asserts the library page renders. MV3 extensions need a headed context, so
 * run under a virtual display:
 *
 *   npm run build
 *   npx playwright install chromium   # once
 *   xvfb-run -a node scripts/e2e.mjs
 *
 * Exits non-zero on failure so CI can gate on it.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extPath = resolve(root, '.output/chrome-mv3');

if (!existsSync(extPath)) {
  console.error(`Build not found at ${extPath}. Run "npm run build" first.`);
  process.exit(1);
}

const context = await chromium.launchPersistentContext('', {
  headless: false,
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
});

try {
  // Discover the extension id from its service worker.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extId = new URL(sw.url()).host;
  console.log(`Extension loaded: ${extId}`);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/library.html`);

  await page.getByText('StyleGrab Library').waitFor({ timeout: 5_000 });
  await page.getByText('Your library is empty.').waitFor({ timeout: 5_000 });

  console.log('✓ Library page renders with the empty state.');
} finally {
  await context.close();
}
