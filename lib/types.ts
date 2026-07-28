/**
 * Shared data model for StyleGrab. A capture of a page's visual DNA is a
 * `StyleCard`: its colour palette (grouped by role, not a flat list), its
 * typography stacks (with the font source identified), plus the page URL,
 * user notes and optional user-chosen tag colour/icon. Screenshot thumbnails
 * are stored separately as blobs in IndexedDB (see `captureStore.ts`), keyed
 * by the card id, because blobs are too large for chrome.storage.
 */

/** The role a colour plays on the page, derived from which property it came from. */
export type ColorRole = 'background' | 'text' | 'accent' | 'border';

export const COLOR_ROLES: ColorRole[] = ['background', 'text', 'accent', 'border'];

/** A single colour and how often it appeared in its role. */
export interface Swatch {
  /** Normalised `#rrggbb` (or `#rrggbbaa` when it carries alpha). */
  hex: string;
  /** Number of elements that used this colour in this role — drives ranking. */
  count: number;
}

/** Colours grouped by the role they play, each list ranked by frequency. */
export type Palette = Record<ColorRole, Swatch[]>;

/** Where a font is served from, identified from stylesheets and <link> tags. */
export type FontSource = 'google' | 'adobe' | 'self-hosted' | 'system' | 'unknown';

/** One typography stack seen on the page. */
export interface TypographyEntry {
  /** The first, primary family in the stack, e.g. `Inter`. */
  family: string;
  /** The full `font-family` value as authored, e.g. `Inter, system-ui, sans-serif`. */
  stack: string;
  /** Distinct font weights observed for this family, ascending. */
  weights: number[];
  /** Distinct font sizes observed, in CSS px, ascending. */
  sizes: number[];
  /** Identified serving origin of the font. */
  source: FontSource;
  /** Number of elements using this family — drives ranking. */
  count: number;
}

/** The full result of scanning a page, produced by the injected scanner. */
export interface ScanResult {
  url: string;
  title: string;
  palette: Palette;
  typography: TypographyEntry[];
}

/** A saved capture in the local library. */
export interface StyleCard extends ScanResult {
  id: string;
  /** ISO timestamp of capture. */
  createdAt: string;
  /** Free-text user notes. */
  notes: string;
  /** Optional user tag colour (chosen via picker, never hand-typed). */
  color?: string;
  /** Optional user tag emoji (chosen via picker, never hand-typed). */
  icon?: string;
}

export function emptyPalette(): Palette {
  return { background: [], text: [], accent: [], border: [] };
}
