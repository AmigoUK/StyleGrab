# StyleGrab — Privacy Policy

_Last updated: 2026-08-03_

StyleGrab is a zero-backend browser extension. It has no account system, no
server, and makes no network requests of its own.

## What StyleGrab stores

When you capture a page, StyleGrab saves a **capture card** — the page's colour
palette, its typography, the page URL and title, any notes you add, an optional
colour/icon tag you choose, and a screenshot thumbnail of the visible tab.

- Card metadata is stored in your browser's local extension storage
  (`chrome.storage.local`).
- Screenshot thumbnails are stored in your browser's IndexedDB.

All of this lives **only** in your browser, on your machine.

## What StyleGrab does NOT do

- It does **not** transmit any data off your device.
- It has **no** backend, analytics, tracking, or telemetry.
- It does **not** sell or share data with anyone — there is no one to share it
  with.
- It reads a page's styles only on the tab you explicitly trigger it on, via the
  `activeTab` permission, and only when you click.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the styles of, and screenshot, the tab you trigger StyleGrab on — only on your click. |
| `storage` | Save your capture library locally. |
| `scripting` | Inject the style scanner into the page on demand, never in the background. |

There are deliberately **no** host permissions and no `tabs` permission.

## Deleting your data

Delete any capture from the library with the **Delete** button. Removing the
extension deletes all of its stored data.

## Where this policy is published

The canonical, publicly reachable copy of this policy — the URL given to the
Chrome Web Store — is <https://amigouk.github.io/StyleGrab/privacy/>. This file
is its source; the two must always say the same thing.

## Contact

Questions: dev@attv.uk
