import type { ColorRole, Palette, Swatch } from '../types';
import { emptyPalette } from '../types';
import { parseColorToHex } from './color';
import type { RawSample } from './types';

/**
 * Turns raw per-element samples into a palette grouped by the role each colour
 * plays — backgrounds, text, accents, borders — each list ranked by how many
 * elements used the colour. This is the core "grouped by role, not a flat list"
 * behaviour. Pure and unit-tested.
 */

/** Tags whose foreground/background read as accents (links, buttons, controls). */
const ACCENT_TAGS = new Set(['a', 'button', 'select', 'input', 'textarea', 'summary', 'mark']);

const MAX_PER_ROLE = 12;

function tally(map: Map<string, number>, hex: string | null): void {
  if (!hex) return;
  map.set(hex, (map.get(hex) ?? 0) + 1);
}

function rank(map: Map<string, number>): Swatch[] {
  return [...map.entries()]
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex))
    .slice(0, MAX_PER_ROLE);
}

export function aggregatePalette(samples: RawSample[]): Palette {
  const buckets: Record<ColorRole, Map<string, number>> = {
    background: new Map(),
    text: new Map(),
    accent: new Map(),
    border: new Map(),
  };

  for (const s of samples) {
    tally(buckets.background, parseColorToHex(s.backgroundColor));
    tally(buckets.text, parseColorToHex(s.color));
    tally(buckets.border, parseColorToHex(s.borderColor));
    if (ACCENT_TAGS.has(s.tag)) {
      tally(buckets.accent, parseColorToHex(s.color));
      tally(buckets.accent, parseColorToHex(s.backgroundColor));
    }
  }

  const palette = emptyPalette();
  palette.background = rank(buckets.background);
  palette.text = rank(buckets.text);
  palette.accent = rank(buckets.accent);
  palette.border = rank(buckets.border);
  return palette;
}
