# Chrome Web Store listing

Source of truth for the StyleGrab store listing copy. Keep in sync with the
manifest `description` and `README.md`.

## Name

**StyleGrab — Design tokens from any website**

## Short description (≤132 chars)

> Save colour palettes and typography from any page. Export as CSS variables, Tailwind config or W3C design tokens. Free, no account.

## Full description

StyleGrab captures the visual DNA of any website and turns it into code you can actually use.

**What it does**

Open any page and StyleGrab extracts its colour palette from computed styles, grouped by role — backgrounds, text, accents — not just a flat list of hex values. It reads the typography stack too: font families, weights and sizes per element, with the font source identified (Google Fonts, Adobe Fonts or self-hosted). Need one specific colour? The built-in eyedropper uses Chrome's native EyeDropper API for pixel-perfect picking anywhere on screen.

Every capture is saved as a card — screenshot thumbnail, palette, typography, URL and your notes — in a local library you can browse and search.

**Built for developers**

Other tools show you colours. StyleGrab hands you a file. One click exports any card as:

- CSS custom properties
- Tailwind config
- SCSS variables
- W3C design tokens (JSON)

Paste it straight into your project. No transcribing hex codes from a screenshot.

**Privacy first**

No account. No backend. No data transmission. Everything lives in your browser's local storage — your captures never leave your machine. Free, with no premium tier and no upsell.

**Permissions explained**

- *activeTab* — reads styles only on the page you trigger it on
- *storage* — saves your library locally
- *scripting* — injects the style scanner on demand, never in the background

Open source on GitHub. Issues and PRs welcome.

## Assets checklist (before submission)

- [ ] Icon 128×128 (replace placeholder `public/icon/128.png` with final brand icon)
- [ ] Screenshots 1280×800 (×3–5): popup, library card, export panel, eyedropper
- [ ] Small promo tile 440×280
- [ ] Category: Developer Tools
- [ ] Privacy policy URL → `PRIVACY.md` (host or link to the repo)
- [ ] Single purpose: "Capture and export a website's colours and typography as code."
