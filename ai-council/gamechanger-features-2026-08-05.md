# AI Council — Gamechanger features for StyleGrab

**Date:** 2026-08-05
**Convened by:** the lead orchestrator (chair)
**Method:** five specialists produced fully independent analyses via parallel subagents — each received only the problem statement, the product context, and their own persona; none knew the others existed. The debate and verdict were then chaired in one room.

## Problem statement

StyleGrab (v0.4.0, about to launch on the Chrome Web Store) wants to identify its next **gamechanger feature(s)** — what to build next to move it from a nice utility to a must-have tool.

**Product context:** zero-backend MV3 Chrome extension capturing a site's visual DNA — colour palette grouped by role, typography with font source — exported as CSS custom properties, Tailwind config, SCSS or W3C design tokens. Local library with screenshot thumbnails, native EyeDropper picker. Hard promises: no account, no network calls, all data local; permissions only `activeTab` + `storage` + `scripting`. TypeScript/Preact/WXT, effectively a solo maintainer, CI-enforced test coverage on `lib/`.

## Council roster

| Specialist | Role | Thinking style | Why indispensable |
|---|---|---|---|
| **Maya Chen** | Staff design-systems engineer | Workflow-obsessed; judges features by manual steps deleted from "see site → extract → ship tokens to codebase" | Gamechanger status is decided by the target user's daily loop |
| **Viktor Osei** | Chrome extension platform engineer (ex-browser-vendor) | Constraint-first realist; kills ideas that need permissions creep, spots capabilities others miss | Most "gamechanger" ideas die on the privacy-minimal permission promise |
| **Sana Marroush** | Indie-extension growth strategist | Distribution-first; thinks in store keywords, shareable output, install-to-habit conversion | A feature nobody discovers changes no game |
| **Ruth Kagan** | Open-source maintainer, privacy & scope skeptic | Instinct is "no / simpler / cheaper"; prices features in maintenance-years | The council's brake — without her the verdict is a wishlist |
| **Diego Fontaine** | Competitive analyst of design tooling | Pattern-matcher; asks "why hasn't an incumbent done this, and is it a moat or a commodity?" | Prevents building a feature CSS Peeper copies in a weekend |

---

## Step 1 — Independent analyses

### Maya Chen — design-systems workflow

Having read the source (scanner samples five computed properties per element; `Swatch` is `{hex, count}` with no name; `w3c.ts` emits tokens literally named `color.background.1`, `.2`, `.3`), I have what I need.

**1. Diagnosis**

The problem isn't "not enough features" — it's that StyleGrab currently exits the workflow one step before the value lands. My loop is: see a site → extract values → get them into my codebase *as usable tokens*. StyleGrab nails extraction, then hands me an export where every token is called `--background-1`, `--accent-3`, `fontFamily.inter`. Look at `lib/exporters/w3c.ts:27` — swatches are numbered, not named, because `Swatch` in `lib/types.ts` is just `{hex, count}`. So my real workflow is: export → paste into `tokens.json` → hand-rename fifteen tokens → delete the six junk swatches the scanner picked up from a cookie banner → merge `#1a1a1b` into `#1a1a1a`. That's ten minutes of manual cleanup per capture, which is why tools like this get used twice and abandoned. Second gap: the scanner (`lib/extract/scanner.ts`) reads only color/background/border/font properties. The moment I want the thing I *actually* came for — that card's border-radius, shadow, spacing rhythm — I'm back in DevTools. The capture is page-level trivia; my need is component-level recipes.

**2. Proposed solution**

Two features, in priority order:

**(a) Token curation in the library — the must-have.** In the dashboard card view: click any swatch to rename it (`--background-1` → `--surface-raised`), delete swatches, and merge near-duplicates (offer merges automatically above a Delta-E-2000 threshold ~2.5, computable in ~40 lines of pure TS in `lib/extract/color.ts` — no dependency needed). Persist `name?: string` on `Swatch` and `TypographyEntry`, thread it through all four exporters with numeric fallback so existing snapshots stay deterministic. Pure `lib/` logic + Preact UI, fully coverable by the existing Vitest/jsdom setup. **~2.5 person-weeks** including migration of stored cards and exporter snapshot updates.

**(b) Element lens — the differentiator.** A second capture mode: popup click injects (via `chrome.scripting`, same self-contained-function pattern `collectRawScan` already uses, so still no new permissions) a hover-highlight picker; clicking an element captures its full recipe — padding, gap, border-radius, box-shadow, background (incl. gradients), typography — as a token group on the card, exported through the same four formats. Extend `RawSample` with those computed properties; shadow/gradient parsing is pure logic in `lib/extract/`, testable headlessly. **~3.5–4 person-weeks** (the picker overlay UX and its e2e coverage via `scripts/lib/harness.mjs` is most of it).

Explicitly *not* proposing: sync, teams, AI naming — all violate the zero-backend promise, and (a) makes hand-naming cheap enough that AI naming isn't needed.

**3. Key assumptions**

