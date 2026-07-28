# Changelog

All notable changes to **StyleGrab** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [0.3.2] — 2026-07-28

### Added
- **Capture→export demo GIF in the README** (`docs/capture-export.gif`), plus the
  `scripts/make-gif.mjs` recorder (`npm run gif`) that generates it. The demo runs
  the real scanner + aggregators against a mock site and drives the real library
  UI, so the palette, typography and exports shown are genuine output — not a
  mockup.

### Changed
- Docs/tooling only; the shipped extension is unchanged from v0.3.1.

## [0.3.1] — 2026-07-28

### Added
- **Real brand icons** replacing the placeholder — a dark rounded tile with three
  overlapping colour swatches (blue/amber/green), rendered from a 512px master to
  every size (`public/icon/*`).
- **Live extraction smoke** (`scripts/e2e-capture.mjs`, `npm run e2e:capture`):
  runs the real scanner against a rendered page in headless Chromium and asserts
  it reads computed colours, font families, borders and font URLs. Verified
  passing — this closes the one seam the unit tests could not cover.

### Fixed
- Scanner de-duplicates collected font URLs (a stylesheet `<link>` no longer
  appears twice).

## [0.3.0] — 2026-07-28

### Added
- **Library search.** A search box filters captures by URL, title, notes, any
  palette hex, or any typography family/stack/source (`lib/search.ts`), with a
  no-matches message. Pure filter, unit-tested.
- **Privacy policy** (`PRIVACY.md`) and a Chrome Web Store listing document
  (`docs/STORE_LISTING.md`) with the listing copy and a pre-submission asset
  checklist.
- **End-to-end smoke test** (`scripts/e2e.mjs`, `npm run e2e`): loads the built
  extension into a real Chromium via Playwright and asserts the library page
  renders. Verified passing under `xvfb-run`.

## [0.2.0] — 2026-07-28

### Added
- **Three more export formats.** Alongside CSS custom properties, a card now
  exports as **SCSS variables** (`lib/exporters/scss.ts`), a **Tailwind config**
  fragment (`theme.extend.colors` + `fontFamily`, `lib/exporters/tailwind.ts`)
  and **W3C design tokens** JSON (`$type`/`$value` nodes, `lib/exporters/w3c.ts`).
  The library's export dropdown offers all four with live preview, copy and
  download.
- **Native eyedropper.** A "Pick a colour" action in the popup uses the browser's
  `EyeDropper` API for pixel-perfect picking anywhere on screen; picked colours
  accumulate and save to the library as a card (`lib/eyedropper.ts`). The button
  is disabled where the API is unavailable — still no extra permission.
- **Colour/icon tagging with a picker.** Cards can be tagged with a colour and an
  emoji chosen from a clickable, offline `ColorIconPicker` (curated grids, never a
  hand-entry field). The tag shows on the card header.

### Changed
- Exporters share family-name slugging and stack parsing via
  `lib/exporters/util.ts`, so token names stay consistent across all four
  formats. CSS output is unchanged.

## [0.1.0] — 2026-07-28

### Added
- **Capture a page's colour palette, grouped by role.** The scanner walks the
  page's computed styles and groups colours into backgrounds, text, accents and
  borders — each list ranked by how many elements use the colour — rather than a
  flat hex dump (`lib/extract/colors.ts`, `lib/extract/color.ts`).
- **Typography extraction with font-source detection.** Font families, weights
  and sizes are collected per family and each family's serving origin is
  identified — Google Fonts, Adobe Fonts, self-hosted or system
  (`lib/extract/typography.ts`, `lib/extract/fontSource.ts`).
- **Local library of capture cards.** Each capture is saved with its palette,
  typography, page URL, timestamp and a screenshot thumbnail, browsable on a
  full-page library view with editable notes and delete
  (`entrypoints/library`). Card metadata in `chrome.storage.local`, thumbnails
  in IndexedDB.
- **Export as CSS custom properties.** One click copies or downloads a card as a
  `:root { --… }` block (`lib/exporters/css.ts`), with a format registry ready
  for Tailwind/SCSS/W3C in v0.2.
- Capture orchestration in the background worker: inject scanner via
  `chrome.scripting.executeScript`, aggregate, save, thumbnail with
  `captureVisibleTab`, open the library. Still `activeTab` + `storage` +
  `scripting` only — no new permissions.
- Vitest coverage for colour parsing/aggregation, typography, font-source
  detection and the CSS exporter (10 tests).

## [0.0.1] — 2026-07-28

### Added
- Initial project scaffold: WXT 0.20 + Preact 10.24 + TypeScript 5.6 (strict), mirroring the sibling UsrHelper stack.
- Manifest V3 with a privacy-minimal permission set — `activeTab`, `storage`, `scripting` only (no `host_permissions`, no `tabs`).
- Popup shell (`entrypoints/popup`) with Capture and Open-library actions, and a full-page library shell (`entrypoints/library`) with an empty state.
- Data model (`lib/types.ts`): `StyleCard`, role-grouped `Palette`, `TypographyEntry` with `FontSource`.
- Local persistence: card metadata in `chrome.storage.local` (`lib/storage.ts`), screenshot thumbnails in IndexedDB (`lib/captureStore.ts`).
- Shared `AppFooter` / `AppVersion` components and the dark-theme token stylesheet (`assets/ui.css`).
- Project docs: `README.md`, `CLAUDE.md`, MIT `LICENSE`, this changelog. Placeholder brand icons.

[Unreleased]: https://github.com/AmigoUK/StyleGrab/compare/v0.3.2...HEAD
[0.3.2]: https://github.com/AmigoUK/StyleGrab/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/AmigoUK/StyleGrab/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/AmigoUK/StyleGrab/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/AmigoUK/StyleGrab/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/AmigoUK/StyleGrab/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/AmigoUK/StyleGrab/releases/tag/v0.0.1
