# Submitting StyleGrab to the Chrome Web Store

Everything a reviewer asks for is prepared and checked into this repo. What is
left is the part only the account owner can do: paying the one-off developer
fee, uploading the package and pressing Submit.

Copy for every text field lives in [STORE_LISTING.md](./STORE_LISTING.md) — this
page is the order to do things in.

## Before you start

| You need | Where it is |
|---|---|
| A Chrome Web Store developer account | https://chrome.google.com/webstore/devconsole — one-off **US$5** registration fee, paid with a Google payments profile |
| The package | `.output/stylegrab-<version>-chrome.zip`, produced by `npm run zip` |
| The source archive | `.output/stylegrab-<version>-sources.zip`, also from `npm run zip` — upload it if you are asked about minified code |
| A public privacy policy | https://amigouk.github.io/StyleGrab/privacy/ — must be reachable before you submit |

Build the package fresh from a clean tree:

```bash
npm ci
npm run compile && npm test
npm run build
xvfb-run -a npm run e2e:all      # 27-check flow against the built extension
npm run zip
```

`npm run zip` prints both archive paths. The GitHub Release for the matching tag
carries the same files, so you can also download them from
https://github.com/AmigoUK/StyleGrab/releases.

## 1 — Create the item

1. Open the [developer dashboard](https://chrome.google.com/webstore/devconsole) and choose **Add new item**.
2. Upload `stylegrab-<version>-chrome.zip`. The manifest fills in the name, version and description automatically.
3. Do not publish yet — the draft opens on the *Store listing* tab.

## 2 — Store listing

| Field | Value |
|---|---|
| Name | StyleGrab — Design tokens from any website |
| Summary | the 131-character short description from STORE_LISTING.md |
| Description | the full description from STORE_LISTING.md |
| Category | Developer Tools |
| Language | English (United Kingdom) |
| Screenshots | `docs/store/shot-1-palette.png` … `shot-5-organise.png` (1280×800) |
| Small promo tile | `docs/store/promo-440x280.png` |
| Marquee promo tile | `docs/store/marquee-1400x560.png` (optional, needed for featuring) |
| Official website | https://amigouk.github.io/StyleGrab/ |
| Support URL | https://github.com/AmigoUK/StyleGrab/issues |

Upload the screenshots in numbered order — the first one is the tile users see
in search results.

## 3 — Privacy practices

This is the tab that decides how long review takes. Fill it exactly:

1. **Single purpose** — paste the single-purpose sentence from STORE_LISTING.md.
2. **Permission justifications** — paste the `activeTab`, `storage` and
   `scripting` justifications, one per field. There is no host-permission field
   to fill, because the manifest requests none.
3. **Remote code** — select *No, I am not using remote code*.
4. **Data usage** — tick nothing in the collection list, then tick all three
   certification checkboxes. See STORE_LISTING.md for why each is true.
5. **Privacy policy URL** — https://amigouk.github.io/StyleGrab/privacy/

## 4 — Distribution

- Visibility: **Public**
- Regions: all
- Pricing: free

## 5 — Submit

Press **Submit for review**. First reviews usually land within a few days;
an extension with three narrow permissions, no host permissions and no remote
code is the easy case.

## After it is live

1. Add the store URL and badge to `README.md` and to `docs/index.html`
   (the install section currently says the listing is on its way).
2. Record the listing URL in `docs/STORE_LISTING.md`.
3. Tag and release the change like any other (`CHANGELOG.md` → version bump →
   tag → GitHub Release).

## Shipping an update later

1. Bump the version in `package.json` (the manifest tracks it, and
   `scripts/e2e-flow.mjs` asserts they match).
2. Move the `[Unreleased]` notes into a new `CHANGELOG.md` section.
3. `npm run build && npm run zip`.
4. In the dashboard: **Package → Upload new package**, then Submit.

A version can only ever go up, and a version already reviewed cannot be
re-uploaded — so bump before you build.