- The target user is someone feeding a codebase (Style Dictionary / Tailwind / DTCG pipelines), not a moodboard collector; therefore export quality beats capture breadth.
- Clipboard/file export is an acceptable last hop; nobody expects a Chrome extension to write into their repo, so the fixable friction is *what* gets exported, not *how*.
- A hover-picker injected on a popup-initiated user gesture stays within `activeTab` — consistent with how `captureVisibleTab` is already gated.
- One maintainer, so ~6 person-weeks total is roughly a quarter of part-time capacity; sequencing (a) before (b) is viable.

**4. Risks**

- **Curation is invisible in a store screenshot.** It's a retention feature, not an acquisition feature; if the launch problem is installs rather than second-week retention, I've prioritized wrong.
- **Merge suggestions can be confidently wrong** (brand colors that are legitimately 2 Delta-E apart). Must be opt-in per merge, never automatic, or trust dies.
- **The element lens drags scope**: shadows with multiple layers, gradients, CSS transforms, shadow DOM boundaries. If I don't hard-cap v1 (single element, no shadow-DOM piercing, longhand values only), 4 weeks becomes 10.
- **Schema migration risk**: adding `name` to stored cards touches `lib/storage.ts` data already on users' machines pre-launch; a botched migration silently eats libraries with no backend to recover from.
- Renaming UI must respect the "picker, never hand-entry" convention *except* names are inherently typed text — a deliberate, documented exception, or it'll look like convention drift.

**5. Confidence**

**80%** — the curation gap is verifiable in the exporter source and matches a pain I hit weekly in my own pipeline; the residual 20% is the untested assumption that StyleGrab's actual install base skews toward token-pipeline engineers rather than casual palette browsers.

### Viktor Osei — platform constraints & capabilities

**1. Diagnosis**

The question is framed as "what feature makes us a must-have," but the real problem is that StyleGrab currently answers a question people ask rarely ("what's this site's palette and fonts?") instead of a question developers ask daily ("how do I rebuild *that thing I'm looking at* in my stack?"). I read the source: the scanner (`lib/extract/scanner.ts`, 78 lines) walks the page once and aggregates page-level colour roles and type stacks. That's an inspiration tool. The library, exporters, and thumbnails are solid plumbing, but the extraction ceiling is low — no spacing, radii, shadows, gradients, and critically no *element-level* capture. Meanwhile the platform envelope is underused. People assume anything interactive needs `host_permissions`; it doesn't. `activeTab` + `scripting` gives you full DOM read *and write* on the active tab after a toolbar click — the same envelope you already ship. The gamechanger isn't a new permission or a backend; it's moving from "scan the whole page" to "point at any element and get it as code," plus closing the token-coverage gap so the export is a usable design system, not two-fifths of one.

**2. Proposed solution**

Three features, in priority order, all buildable inside `activeTab + storage + scripting` with zero network calls:

**A. Element Grabber (the headline) — ~3 person-weeks.** A picker mode injected from the popup (user gesture satisfied): hover-highlight overlay like DevTools inspect, click an element, and StyleGrab captures its computed style *recipe* — colours, typography, padding, border, radius, shadow, gradient, transitions — normalised against inherited/default values so you get the ~12 declarations that matter, not 300 computed properties. Export the selection through the existing exporter pipeline: CSS class, Tailwind utility string (this is the killer output — "give me this button as Tailwind classes" is a daily Stack Overflow-shaped need), or a design token subset. Saved to the library as a component card alongside page cards (extend `StyleCard` with an optional `element` capture). Implementation is a second content-script mode plus a `computedStyleDiff` module in `lib/extract/` (pure, Vitest-covered per your CI thresholds). Preact overlay rendered in a closed shadow root to avoid host-page CSS bleed.

**B. Full-token scan — ~1.5 person-weeks.** Extend the existing scanner to also aggregate spacing values (clustered into a scale), border-radii, and box-shadows. This upgrades the W3C/Tailwind exports from "palette + fonts" to a credible starter design system, which is what the export formats *imply* you deliver today.

**C. Live theme preview — ~1 person-week.** From the popup, inject a stylesheet that remaps the current page's dominant colours/fonts to any saved card's palette (CSS overrides keyed off the captured role groupings). "See your site wearing Stripe's palette" is a shareable, demo-able moment — screenshot-friendly marketing that costs nothing in permissions because injection rides the same user-gesture `activeTab` grant.

Total: ~5.5 person-weeks for a solo maintainer. Ship A alone first if forced to choose.

**3. Key assumptions**

- The Chrome Web Store audience for a launch-stage extension is developers and design-adjacent devs, for whom "element → code" beats "page → mood board."
- Computed-style diffing against a baseline element (an unstyled clone in an injected iframe or a static UA-default table) is accurate enough to produce clean recipes; DevTools does essentially this.
- The `activeTab` grant persists long enough per navigation-free session for an interactive picker (it does — it lasts until navigation/tab close, not just one call).
- The solo maintainer can absorb ~6 weeks before or shortly after launch without stalling store submission.

**4. Risks**

