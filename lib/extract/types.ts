/**
 * Raw, serializable data collected by the injected scanner in the page's
 * isolated world. The scanner cannot import our modules (it is stringified and
 * injected via chrome.scripting.executeScript), so it only gathers primitives;
 * all aggregation and classification happens back in the extension context
 * using the pure functions in this folder.
 */

/** Computed style values sampled from one element. */
export interface RawSample {
  /** Lowercased tag name, e.g. 'a', 'button', 'p'. */
  tag: string;
  /** `getComputedStyle` color / background-color / border colour, as returned by Chrome. */
  color: string;
  backgroundColor: string;
  borderColor: string;
  /** Full `font-family` value as computed. */
  fontFamily: string;
  /** `font-weight` (e.g. '400', '700', 'bold'). */
  fontWeight: string;
  /** `font-size` (e.g. '16px'). */
  fontSize: string;
}

/** Everything the scanner returns for one page. */
export interface RawScan {
  url: string;
  title: string;
  samples: RawSample[];
  /** Stylesheet hrefs, `<link>` hrefs and @font-face src URLs the page exposes. */
  fontUrls: string[];
}
