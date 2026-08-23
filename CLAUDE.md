# Project Overview
StyleGrab is a zero-backend Chrome extension (Manifest V3) that captures a website's visual DNA — colour palette (grouped by role, perceptually clustered, named after the site's own `:root` tokens where it declares them) and typography (with the font source identified) — and exports it as code: CSS custom properties, Tailwind config, SCSS variables, W3C design tokens, an agent-ready STYLE.md spec or Tokens Studio JSON. Cards carry a WCAG contrast readout and a curatable palette. Every capture is saved to a local library. No account, no network calls; all data stays on the user's machine.

# Tech Stack
- TypeScript 5.6 (strict), Preact 10.24
- WXT 0.20 (Manifest V3 build framework, Vite 8.1) — global `chrome.*` API typed via `@types/chrome`
- Vitest 4.1 in jsdom (unit + component tests in `tests/`), Playwright 1.61 (end-to-end via `scripts/`)
- Node 22.23 / npm 10.9
- Chrome APIs: activeTab, storage (local), scripting; `chrome.tabs.captureVisibleTab` (under activeTab) for thumbnails; native `window.EyeDropper` for the picker
- Styling: hand-written CSS with custom properties in `assets/ui.css` (dark theme). No Tailwind in the extension's own UI — "Tailwind config" is one of the user-facing *export* formats, not how StyleGrab is styled.

# Naming & Coding Conventions
- Entrypoints in `entrypoints/` (WXT convention: `background.ts`, `*.content.ts`, page dirs with `index.html` + `main.tsx` + `<Name>App.tsx`); shared logic in `lib/` (camelCase files), UI components in `components/` (PascalCase).
- Data model in `lib/types.ts`. Card metadata → `chrome.storage.local` (`lib/storage.ts`); screenshot thumbnails → IndexedDB (`lib/captureStore.ts`), keyed by card id. Ids via `crypto.randomUUID()`.
- Pure logic (colour aggregation, font-source detection, exporters) lives in `lib/` and MUST have Vitest coverage — these run without a browser. Coverage thresholds in `vitest.config.ts` are enforced by CI, so new `lib/` code needs tests to merge.
- Tests share one fake `chrome` API and a per-test in-memory IndexedDB from `tests/setup.ts`; extend that rather than mocking `chrome.*` inside a suite. Card fixtures live in `tests/fixtures.ts`, component tests in `tests/ui/`.
- Browser-dependent work goes through `scripts/lib/harness.mjs`, which loads the built extension, captures a fixture site with the shipped scanner and seeds cards via the extension's own storage. `e2e-flow`, `make-shots` and `make-gif` all build on it — every screenshot in the repo must come from the real extension, never a re-render.
- Store copy lives in `docs/STORE_LISTING.md` and the dashboard walkthrough in `docs/STORE_SUBMISSION.md`; the public site and privacy policy are `docs/index.html` and `docs/privacy/index.html`, served by GitHub Pages from `/docs`.
- Any UI that picks an icon/colour uses a clickable **picker** (`components/ColorIconPicker.tsx`), never a hand-entry text field.
- Every full-shell page carries `components/AppFooter.tsx`.
- Releases: SemVer from v0.0.1, Keep-a-Changelog in `CHANGELOG.md`, annotated git tags, GitHub Releases with the `npm run zip` artifact attached.
- `package.json` `overrides` pin patched transitive build deps; keep `npm audit` at zero.

# Protected Files
- `LICENSE` — MIT; do not change the licence without explicit request.
- `public/icon/*` — brand assets; regenerate only on explicit request.
- `PRIVACY.md` and Chrome Web Store listing assets (once added) — compliance documents; every permission or data-flow change must be reflected there, never silently.

# Critical gotchas
- Privacy-minimal permission set is a product promise: `activeTab` + `storage` + `scripting` only — no `host_permissions`, no `tabs`. `captureVisibleTab` works under `activeTab` **only on a user gesture**, so capture is always initiated from the popup, never in the background.
- Isolated-world content scripts can read computed styles fine, but reading cross-origin stylesheet rules (`CSSStyleSheet.cssRules`) throws — font-source detection must fall back to `<link href>` / `@font-face` URLs it can see, and swallow the SecurityError.
- `window.EyeDropper` is unavailable in some contexts — feature-detect and disable the button when absent.
- Chrome grants `activeTab` only on a real toolbar click, which cannot be scripted. No automation can exercise the granted capture path, so `scripts/e2e-flow.mjs` asserts the *refusal* and `tests/capture.test.ts` covers the granted flow. Do not add a host permission to make a test pass.
- Extension pages run under the MV3 CSP (`script-src 'self'`), so Playwright's `addScriptTag` is blocked there — use `page.evaluate(bundleSource)`. And headed Chromium refuses to screenshot a tab it is not compositing; use the harness's `screenshot()` helper, which brings the page to the front and retries.
- MV3 extensions load only into a headed browser, so every Playwright script needs `xvfb-run -a` where there is no display.