- **Recipe quality is the whole bet.** Computed styles flatten shorthands, custom properties, and pseudo-elements (`::before` decorations, `:hover` states are invisible without simulation). A grabbed button that looks wrong when pasted kills trust faster than not having the feature. Mitigation: scope v1 to static base state, label it as such.
- **Scope creep toward a DevTools clone** — the overlay, shadow-root isolation, and iframe-based baseline are each small but fiddly; 3 weeks could become 6.
- **Live preview (C) is fragile** on CSS-in-JS and utility-class sites; if it demos badly it's negative marketing. It's the first thing I'd cut.
- **Review friction:** injecting overlays/stylesheets is fully policy-compliant under `activeTab`, but the reviewer may ask why `scripting` exists — the listing copy in `docs/STORE_LISTING.md` must be updated to describe injection honestly (also a `PRIVACY.md` obligation per the repo's own protected-files rule).

**5. Confidence**

75% — the platform feasibility is near-certain (I've shipped this envelope before); the residual risk is product, namely whether element-recipe fidelity is good enough in v1 to convert daily use.

### Sana Marroush — growth & distribution

**1. Diagnosis**

The question "what's the next gamechanger feature" is slightly wrong. Having read the repo (v0.4.0 is genuinely polished — 123 tests, real store assets, tight permission story), the actual problem is that StyleGrab is a **one-and-done utility with no distribution engine**. A developer grabs a palette, exports a Tailwind config, and has no reason to come back for weeks — and critically, nothing they do with StyleGrab is ever *seen by anyone else*. Zero shareable surface, zero word-of-mouth loop. Meanwhile the incumbents in this exact CWS neighbourhood (ColorZilla, WhatFont, CSS Peeper — millions of installs each) win on instant gratification and keyword coverage, not power features. The library, notes, and tags are fine but they are retention features for users you don't yet have. The next build must manufacture **installs and reviews**, not depth.

**2. Proposed solution**

Three things, in priority order, all compatible with the zero-backend promise:

**A. Shareable style-card image export (~2 person-weeks).** One click on any library card renders a beautiful 1200×630 PNG — palette swatches with hex codes, type specimen, source URL, subtle "StyleGrab" mark — via OffscreenCanvas/`<canvas>` entirely locally, downloaded like the existing exporters (`lib/exporters/` already has the plumbing pattern). Designers and devs *constantly* post palettes and "site breakdown" images on X, Dribbble, and Slack channels. Every share is an ad; this is the only feature on any roadmap I can see that turns usage into distribution. It also gives you your best store screenshot.

**B. WCAG contrast grid on every capture (~1.5 person-weeks).** You already have colours grouped by role — computing text-vs-background contrast pairs with pass/fail badges (AA/AAA) is pure `lib/` logic, trivially Vitest-able, fits your coverage regime. Strategically it buys the search terms "contrast checker" and "accessibility" — high-volume CWS keywords you currently don't rank for — and it converts StyleGrab from "inspiration tool" to "tool I open on *my own* staging site before every release." That's the tenth-open habit loop the current feature set lacks.

**C. Tokens Studio / Figma-flavoured export (~0.5 person-weeks).** You already emit W3C design tokens; add the Tokens Studio JSON dialect and say the word "Figma" in the listing. Designers outnumber developers ten to one in this category's search traffic, and today your copy speaks only to devs. Cheapest keyword expansion available.

Explicitly **do not build**: sync/teams (violates the privacy promise, your best differentiator), AI theme generation (backend or API key — dead on arrival for this product), or a fifth code export format (nobody installs for SCSS *and* Less).

**3. Key assumptions**

- The privacy/no-network promise is non-negotiable, so anything requiring fetches or accounts is off the table.
- CWS organic search plus social sharing is the acquisition channel; there's no paid budget and a solo maintainer.
- The palette/typography extraction quality is good enough that a shared image reflects well on the tool (I haven't visually audited scanner output across many real sites).
- Designers, not just developers, are a reachable audience without rewriting the product.

**4. Risks**

- **The virality bet may not pay.** Dev-tool image sharing is real but thin; if the style cards aren't genuinely gorgeous, nobody posts them and A becomes a nice-to-have. Design quality of the rendered card is the whole feature — budget real polish time, not just canvas plumbing.
- **Font rendering trap in A:** rendering the captured site's actual typeface in the specimen would require fetching the font file — a network call you've promised never to make. Mitigation: render specimens in locally available fallbacks or crop from the existing screenshot thumbnail; if handled clumsily this weakens the card's appeal.
- **B risks scope creep** into a full a11y auditor, which dilutes the single-purpose statement you've carefully written for review. Keep it to contrast pairs on captured colours.
- Sequencing all three (~4 person-weeks solo) delays launch; I'd argue ship 0.4.0 *now* and land A in 0.5.0 — but that pre-launch/post-launch timing risk is mine to own.

**5. Confidence**

70% — the diagnosis (distribution problem, not feature problem) I'd defend at 90%, but whether style-card sharing specifically generates a meaningful install loop for a dev-tools extension is an educated bet, not a certainty.

### Ruth Kagan — scope skeptic

**1. Diagnosis**

The question is mis-framed. StyleGrab is at v0.4.0 and has not shipped to the Web Store yet — asking for a "gamechanger" before a single stranger has used it is how small tools die. I read the source: the whole engine is ~900 lines of `lib/` (scanner 78 lines, colour aggregation 54, typography 71), and it is honest about what it does. But look at what it actually captures: computed `color` / `backgroundColor` / `borderTopColor`, frequency-ranked, with "accent" guessed from a tag whitelist (`ACCENT_TAGS` in `lib/extract/colors.ts`). That produces palettes polluted by near-duplicate hexes (#fff vs #fefefe rank separately) and a role model that is a heuristic, not the truth. Meanwhile the truth is frequently sitting right there on the page: most modern sites define their real design tokens as CSS custom properties on `:root`, and the scanner never reads them. The product's promise is "capture a site's visual DNA"; today it captures a census of computed styles. The gap between those two is the entire opportunity. The problem isn't a missing feature — it's that the core capture is one notch below trustworthy, and trust in the output is the only moat a zero-backend tool has.

**2. Proposed solution**

Ship v0.4.0 as-is, then sharpen capture instead of widening scope. Three items, in order:

- **Harvest the page's own custom properties** (~2–3 person-weeks). In `collectRawScan`, walk same-origin `document.styleSheets` for `:root` / `html` rules and collect `--*` declarations, resolving values via `getComputedStyle(document.documentElement).getPropertyValue()`. Swallow the cross-origin SecurityError exactly as `fontSource` already does. When a site defines `--color-primary: #6c5ce7`, StyleGrab exports the site's *actual token names*, not a guess. Falls back silently to today's behaviour. Zero new permissions, pure-`lib` aggregation, fully Vitest-able.
- **Perceptual clustering of swatches** (~1–2 person-weeks). Merge colours within a small ΔE in Lab space before ranking in `aggregatePalette`, keeping the most frequent member as canonical. Palettes stop reading as DOM noise and start reading as design intent. Pure function, trivially testable.
- **Contrast pairs** (~1 person-week). The data for text-on-background pairs is already in the samples; annotate the top pairs with WCAG contrast ratios in the card UI. Cheap, differentiating, and it deepens the existing capture rather than adding a mode.

Explicitly do **not** build: sync/accounts (breaks the zero-backend promise the day you write the first server line), AI palette naming (a network call — the promise dies quietly), a Figma plugin (a second codebase for a solo maintainer), full-page component/spacing scraping (unbounded scope, hover states are unreachable from an isolated world anyway), or any new permission. Total: ~4–6 person-weeks, all inside the existing permission set and test harness.

**3. Key assumptions**

That the target user is a developer who judges the tool by whether the exported tokens match what they'd have written by hand — i.e., output fidelity converts to retention. That a meaningful fraction of visited sites expose same-origin custom properties (true for most self-hosted CSS; false for some CDN-split setups, where the fallback still works). That the maintainer really is solo and 4–6 weeks is the realistic budget for the next two quarters. That launch feedback won't reveal a different bottleneck — which is precisely why I say ship first.

**4. Risks**

Custom-property harvesting can *worsen* output on token-soup sites (Tailwind emits hundreds of `--tw-*` variables; utility frameworks will need a filter list, and that list is a small maintenance treadmill). Cross-origin stylesheets make the feature invisibly absent on some sites, which users may read as flakiness. Perceptual clustering has a tuning constant (the ΔE threshold) that will be wrong for someone; merging two intentionally-distinct brand greys is a real failure mode and needs an escape hatch. And the meta-risk of my own conservatism: "sharpen, don't build" can under-deliver on marketing splash — none of these three demo as loudly as an AI feature would, and store-listing growth may be slower for it. I accept that trade deliberately; a loud feature that erodes the no-network promise costs more than slow growth.

**5. Confidence**

75% — high confidence that the do-not-build list is right and that capture fidelity is the moat; the residual 25% is that pre-launch, no real user data exists yet, and the first hundred store reviews could legitimately reorder my three items.

### Diego Fontaine — competitive analysis

Repo confirms what I need: ~900 lines of pure lib code (role-grouped palette, font-source detection, four exporters), a local card library with notes/tags/search, and a hard permission ceiling (`activeTab` only — no background monitoring is even possible). Analysis follows.

**1. Diagnosis**

The question "what feature makes us a must-have" is slightly mis-framed, because *capture* is a commodity. CSS Peeper, Site Palette, Fonts Ninja, WhatFont and ColorZilla all inspect pages; any of them could ship "export as Tailwind config" in a weekend, and CSS Peeper half-has it already. StyleGrab will not win by inspecting better.

What StyleGrab has that incumbents structurally do not: (a) a **persistent local library** of structured, role-grouped, code-shaped captures — competitors are stateless one-shot inspectors or cloud-freemium (CSS Peeper), which their business model prevents them from making local-first; and (b) an output that is already **code, not pictures**. The real problem is that today the workflow *ends* at export. Nobody's job is "have a Tailwind snippet on the clipboard." The job is "make my project look like this." The gamechanger is owning the two workflows adjacent to the library that a stateless inspector cannot enter: **comparison over time/across sites**, and **handoff into the place styles actually get applied in 2026 — an AI coding agent.**

**2. Proposed solution**

Three features, all pure `lib/` logic on the existing `StyleCard` model, no new permissions:

- **Agent-ready style spec export (the headline).** A fifth export format: a single self-describing Markdown/JSON "style context" — palette by role with usage counts, WCAG-computed text/background contrast pairs, typography scale with weights and font sources, plus a short generated instruction preamble — designed to be pasted into Claude Code, Cursor, or dropped in a repo as `STYLE.md` / Style Dictionary-compatible tokens. Positioning: "capture any site's visual DNA, hand it to your coding agent." No incumbent's output is consumable by an agent; StyleGrab's already is 80% of the way. TypeScript in `lib/exporters/`, Vitest-covered. **~1.5 person-weeks.**
- **Card diff.** Re-capture a site, diff against the prior card: colours added/removed/re-ranked, weights and sizes changed, font swapped. This turns the library from a scrapbook into design-QA/regression tooling ("did the redesign drift off-token?"). Diff is pure set/sequence logic over `Palette` and `TypographyEntry[]`; UI is one Preact view in the library. **~2 person-weeks.**
- **Side-by-side compare (2–4 cards).** The agency/pitch workflow — "here are three competitors' palettes and type scales in one exportable view." Trivially built on the library; impossible for stateless tools. **~1.5 person-weeks.**

Plus a small enabler: a **contrast/accessibility readout** on every card (WCAG AA/AAA pairs from the role grouping — the role model makes this cheap and it feeds the agent spec). **~1 person-week.** Total ≈ **6 person-weeks**, sequenced agent-spec first because it is the marketing story for launch week.

**3. Key assumptions**

- The target user is a developer or design-engineer, not a pure visual designer (the export formats already imply this).
- AI-assisted coding is a mainstream workflow among that audience in 2026, and "give the agent design context" is a felt pain — I believe this strongly but haven't validated it against StyleGrab's actual early users.
- The privacy-minimal stance is a durable differentiator worth protecting; therefore no cloud sync, teams, or telemetry, and no `tabs` permission — which rules out automatic drift monitoring (re-capture must stay a user gesture; the diff design above respects that).
- A solo maintainer can ship ~6 person-weeks before the launch window closes without starving store-review fixes.

**4. Risks**

- The agent-spec format could be Sherlocked by the agents themselves — a Claude Code or Cursor feature that "looks at" a URL directly would erode it. Mitigation is the library: an agent can inspect one live page, but not your curated, diffed, annotated collection.
- Diff and compare presume repeated captures; if real usage is one-shot ("grab and forget"), I've built furniture for an empty room. The library's existing notes/tags usage is the signal to check first.
- Contrast auditing edges toward accessibility-tool territory (axe, Stark) where StyleGrab cannot and should not compete; it must stay a readout, not an audit product.
- Scope creep on the spec format (Style Dictionary transforms, theming modes) could eat the 6-week budget; the v1 must be one opinionated file.

**5. Confidence**

**70%** — high confidence the moat is the local library plus code-shaped output rather than capture quality; the residual 30% is whether the agent-handoff framing lands with StyleGrab's actual early adopters versus the compare/diff workflows, which only launch-week usage data can settle.

---

## Step 2 — Adversarial discussion

*Chaired by the orchestrator. Positions collide; changes are marked.*

### Round 1 — Element capture on trial

**Diego** → Maya & Viktor: "You both bet the headline on element-level capture. I dispute the premise. Viktor, you call 'this button as Tailwind classes' a *daily Stack Overflow-shaped need* — but CSS Peeper's inspector already shows per-element styles to millions of users, and I said it in my analysis: any incumbent could ship 'export as Tailwind' in a weekend. If your differentiator can be copied in a weekend by a tool with 100× your installs, what exactly is left of it the Monday after?"

**Viktor** (rebuts): "They show *properties*; I'm proposing *recipes*. The hard part isn't reading computed style — it's the diff against UA defaults that turns 300 computed properties into the 12 declarations that matter, piped through four exporters into a persistent library. Nobody ships that in a weekend; I've watched teams try. And note what an AI agent fetching a URL gets: raw HTML and unexecuted CSS, not the rendered cascade. Element recipes are the one thing in this whole discussion an agent *can't* trivially replicate without driving a browser."

**Ruth** → Viktor: "Then let's talk about your own numbers. You wrote '~3 person-weeks' and four sentences later 'scope creep… 3 weeks could become 6.' Maya wrote '3.5–4 weeks' and 'if I don't hard-cap v1, 4 weeks becomes 10.' You both priced the failure mode into your own risk sections and then kept the headline anyway. For a solo maintainer *pre-launch*, a 6–10 week feature with a fidelity bet at its core — your words, Viktor: 'a grabbed button that looks wrong when pasted kills trust faster than not having the feature' — isn't a headline, it's the whole quarter, gambled before a single store review exists."

**Maya** (**changes position**): "I concede the sequencing. My analysis already ordered curation before the element lens; Ruth's point moves me further — the lens belongs *after* launch and after the fidelity work, gated on demand signal from real users. I maintain it must stay on the roadmap: it's the feature that would make *me* open StyleGrab instead of DevTools, and 'component-level recipes' is where my diagnosis says the daily need lives. But I won't spend the launch quarter on it."

**Viktor** (**maintains / concedes in part**): "I maintain the feasibility and the platform claim — everything fits `activeTab` + `scripting`, no permission moves. I concede the *priority*: phase it behind launch, and prove fidelity with a spike before committing. And I'll cut my own item C, the live theme preview — I flagged it as the first thing I'd cut, and I stand by that: fragile on CSS-in-JS sites, negative marketing if it demos badly. **Concedes: live theme preview is dead.**"

### Round 2 — Naming: harvest the truth vs. hand-curate the guess

**Ruth** → Maya: "Your must-have is a rename UI: `--background-1` → `--surface-raised`, ten minutes of cleanup per capture. But you're building UI to reconstruct names *the page already knows*. When a site defines `--color-primary: #6c5ce7` on `:root`, the truth is sitting in a same-origin stylesheet and the scanner never reads it. Harvesting gives you the site's actual token names for free, in `lib/`, with no new UI surface. Your ΔE merge suggestion is my perceptual clustering with extra chrome on it. Why maintain a hand-tool when the machine-tool exists?"

**Maya** (**changes position**): "Concedes — mostly. Harvesting real token names beats hand-renaming everywhere sites expose them, and that's most modern self-hosted CSS. I re-order: harvesting first, and I drop rename-first as the headline. But I *maintain* the escape-hatch UI, and I'll use your own risk section to do it: you wrote that clustering's ΔE threshold 'will be wrong for someone' and 'merging two intentionally-distinct brand greys is a real failure mode and needs an escape hatch.' An escape hatch **is** curation UI — accept/reject a proposed merge, delete a junk swatch. That's ~1 week of Preact, not my original 2.5."

**Ruth** (**concedes**): "Fair — I named the failure mode; I'll pay for its fix. Accept/reject merge and swatch delete, nothing more. No rename field in v1: on harvested sites the names are real, and on non-harvested sites a wrong guess is better surfaced than papered over."

**Viktor**: "One platform note on harvesting: it must ship with a token-soup filter from day one. Tailwind emits hundreds of `--tw-*` variables; without a denylist the feature *worsens* output on exactly the sites your Tailwind-exporting users visit most. And cross-origin sheets make harvesting silently absent on CDN-split sites — the fallback must be today's behaviour, indistinguishable, or it reads as flakiness. Both are the same pattern `fontSource` already uses."

### Round 3 — Distribution: the PNG bet vs. cheap keywords

**Ruth** → Sana: "Your shareable PNG card: you wrote 'design quality of the rendered card is the whole feature' and 'budget real polish time.' That's a designer-grade polish budget assigned to a solo developer, for a virality loop you yourself rate as 'real but thin.' And your own font-rendering trap says the card can't even show the captured typeface without either a forbidden network fetch or a cropped screenshot. What survives of the feature if the card ships at solo-dev polish level?"

**Sana** (**changes position, maintains diagnosis**): "The trap I already defused — crop the specimen from the existing thumbnail, zero network calls. But I concede the bigger point: the virality bet is thin *and* polish-gated, and there are cheaper wins on the table for the same goal. Here's what moves me: Diego's agent-spec gives me a launch-week story no incumbent can tell — 'capture any site's visual DNA, hand it to your coding agent' — and the contrast grid buys 'contrast checker' and 'accessibility' search terms. Both are keyword acquisitions at a fraction of the PNG's cost. **Changes position:** PNG cards slide to the post-launch gated list; contrast grid and agent-spec move up, and the agent-spec ships *in the launch messaging*, not after it. **Maintains:** the diagnosis stands at 90% — this is a distribution problem, and if the council ships only invisible fidelity work, we've built a better product nobody finds."

**Ruth** → Diego: "Interrogating the agent-spec before it gets waved through on vibes: strip the AI framing and what is it? Because if it's a Markdown serialisation of data the card already holds, it's a fifth export format, ~1.5 weeks, pure `lib/`, zero network calls, zero promise erosion — and I have no objection. If it grows Style Dictionary transforms and theming modes, it's a treadmill."

**Diego** (**maintains**): "It's deliberately the former: one opinionated file, palette-by-role with counts, contrast pairs, type scale, a short instruction preamble. My own risk section caps it — 'the v1 must be one opinionated file.' The AI framing is marketing, not architecture; the file is equally a `STYLE.md` for a human."

**Ruth** (**concedes**): "Then it's in my envelope. Approved — and I note with some satisfaction that the council's 'AI feature' makes zero network calls."

**Viktor** (on Diego's Sherlock risk): "Reinforcing the moat claim: an agent that fetches a URL gets source, not the cascade — no computed styles, no rendered palette, no loaded-font truth. To Sherlock this properly an agent needs to drive a browser. The durable part is exactly what Diego said: the curated library plus a capture pipeline that already ran in a real rendering engine."

### Round 4 — Diff, compare, and the empty room

**Maya** → Diego: "Card diff assumes repeated captures of the same site. I capture a reference site once, take what I need, move on. Your own risk section calls it: 'furniture for an empty room.' What's the evidence anyone re-captures?"

**Diego** (**concedes**): "None yet — that's the point of the signal I named: notes/tags usage and re-capture frequency after launch. **Concedes:** diff and side-by-side compare are deferred until the library shows repeat usage. **Maintains:** when the signal appears, compare is the agency workflow no stateless inspector can follow us into."

### Round 5 — Timing

**Sana**: "Ship 0.4.0 now. Every week pre-launch is a week of zero reviews, zero data, zero ranking history."
**Ruth**: "Agreed — my entire diagnosis starts with 'ship first.'"
**No dissent. Unanimous.**

### Where the debate landed

- **Unanimous:** ship v0.4.0 immediately; contrast pairs (proposed independently by three of five — Sana, Ruth, Diego — kept as a *readout*, not an audit, per Diego's cap); do-not-build list (sync/accounts, AI-via-network, telemetry, new permissions, Figma plugin codebase); live theme preview cut by its own author.
- **Converged after clash:** capture fidelity first (harvesting + clustering + escape-hatch curation) — Maya folded her curation headline into Ruth's harvesting plan; agent-spec export as the launch-week story — Sana traded her PNG headline for it, Ruth cleared it.
- **Still split:** the Element Grabber (see verdict, open disagreements).

**Confidence after debate:** Maya 80% → **85%** (the merged fidelity plan solves her pain cheaper than her own proposal); Viktor 75% → **70%** on the Element Grabber (fidelity risk unresolved, now gated), near-certain on platform claims; Sana 70% → **80%** (revised bundle wins the same keywords cheaper); Ruth 75% → **85%** (plan is her plan plus one vetted export); Diego 70% → **75%** (agent-spec in the launch story; diff correctly parked).

---

## Step 3 — The council's verdict

### 1. Recommended solution

**Ship v0.4.0 to the Chrome Web Store now, unchanged.** Then build **v0.5.0 — "Fidelity + Handoff"** (~8 person-weeks, all inside `activeTab` + `storage` + `scripting`, zero network calls):

1. **Perceptual swatch clustering** — merge near-duplicate colours (ΔE2000, Lab space, threshold ≈ 2.5) in `aggregatePalette` before ranking, canonical = most frequent member; with a per-merge **accept/reject escape hatch and swatch delete** in the card UI (never automatic-only).
2. **Custom-property harvesting** — `collectRawScan` reads same-origin `:root`/`html` `--*` declarations so exports carry the **site's real token names** instead of `--background-1`; ships with a framework token-soup denylist (`--tw-*` etc.) and silently falls back to today's behaviour on cross-origin sheets.
3. **WCAG contrast pairs** — AA/AAA badges on the top text/background pairs of every card. A readout, not an audit product.
4. **Agent-ready style spec** — a fifth entry in `EXPORT_FORMATS`: one opinionated `STYLE.md`/JSON file (palette by role with counts, contrast pairs, type scale, font sources, short instruction preamble) built to paste into Claude Code/Cursor or drop into a repo — plus the ~0.5-week Tokens Studio JSON dialect for designer reach. **This is the launch-week marketing headline:** "Capture any site's visual DNA — hand it to your coding agent."

The **Element Grabber** is explicitly *not* in v0.5.0: it is the leading v0.6.0 candidate, gated on the evidence below.

### 2. Deciding arguments

- **Trust is the only moat a zero-backend tool has** (Ruth). The product's promise is "visual DNA"; today it delivers a computed-style census with numbered tokens. Every debated feature builds on capture output — fidelity work multiplies all of them.
- **The page already knows its token names** (Ruth, Round 2). This dissolved Maya's rename-UI headline: harvesting delivers real names for free where they exist; only the merge escape hatch survives as UI — justified by Ruth's own failure mode.
- **Capture is a commodity; the library + code-shaped output is not** (Diego). This demoted element capture from headline to candidate: a feature CSS Peeper can approximate quickly is not where a launch quarter goes.
- **The agent-spec is the story no incumbent can tell, at a fifth of the cost of the alternatives** (Diego + Sana + Viktor). An agent fetching a URL gets source, not the rendered cascade — StyleGrab's output is already 80% agent-consumable, and the feature passed Ruth's strip-the-hype test: it's a 1.5-week pure-`lib` export format.
- **Why each rejected alternative lost:** *Element Grabber v1* — self-admitted 3→6 / 4→10-week scope risk plus an unproven fidelity bet, pre-launch, solo maintainer (deferred, not killed). *Shareable PNG cards* — polish-gated, thin virality by its own author's rating; its keyword goals are met cheaper by contrast + agent-spec (deferred). *Live theme preview* — cut by its own proposer as fragile and reputationally risky. *Card diff / compare* — presumes repeat usage no data yet supports (deferred pending signal). *Sync, AI-via-network, telemetry, new permissions* — break the product promise; permanently out.

### 3. Open disagreements

- **Element Grabber priority** — the council split. *For as next-up (2):* Maya ("the feature that would make me open StyleGrab instead of DevTools"), Viktor (feasibility near-certain, fidelity the only open bet). *Against/skeptical (3):* Ruth (scope monster pre-data), Diego (commodity without the recipe moat proven), Sana (doesn't move installs directly). **Settling evidence:** (a) a 1-week fidelity spike — recipe extraction on 20 real-world buttons/cards/heroes, pass = pasted output visually matches on ≥16; (b) launch-month store reviews and requests mentioning element-level capture. Either signal green-lights it for v0.6.0; both absent parks it.
- **Whether fidelity work converts to growth** — Sana maintains (90% self-rated) that distribution, not depth, is the bottleneck, and accepted v0.5.0 only because the agent-spec carries the marketing story. **Settling evidence:** install and review velocity in the first 60 days post-launch vs. the category baseline; if flat despite the agent-spec story, the PNG share card returns to the table.
- **ΔE threshold correctness** — Ruth flags that any constant will be wrong for someone. **Settling evidence:** escape-hatch usage rate; frequent rejects on real sites means the threshold (or the whole auto-merge) gets revisited.

### 4. Implementation plan

| # | Task | Owner (council) | Effort | Depends on |
|---|---|---|---|---|
| 0 | Submit v0.4.0 to the Chrome Web Store; final listing pass | Sana | 0.5 pw | — |
| 1 | ΔE2000 clustering in `lib/extract/color.ts` + `aggregatePalette` (pure, Vitest) | Ruth | 1.5 pw | — |
| 2 | Merge accept/reject + swatch delete in `CardView` (+ storage patch, UI tests) | Maya | 1 pw | 1 |
| 3 | Custom-property harvesting in `collectRawScan` + token-soup denylist + aggregation (pure, Vitest; e2e via harness fixture site) | Ruth + Viktor | 2.5 pw | 1 (dedup path) |
| 4 | Contrast-pair computation in `lib/` + AA/AAA badges on cards | Sana (spec) + Ruth (lib) | 1 pw | — (parallel with 3) |
| 5 | Agent-spec exporter (`STYLE.md` + JSON) as fifth `EXPORT_FORMATS` entry; Tokens Studio dialect | Diego + Maya | 2 pw | 3, 4 (spec embeds names + contrast) |
| 6 | Store listing + `docs/STORE_LISTING.md` refresh: agent-handoff story, "contrast" keywords; `PRIVACY.md` reviewed (no data-flow change expected) | Sana + Viktor | 0.5 pw | 5 |
| 7 | v0.6.0 gate review: element-recipe fidelity spike (1 pw, Viktor) + launch-signal readout | whole council | 1 pw | 60 days post-launch |

Total v0.5.0: **~8 person-weeks** after the v0.4.0 submission, sequenced so tasks 1→2 and 4 can land as a small 0.5.0 even if 3 slips.

### 5. Top risks and mitigations

| Risk | Flagged by | Mitigation |
|---|---|---|
| Token-soup sites (`--tw-*`, hashed vars) make harvesting *worsen* output; denylist becomes a maintenance treadmill | Ruth, Viktor | Ship day-one denylist for major frameworks; cap it as a curated list with tests; silent fallback to census behaviour |
| ΔE auto-merge collapses intentionally distinct brand colours | Ruth, Maya | Merges are suggestions with accept/reject, never silent; delete always available |
| Cross-origin sheets make harvesting invisibly absent → perceived flakiness | Ruth, Viktor | Fallback identical to current output; card badges the capture source ("site tokens" vs "computed") |
| Agent-spec Sherlocked by agents reading URLs directly | Diego | Moat is the rendered-cascade capture + curated library (Viktor: agents without a browser can't get computed styles); keep spec one opinionated file |
| Fidelity work is invisible in store screenshots; growth stalls | Sana | Agent-spec carries launch messaging; contrast buys new keywords; PNG card is the pre-approved fallback play |
| Element Grabber scope blow-up if green-lit (3→6, 4→10 weeks) | Viktor, Maya | Hard v1 cap: single element, base state only, no shadow-DOM piercing; fidelity spike gate before commitment |
| Schema changes (`name?` on swatches, harvested tokens) corrupt pre-launch libraries with no backend recovery | Maya | Additive-only schema with fallback rendering; migration covered by storage tests before release |

---

*Report generated by the AI Council process (aicouncil skill). Independent analyses were produced by parallel subagents with no shared context; the debate and verdict were chaired in the main session.*
