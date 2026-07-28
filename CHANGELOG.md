# Changelog

All notable changes to **StyleGrab** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [0.0.1] — 2026-07-28

### Added
- Initial project scaffold: WXT 0.20 + Preact 10.24 + TypeScript 5.6 (strict), mirroring the sibling UsrHelper stack.
- Manifest V3 with a privacy-minimal permission set — `activeTab`, `storage`, `scripting` only (no `host_permissions`, no `tabs`).
- Popup shell (`entrypoints/popup`) with Capture and Open-library actions, and a full-page library shell (`entrypoints/library`) with an empty state.
- Data model (`lib/types.ts`): `StyleCard`, role-grouped `Palette`, `TypographyEntry` with `FontSource`.
- Local persistence: card metadata in `chrome.storage.local` (`lib/storage.ts`), screenshot thumbnails in IndexedDB (`lib/captureStore.ts`).
- Shared `AppFooter` / `AppVersion` components and the dark-theme token stylesheet (`assets/ui.css`).
- Project docs: `README.md`, `CLAUDE.md`, MIT `LICENSE`, this changelog. Placeholder brand icons.

[Unreleased]: https://github.com/AmigoUK/StyleGrab/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/AmigoUK/StyleGrab/releases/tag/v0.0.1
