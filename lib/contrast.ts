import type { Palette, Swatch } from './types';

/**
 * WCAG 2.x contrast arithmetic over a captured palette: which of the page's
 * text colours are readable on which of its backgrounds. A readout, not an
 * audit — StyleGrab reports ratios for the colours it captured; it does not
 * crawl the DOM for violations. Pure and unit-tested.
 */

export type WcagLevel = 'AAA' | 'AA' | 'AA Large' | 'Fail';

export interface ContrastPair {
  text: Swatch;
  background: Swatch;
  /** WCAG contrast ratio, rounded to 2 decimals (1–21). */
  ratio: number;
  level: WcagLevel;
}

/** WCAG relative luminance of an opaque `#rrggbb` colour (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const channel = (index: number): number => {
    const c = parseInt(hex.slice(index, index + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two opaque hex colours, rounded to 2 decimals. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  return Math.round(ratio * 100) / 100;
}

/** Classifies a ratio for normal-size text: AAA ≥ 7, AA ≥ 4.5, AA Large ≥ 3. */
export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

const TOP_PER_ROLE = 3;

/**
 * The palette's most likely text-on-background combinations: the top opaque
 * text colours crossed with the top opaque backgrounds, ordered by how often
 * the pair's colours appear on the page. Colours with alpha are skipped —
 * their effective contrast depends on what they composite over.
 */
export function contrastPairs(palette: Palette, limit = 6): ContrastPair[] {
  const opaque = (swatches: Swatch[]): Swatch[] =>
    swatches.filter((s) => s.hex.length === 7).slice(0, TOP_PER_ROLE);

  const pairs: ContrastPair[] = [];
  for (const text of opaque(palette.text)) {
    for (const background of opaque(palette.background)) {
      const ratio = contrastRatio(text.hex, background.hex);
      pairs.push({ text, background, ratio, level: wcagLevel(ratio) });
    }
  }
  return pairs
    .sort(
      (a, b) =>
        b.text.count + b.background.count - (a.text.count + a.background.count) ||
        b.ratio - a.ratio,
    )
    .slice(0, limit);
}
