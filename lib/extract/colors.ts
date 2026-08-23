import type { ColorRole, Palette, Swatch } from '../types';
import { emptyPalette } from '../types';
import { DELTA_E_MERGE_THRESHOLD, deltaE2000, hexToLab, parseColorToHex } from './color';
import type { Lab } from './color';
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
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));
}

/**
 * Greedily merges perceptually indistinguishable swatches (ΔE2000 ≤ threshold)
 * into the most frequent member, so #fefefe stops ranking separately from
 * #ffffff. Input must be rank-sorted so canonicals are the most frequent.
 * Colours carrying alpha never merge — their rendered appearance depends on
 * what sits behind them. Absorbed members are recorded on `merged` so the UI
 * can undo a merge.
 */
function clusterPerceptually(swatches: Swatch[]): Swatch[] {
  const labs = new Map<string, Lab>();
  const labOf = (hex: string): Lab => {
    let lab = labs.get(hex);
    if (!lab) {
      lab = hexToLab(hex);
      labs.set(hex, lab);
    }
    return lab;
  };

  const out: Swatch[] = [];
  for (const s of swatches) {
    const opaque = s.hex.length === 7;
    const canon = opaque
      ? out.find(
          (c) =>
            c.hex.length === 7 &&
            deltaE2000(labOf(c.hex), labOf(s.hex)) <= DELTA_E_MERGE_THRESHOLD,
        )
      : undefined;
    if (canon) {
      canon.count += s.count;
      (canon.merged ??= []).push({ hex: s.hex, count: s.count });
    } else {
      out.push({ ...s });
    }
  }
  return out
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
  palette.background = clusterPerceptually(rank(buckets.background));
  palette.text = clusterPerceptually(rank(buckets.text));
  palette.accent = clusterPerceptually(rank(buckets.accent));
  palette.border = clusterPerceptually(rank(buckets.border));
  return palette;
}
