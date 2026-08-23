# Chrome Web Store listing

Source of truth for the StyleGrab store listing copy. Keep in sync with the
manifest `description`, `README.md` and `PRIVACY.md`. For the click-by-click
dashboard walkthrough see [STORE_SUBMISSION.md](./STORE_SUBMISSION.md).

## Item details

| Field | Value |
|---|---|
| Name | **StyleGrab — Design tokens from any website** |
| Category | Developer Tools |
| Language | English (United Kingdom) |
| Website | https://amigouk.github.io/StyleGrab/ |
| Support URL | https://github.com/AmigoUK/StyleGrab/issues |
| Privacy policy URL | https://amigouk.github.io/StyleGrab/privacy/ |
| Pricing | Free, no in-app purchases |

## Short description (≤132 chars)

> Save colour palettes and typography from any page. Export as CSS variables, Tailwind config or W3C design tokens. Free, no account.

131 characters — identical to the manifest `description`, asserted by
`scripts/e2e-flow.mjs`.

## Full description

StyleGrab captures the visual DNA of any website and turns it into code you can actually use.

**What it does**

Open any page and StyleGrab extracts its colour palette from computed styles, grouped by role — backgrounds, text, accents — not just a flat list of hex values. Near-identical shades are merged perceptually, and when a site defines its design tokens as CSS custom properties, StyleGrab exports the site's *own token names* — `--color-primary`, not `--accent-1`. It reads the typography stack too: font families, weights and sizes per element, with the font source identified (Google Fonts, Adobe Fonts or self-hosted). Need one specific colour? The built-in eyedropper uses Chrome's native EyeDropper API for pixel-perfect picking anywhere on screen.

Every capture is saved as a card — screenshot thumbnail, palette, typography, URL and your notes — in a local library you can browse, search and curate (merge, split or remove swatches). Each card includes a WCAG contrast check: the page's text colours crossed with its backgrounds, with AAA/AA verdicts at a glance.

**Built for developers**

Other tools show you colours. StyleGrab hands you a file. One click exports any card as:

- CSS custom properties
- Tailwind config
- SCSS variables
- W3C design tokens (JSON)
- Agent spec (STYLE.md) — a design-context file you can commit to a repo or paste straight into an AI coding agent like Claude Code or Cursor
- Tokens Studio JSON, importable into the Figma plugin

Paste it straight into your project. No transcribing hex codes from a screenshot. Capture any site's visual DNA — and hand it to your coding agent.

**Privacy first**

No account. No backend. No data transmission. Everything lives in your browser's local storage — your captures never leave your machine. Free, with no premium tier and no upsell.

**Permissions explained**

- *activeTab* — reads styles only on the page you trigger it on
- *storage* — saves your library locally
- *scripting* — injects the style scanner on demand, never in the background

Open source on GitHub. Issues and PRs welcome.

## Single purpose

> Capture a website's colours and typography and export them as code.

Everything in the extension serves that one purpose: the scanner reads the
styles, the library stores what it read, and the exporters write it out. There
is no second, unrelated feature.

## Permission justifications

Paste these verbatim into the dashboard's "Privacy practices" tab. Each one is
the shortest true answer, which is what reviewers reward.

| Permission | Justification |
|---|---|
| `activeTab` | StyleGrab reads the computed styles of the page the user is on, and takes a screenshot of the visible tab for the capture's thumbnail. Both happen only after the user clicks the extension's toolbar icon and presses Capture, so temporary access to that one tab is all that is required. |
| `storage` | The capture library — palettes, typography, page URLs, user notes and tags — is saved locally with chrome.storage.local so it survives a browser restart. Nothing is ever uploaded. |
| `scripting` | The style scanner is injected into the active tab with chrome.scripting.executeScript when the user presses Capture. It reads computed styles and font URLs, returns them, and is never registered to run in the background or on any page the user did not choose. |
| Remote code | **Not used.** All logic ships inside the package. The extension loads no external scripts, no eval'd strings and no remotely hosted modules. |
| Host permissions | **None requested.** activeTab covers the single tab the user acts on; StyleGrab never asks for access to a site it was not explicitly invoked on. |

## Data usage disclosures

Answer "no" to every collection category. StyleGrab collects none of:
personally identifiable information, health information, financial and payment
information, authentication information, personal communications, location,
web history, or user activity.

The three certification checkboxes are all true:

- The data handled is not sold to third parties, outside of approved use cases.
- The data handled is not used or transferred for purposes unrelated to the item's single purpose.
- The data handled is not used or transferred to determine creditworthiness or for lending purposes.

Nothing leaves the user's machine, so there is no transfer of any kind. This is
verifiable from the source: the extension makes no network requests and requests
no host permissions.

## Assets

All generated from the real, loaded extension with `npm run shots`
(see `scripts/make-shots.mjs`).

- [x] Icon 128×128 — `public/icon/128.png`
- [x] Screenshots 1280×800 (×5) in `docs/store/`:
  - `shot-1-palette.png` — colour palette grouped by role, with curation chips
  - `shot-2-contrast.png` — WCAG contrast verdicts above the typography stack
  - `shot-3-export.png` — Agent spec (STYLE.md) export with harvested token names
  - `shot-4-popup.png` — popup (capture + eyedropper)
  - `shot-5-organise.png` — tagging, notes and search
- [x] Small promo tile 440×280 — `docs/store/promo-440x280.png`
- [x] Marquee promo tile 1400×560 — `docs/store/marquee-1400x560.png`
- [x] Category: Developer Tools
- [x] Privacy policy URL — https://amigouk.github.io/StyleGrab/privacy/
- [x] Single purpose statement (above)
