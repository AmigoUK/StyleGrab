# Changelog

All notable changes to **StyleGrab** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

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

[Unreleased]: https://github.com/AmigoUK/StyleGrab/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AmigoUK/StyleGrab/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/AmigoUK/StyleGrab/releases/tag/v0.0.1
